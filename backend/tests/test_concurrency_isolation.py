import asyncio
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier, RLock

import pytest
from fastapi import HTTPException

from app.api.agent_sql_routes import QueryRestProxyRequest, queryrest_proxy
from app.crud.knowledge_crud import KnowledgeCRUD
from app.services.entitlement_guard import EntitlementDenied, EntitlementGuard, EntitlementDecision
import app.db.database as database


class ScalarResult:
    def __init__(self, values=()):
        self.values = list(values)

    def all(self):
        return list(self.values)


class Result:
    def __init__(self, value=None, rows=()):
        self.value = value
        self.rows = list(rows)

    def scalar(self):
        return self.value

    def scalars(self):
        values = [row.get('column_name') if isinstance(row, dict) else row for row in self.rows]
        return ScalarResult(values)

    def mappings(self):
        return self

    def first(self):
        return self.rows[0] if self.rows else None

    def all(self):
        return list(self.rows)


class SharedUsageStore:
    def __init__(self):
        self.lock = RLock()
        self.counters = {}

    def key_for(self, params):
        return (
            str(params['tenant_code']).strip().lower(),
            str(params['contract_id']),
            str(params['period_ref']),
        )


class ConcurrentUsageDB:
    def __init__(self, store):
        self.store = store
        self.lock_held = False
        self.bind = type('Bind', (), {'dialect': type('Dialect', (), {'name': 'postgresql'})()})()

    def execute(self, query, params=None):
        sql = str(query).lower()
        params = params or {}
        if 'pg_advisory_xact_lock' in sql:
            self.store.lock.acquire()
            self.lock_held = True
            return Result()
        if 'to_char(current_date' in sql:
            return Result(value='2026-08')
        if 'from public.query_usage_counters' in sql:
            counter = self.store.counters.get(self.store.key_for(params))
            return Result(rows=[counter.copy()] if counter else [])
        if 'update public.query_usage_counters' in sql:
            counter = self.store.counters[self.store.key_for(params)]
            if 'blocked_queries' in sql:
                counter['blocked_queries'] += 1
            else:
                counter['total_queries'] += 1
                counter['overage_queries'] += int(params.get('overage_increment', 0))
            return Result()
        if 'insert into public.query_usage_counters' in sql:
            counter = self.store.counters.setdefault(
                self.store.key_for(params),
                {'total_queries': 0, 'blocked_queries': 0, 'overage_queries': 0},
            )
            if 'overage_increment' in params:
                counter['total_queries'] += 1
                counter['overage_queries'] += int(params.get('overage_increment', 0))
            else:
                counter['blocked_queries'] += 1
            return Result()
        raise AssertionError(f'Consulta inesperada no fake de concorrência: {sql}')

    def commit(self):
        if self.lock_held:
            self.lock_held = False
            self.store.lock.release()

    def rollback(self):
        self.commit()


class SharedSessionStore:
    def __init__(self):
        self.lock = RLock()
        self.active = set()

    def key_for(self, tenant_code, session_key):
        return (str(tenant_code).strip().lower(), session_key)


class ConcurrentSessionDB:
    def __init__(self, store):
        self.store = store
        self.lock_held = False
        self.bind = type('Bind', (), {'dialect': type('Dialect', (), {'name': 'postgresql'})()})()

    def execute(self, query, params=None):
        sql = str(query).lower()
        params = params or {}
        if 'pg_advisory_xact_lock' in sql:
            self.store.lock.acquire()
            self.lock_held = True
            return Result()
        if 'update public.concurrent_sessions' in sql and "session_status = 'released'" in sql:
            self.store.active.discard(self.store.key_for(params['tenant_code'], params['session_key']))
            return Result()
        if 'update public.concurrent_sessions' in sql:
            return Result()
        if 'select id' in sql and 'public.concurrent_sessions' in sql:
            key = self.store.key_for(params['tenant_code'], params['session_key'])
            return Result(value=key if key in self.store.active else None)
        if 'select count(*)' in sql and 'public.concurrent_sessions' in sql:
            tenant = str(params['tenant_code']).strip().lower()
            return Result(value=sum(active_tenant == tenant for active_tenant, _ in self.store.active))
        if 'insert into public.concurrent_sessions' in sql:
            self.store.active.add(self.store.key_for(params['tenant_code'], params['session_key']))
            return Result()
        raise AssertionError(f'Consulta inesperada no fake de sessões: {sql}')

    def commit(self):
        if self.lock_held:
            self.lock_held = False
            self.store.lock.release()

    def rollback(self):
        self.commit()


def decision(**overrides):
    values = {
        'allowed': True,
        'mode': 'enforce',
        'tenant_code': 'tenant_alpha',
        'environment_code': 'env_homolog',
        'module_code': 'FAT',
        'contract_id': 'contract-fixture',
        'query_limit': 3,
        'overage_mode': 'block',
        'concurrent_sessions_limit': 2,
        'user_id': 'user-fixture',
    }
    values.update(overrides)
    return EntitlementDecision(**values)


def run_concurrently(function, count):
    with ThreadPoolExecutor(max_workers=count) as executor:
        return list(executor.map(function, range(count)))


def test_query_reservation_is_atomic_under_concurrency():
    guard = EntitlementGuard(mode='enforce')
    store = SharedUsageStore()
    start = Barrier(8)

    def attempt(index):
        start.wait()
        try:
            guard._reserve_query(ConcurrentUsageDB(store), decision(), f'corr-{index}')
            return 'allowed'
        except EntitlementDenied as exc:
            return exc.code

    outcomes = run_concurrently(attempt, 8)

    assert outcomes.count('allowed') == 3
    assert outcomes.count('QUERY_LIMIT_EXCEEDED') == 5
    counter = store.counters[('tenant_alpha', 'contract-fixture', '2026-08')]
    assert counter['total_queries'] == 3
    assert counter['blocked_queries'] == 5


def test_query_reservation_counts_overage_without_crossing_the_counter():
    guard = EntitlementGuard(mode='enforce')
    store = SharedUsageStore()
    start = Barrier(6)

    def attempt(index):
        start.wait()
        guard._reserve_query(
            ConcurrentUsageDB(store),
            decision(overage_mode='allow'),
            f'corr-overage-{index}',
        )
        return 'allowed'

    outcomes = run_concurrently(attempt, 6)

    assert outcomes == ['allowed'] * 6
    counter = store.counters[('tenant_alpha', 'contract-fixture', '2026-08')]
    assert counter['total_queries'] == 6
    assert counter['overage_queries'] == 3
    assert counter['blocked_queries'] == 0


def test_query_counters_are_isolated_by_tenant():
    guard = EntitlementGuard(mode='enforce')
    store = SharedUsageStore()
    start = Barrier(2)

    def attempt(tenant):
        start.wait()
        guard._reserve_query(
            ConcurrentUsageDB(store),
            decision(tenant_code=tenant, query_limit=1),
            f'corr-{tenant}',
        )
        return tenant

    assert set(run_concurrently(attempt, 2)) == {'tenant_alpha', 'tenant_beta'}

    with pytest.raises(EntitlementDenied) as alpha_error:
        guard._reserve_query(
            ConcurrentUsageDB(store),
            decision(tenant_code='tenant_alpha', query_limit=1),
            'corr-alpha-blocked',
        )
    with pytest.raises(EntitlementDenied) as beta_error:
        guard._reserve_query(
            ConcurrentUsageDB(store),
            decision(tenant_code='tenant_beta', query_limit=1),
            'corr-beta-blocked',
        )

    assert alpha_error.value.code == 'QUERY_LIMIT_EXCEEDED'
    assert beta_error.value.code == 'QUERY_LIMIT_EXCEEDED'
    assert set(store.counters) == {
        ('tenant_alpha', 'contract-fixture', '2026-08'),
        ('tenant_beta', 'contract-fixture', '2026-08'),
    }
    assert all(counter['total_queries'] == 1 for counter in store.counters.values())
    assert all(counter['blocked_queries'] == 1 for counter in store.counters.values())


def test_concurrent_session_limit_is_atomic_and_release_allows_next_session():
    guard = EntitlementGuard(mode='enforce')
    store = SharedSessionStore()
    start = Barrier(8)

    def attempt(index):
        start.wait()
        session_key = f'session-{index}'
        try:
            guard._acquire_session(ConcurrentSessionDB(store), decision(), session_key, 'user-fixture')
            return session_key
        except EntitlementDenied as exc:
            return exc.code

    outcomes = run_concurrently(attempt, 8)

    successful = [value for value in outcomes if value.startswith('session-')]
    assert len(successful) == 2
    assert outcomes.count('CONCURRENT_SESSION_LIMIT_EXCEEDED') == 6
    assert len(store.active) == 2

    guard.release_session(ConcurrentSessionDB(store), 'tenant_alpha', successful[0])
    guard._acquire_session(ConcurrentSessionDB(store), decision(), 'session-after-release', 'user-fixture')
    assert len(store.active) == 2
    assert ('tenant_alpha', 'session-after-release') in store.active


def test_session_leases_are_tenant_scoped_and_same_key_is_idempotent_per_tenant():
    guard = EntitlementGuard(mode='enforce')
    store = SharedSessionStore()
    shared_key = 'same-session-key'

    guard._acquire_session(
        ConcurrentSessionDB(store),
        decision(tenant_code='tenant_alpha', concurrent_sessions_limit=1),
        shared_key,
        'user-alpha',
    )
    guard._acquire_session(
        ConcurrentSessionDB(store),
        decision(tenant_code='tenant_alpha', concurrent_sessions_limit=1),
        shared_key,
        'user-alpha-refresh',
    )
    guard._acquire_session(
        ConcurrentSessionDB(store),
        decision(tenant_code='tenant_beta', concurrent_sessions_limit=1),
        shared_key,
        'user-beta',
    )

    assert store.active == {
        ('tenant_alpha', shared_key),
        ('tenant_beta', shared_key),
    }

    guard.release_session(ConcurrentSessionDB(store), 'tenant_alpha', shared_key)
    assert store.active == {('tenant_beta', shared_key)}


class DocumentDB:
    def __init__(self, documents, schema='tenant_alpha'):
        self.documents = list(documents)
        self.schema = schema
        self.queries = []

    def execute(self, query, params=None):
        sql = str(query)
        params = params or {}
        self.queries.append((sql, params))
        if 'SELECT current_schema()' in sql:
            return Result(value=self.schema)
        if 'information_schema.columns' in sql:
            columns = [
                'id', 'tenant_id', 'visibility', 'title', 'source_path',
                'source_type', 'module', 'category', 'version', 'status',
                'checksum', 'language', 'created_at', 'updated_at',
            ]
            return Result(rows=[{'column_name': column} for column in columns])
        if 'FROM "documents"' in sql:
            tenant_id = params['tenant_id']
            rows = [
                row for row in self.documents
                if row['visibility'] == 'shared'
                or (row['visibility'] == 'tenant' and row['tenant_id'] == tenant_id)
            ]
            return Result(rows=rows)
        raise AssertionError(f'Consulta inesperada no fake de isolamento: {sql}')

    def rollback(self):
        pass


def test_document_crud_returns_only_requested_tenant_and_shared_documents():
    db = DocumentDB([
        {'id': 1, 'tenant_id': 'tenant_alpha', 'visibility': 'tenant', 'title': 'alpha'},
        {'id': 2, 'tenant_id': 'tenant_beta', 'visibility': 'tenant', 'title': 'beta'},
        {'id': 3, 'tenant_id': 'global', 'visibility': 'shared', 'title': 'shared'},
    ])

    rows = KnowledgeCRUD(db).list_documents('tenant_alpha')

    assert {row['id'] for row in rows} == {1, 3}
    assert all(row['visibility'] == 'shared' or row['tenant_id'] == 'tenant_alpha' for row in rows)
    document_queries = [params for query, params in db.queries if 'FROM "documents"' in query]
    assert document_queries[-1]['tenant_id'] == 'tenant_alpha'


def test_get_db_sets_tenant_search_path_and_resets_it(monkeypatch):
    class SearchPathDB:
        def __init__(self):
            self.paths = []
            self.commits = 0
            self.closed = False

        def execute(self, query, params=None):
            sql = str(query)
            if 'SET search_path TO' in sql:
                self.paths.append(sql)
            return Result()

        def commit(self):
            self.commits += 1

        def close(self):
            self.closed = True

    db = SearchPathDB()
    monkeypatch.setattr(database, 'SessionLocal', lambda: db)
    monkeypatch.setattr(database, 'ensure_public_tables', lambda _db: None)
    monkeypatch.setattr(database, 'resolve_clean_tenant', lambda _db, _tenant: 'tenant_alpha')
    monkeypatch.setattr(database, 'ensure_tenant_tables', lambda _db, _schema: None)

    generator = database.get_db(x_tenant_id='tenant_alpha')
    assert next(generator) is db
    with pytest.raises(StopIteration):
        next(generator)

    assert db.paths[0] == 'SET search_path TO "tenant_alpha", public'
    assert db.paths[-1] == 'SET search_path TO public'
    assert db.closed is True


def test_queryrest_rejects_payload_from_different_jwt_tenant():
    payload = QueryRestProxyRequest(
        tenant_id='tenant_beta',
        environment_code='env_homolog',
        query="SELECT A1_COD FROM SA1010 A1 WHERE A1.D_E_L_E_T_ <> '*' FETCH FIRST 1 ROWS ONLY",
    )

    with pytest.raises(HTTPException) as error:
        asyncio.run(queryrest_proxy(payload, {'tenant_id': 'tenant_alpha'}))

    assert error.value.status_code == 403
    assert 'não corresponde' in str(error.value.detail)
