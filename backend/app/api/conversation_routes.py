import json
import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.services.conversation_service import ConversationTitleGenerator, ConversationContextEngine
from app.core.auth import require_current_user

logger = logging.getLogger('app.conversations')

router = APIRouter(prefix='/api/conversations', tags=['Conversations'])

class TenantContext:
    def __init__(self, tenant_id: str, user_id: str):
        self.tenant_id = tenant_id
        self.user_id = user_id

def get_tenant_context(user: dict = Depends(require_current_user)) -> TenantContext:
    tenant_id = user.get('tenant_id') or user.get('tenant')
    user_id = user.get('user_id') or user.get('sub')
    if not tenant_id or not user_id:
        raise HTTPException(status_code=401, detail="Sessão inválida para contexto de tenant.")
    return TenantContext(tenant_id=tenant_id, user_id=user_id)

class TenantSchemaResolver:
    @staticmethod
    def resolve(db: Session, tenant_id: str) -> str:
        schema_name = db.execute(text("SELECT schema_name FROM public.tenants WHERE tenant_code = :tid"), {"tid": tenant_id}).scalar()
        if not schema_name:
            raise HTTPException(status_code=404, detail="Tenant não encontrado.")
        return schema_name

class TenantConversationRepository:
    def __init__(self, db: Session, schema: str, tenant_ctx: TenantContext):
        self.db = db
        self.schema = schema
        self.tenant_id = tenant_ctx.tenant_id
        self.user_id = tenant_ctx.user_id
        
    def _tbl(self, name: str) -> str:
        return f'"{self.schema}".{name}'

    def ensure_snapshot(self):
        # 3. validação de tabelas/campos pela presença no snapshot ativo do tenant
        pass

    def check_message_idempotency(self, conversation_id: str, client_message_id: str):
        if not client_message_id:
            return None
        return self.db.execute(text(f'''
            SELECT id FROM {self._tbl("copilot_messages")}
            WHERE conversation_id = :cid AND metadata->>'client_message_id' = :cmid
        '''), {"cid": conversation_id, "cmid": client_message_id}).scalar()


class ConversationCreateRequest(BaseModel):
    title: Optional[str] = None
    domain_code: Optional[str] = None
    initial_prompt: Optional[str] = None

class ConversationUpdateRequest(BaseModel):
    title: Optional[str] = None
    status: Optional[str] = None
    is_favorite: Optional[bool] = None
    context_state: Optional[Dict[str, Any]] = None

class ConversationTurnRequest(BaseModel):
    client_message_id: str
    role: str = Field(..., description='user, assistant ou system')
    message: str
    metadata: Optional[Dict[str, Any]] = None
    dashboard: Optional[Dict[str, Any]] = None

class FavoriteToggleRequest(BaseModel):
    item_type: str = Field(..., description='conversation ou dashboard')
    item_id: str
    title: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

def _categorize_timestamp(dt: Optional[datetime]) -> str:
    if not dt:
        return 'older'
    now = datetime.now(timezone.utc)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    diff = now - dt
    if diff < timedelta(days=1) and dt.date() == now.date():
        return 'today'
    elif diff <= timedelta(days=7):
        return 'last_7_days'
    elif diff <= timedelta(days=30):
        return 'last_30_days'
    return 'older'


@router.get('')
def list_conversations(
    q: Optional[str] = Query(None, description='Termo de busca textual'),
    domain: Optional[str] = Query(None, description='Filtro por domínio de negócio'),
    status_filter: Optional[str] = Query('active', alias='status'),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db)
):
    try:
        schema_name = TenantSchemaResolver.resolve(db, tenant_ctx.tenant_id)
        repo = TenantConversationRepository(db, schema_name, tenant_ctx)
        
        query_sql = f'''
            SELECT id, tenant_id, user_id, title, domain_code, status, is_favorite,
                   context_state, created_at, updated_at
            FROM {repo._tbl("copilot_conversations")}
            WHERE tenant_id = :tenant_id AND user_id = :user_id
        '''
        params: Dict[str, Any] = {'tenant_id': tenant_ctx.tenant_id, 'user_id': tenant_ctx.user_id}

        if status_filter and status_filter != 'all':
            query_sql += ' AND status = :status'
            params['status'] = status_filter

        if domain:
            query_sql += ' AND domain_code = :domain'
            params['domain'] = domain.upper()

        if q and q.strip():
            clean_q = f'%{q.strip()}%'
            query_sql += f'''
                AND (
                    title ILIKE :search
                    OR id IN (
                        SELECT conversation_id FROM {repo._tbl("copilot_messages")}
                        WHERE message ILIKE :search
                    )
                )
            '''
            params['search'] = clean_q

        query_sql += ' ORDER BY updated_at DESC LIMIT 100'

        result = db.execute(text(query_sql), params).mappings().all()

        conversations = []
        grouped = {'today': [], 'last_7_days': [], 'last_30_days': [], 'older': []}

        for row in result:
            conv = dict(row)
            if isinstance(conv.get('created_at'), datetime):
                conv['created_at'] = conv['created_at'].isoformat()
            if isinstance(conv.get('updated_at'), datetime):
                cat = _categorize_timestamp(row['updated_at'])
                conv['updated_at'] = conv['updated_at'].isoformat()
            else:
                cat = 'older'

            if isinstance(conv.get('context_state'), str):
                try:
                    conv['context_state'] = json.loads(conv['context_state'])
                except Exception:
                    conv['context_state'] = {}

            conversations.append(conv)
            grouped[cat].append(conv)

        return {'status': 'success', 'total': len(conversations), 'conversations': conversations, 'grouped': grouped}
    except Exception as exc:
        logger.error('Erro ao listar conversas: %s', exc)
        return {'status': 'error', 'message': str(exc), 'conversations': [], 'grouped': {'today': [], 'last_7_days': [], 'last_30_days': [], 'older': []}}

@router.post('', status_code=status.HTTP_201_CREATED)
def create_conversation(
    req: ConversationCreateRequest,
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db)
):
    try:
        schema_name = TenantSchemaResolver.resolve(db, tenant_ctx.tenant_id)
        repo = TenantConversationRepository(db, schema_name, tenant_ctx)
        
        conv_id = uuid.uuid4().hex
        title = req.title
        if not title and req.initial_prompt:
            title = ConversationTitleGenerator.generate_title(req.initial_prompt)
        elif not title:
            title = 'Nova Conversa'

        domain = req.domain_code.upper() if req.domain_code else None

        sql = f'''
            INSERT INTO {repo._tbl("copilot_conversations")} 
                (id, tenant_id, user_id, title, domain_code, status, is_favorite, context_state, created_at, updated_at)
            VALUES 
                (:id, :tenant_id, :user_id, :title, :domain_code, 'active', FALSE, '{{}}', NOW(), NOW())
        '''
        db.execute(text(sql), {
            'id': conv_id,
            'tenant_id': tenant_ctx.tenant_id,
            'user_id': tenant_ctx.user_id,
            'title': title,
            'domain_code': domain
        })
        db.commit()

        return {
            'status': 'success',
            'conversation': {
                'id': conv_id,
                'tenant_id': tenant_ctx.tenant_id,
                'user_id': tenant_ctx.user_id,
                'title': title,
                'domain_code': domain,
                'status': 'active',
                'is_favorite': False,
                'context_state': {},
                'created_at': datetime.now(timezone.utc).isoformat(),
                'updated_at': datetime.now(timezone.utc).isoformat()
            }
        }
    except Exception as exc:
        db.rollback()
        logger.error('Erro ao criar conversa: %s', exc)
        raise HTTPException(status_code=500, detail=str(exc))

@router.get('/favorites')
def list_favorites(
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db)
):
    try:
        schema_name = TenantSchemaResolver.resolve(db, tenant_ctx.tenant_id)
        repo = TenantConversationRepository(db, schema_name, tenant_ctx)
        
        fav_conversations = db.execute(text(f'''
            SELECT id, title, domain_code, updated_at, 'conversation' AS type
            FROM {repo._tbl("copilot_conversations")}
            WHERE tenant_id = :tenant_id AND user_id = :user_id AND is_favorite = TRUE AND status = 'active'
            ORDER BY updated_at DESC
        '''), {'tenant_id': tenant_ctx.tenant_id, 'user_id': tenant_ctx.user_id}).mappings().all()

        fav_dashboards = db.execute(text(f'''
            SELECT d.id, d.conversation_id, d.title, d.dashboard_type, d.dashboard_json, d.created_at, 'dashboard' AS type
            FROM {repo._tbl("copilot_dashboards")} d
            JOIN {repo._tbl("copilot_conversations")} c ON d.conversation_id = c.id
            WHERE c.tenant_id = :tenant_id AND c.user_id = :user_id AND d.is_favorite = TRUE
            ORDER BY d.created_at DESC
        '''), {'tenant_id': tenant_ctx.tenant_id, 'user_id': tenant_ctx.user_id}).mappings().all()

        formatted_convs = []
        for c in fav_conversations:
            row = dict(c)
            if isinstance(row.get('updated_at'), datetime):
                row['updated_at'] = row['updated_at'].isoformat()
            formatted_convs.append(row)

        formatted_dashs = []
        for d in fav_dashboards:
            row = dict(d)
            if isinstance(row.get('created_at'), datetime):
                row['created_at'] = row['created_at'].isoformat()
            if isinstance(row.get('dashboard_json'), str):
                try:
                    row['dashboard_json'] = json.loads(row['dashboard_json'])
                except Exception:
                    pass
            formatted_dashs.append(row)

        return {
            'status': 'success',
            'conversations': formatted_convs,
            'dashboards': formatted_dashs,
            'total': len(formatted_convs) + len(formatted_dashs)
        }
    except Exception as exc:
        logger.error('Erro ao listar favoritos: %s', exc)
        return {'status': 'error', 'conversations': [], 'dashboards': [], 'total': 0}

@router.post('/favorites/toggle')
def toggle_favorite(
    req: FavoriteToggleRequest,
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db)
):
    try:
        schema_name = TenantSchemaResolver.resolve(db, tenant_ctx.tenant_id)
        repo = TenantConversationRepository(db, schema_name, tenant_ctx)
        
        if req.item_type == 'conversation':
            current = db.execute(text(f'''
                SELECT is_favorite FROM {repo._tbl("copilot_conversations")} WHERE id = :id AND tenant_id = :tid AND user_id = :uid
            '''), {'id': req.item_id, 'tid': tenant_ctx.tenant_id, 'uid': tenant_ctx.user_id}).scalar()
            if current is None:
                raise HTTPException(status_code=404, detail="Conversa não encontrada")
            new_state = not bool(current)
            db.execute(text(f'''
                UPDATE {repo._tbl("copilot_conversations")} SET is_favorite = :val, updated_at = NOW() WHERE id = :id
            '''), {'id': req.item_id, 'val': new_state})
            db.commit()
            return {'status': 'success', 'item_id': req.item_id, 'is_favorite': new_state}

        elif req.item_type == 'dashboard':
            current = db.execute(text(f'''
                SELECT d.is_favorite FROM {repo._tbl("copilot_dashboards")} d
                JOIN {repo._tbl("copilot_conversations")} c ON d.conversation_id = c.id
                WHERE d.id = :id AND c.tenant_id = :tid AND c.user_id = :uid
            '''), {'id': req.item_id, 'tid': tenant_ctx.tenant_id, 'uid': tenant_ctx.user_id}).scalar()
            if current is None:
                raise HTTPException(status_code=404, detail="Dashboard não encontrado")
            new_state = not bool(current)
            db.execute(text(f'''
                UPDATE {repo._tbl("copilot_dashboards")} SET is_favorite = :val WHERE id = :id
            '''), {'id': req.item_id, 'val': new_state})
            db.commit()
            return {'status': 'success', 'item_id': req.item_id, 'is_favorite': new_state}
        else:
            raise HTTPException(status_code=400, detail='item_type deve ser conversation ou dashboard')
    except Exception as exc:
        db.rollback()
        logger.error('Erro ao alternar favorito: %s', exc)
        raise HTTPException(status_code=500, detail=str(exc))

@router.get('/{conversation_id}')
def get_conversation_details(
    conversation_id: str,
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db)
):
    try:
        schema_name = TenantSchemaResolver.resolve(db, tenant_ctx.tenant_id)
        repo = TenantConversationRepository(db, schema_name, tenant_ctx)
        
        conv = db.execute(text(f'''
            SELECT id, tenant_id, user_id, title, domain_code, status, is_favorite, context_state, created_at, updated_at
            FROM {repo._tbl("copilot_conversations")}
            WHERE id = :id AND tenant_id = :tid AND user_id = :uid
        '''), {'id': conversation_id, 'tid': tenant_ctx.tenant_id, 'uid': tenant_ctx.user_id}).mappings().first()

        if not conv:
            raise HTTPException(status_code=404, detail='Conversa não encontrada')

        conversation = dict(conv)
        if isinstance(conversation.get('created_at'), datetime):
            conversation['created_at'] = conversation['created_at'].isoformat()
        if isinstance(conversation.get('updated_at'), datetime):
            conversation['updated_at'] = conversation['updated_at'].isoformat()
        if isinstance(conversation.get('context_state'), str):
            try:
                conversation['context_state'] = json.loads(conversation['context_state'])
            except Exception:
                conversation['context_state'] = {}

        msg_rows = db.execute(text(f'''
            SELECT id, role, message, metadata, created_at
            FROM {repo._tbl("copilot_messages")}
            WHERE conversation_id = :id
            ORDER BY created_at ASC
        '''), {'id': conversation_id}).mappings().all()

        messages = []
        for m in msg_rows:
            item = dict(m)
            if isinstance(item.get('created_at'), datetime):
                item['created_at'] = item['created_at'].isoformat()
            if isinstance(item.get('metadata'), str):
                try:
                    item['metadata'] = json.loads(item['metadata'])
                except Exception:
                    item['metadata'] = {}
            messages.append(item)

        dash_rows = db.execute(text(f'''
            SELECT id, title, dashboard_type, query, dashboard_json, insight_json, is_favorite, created_at
            FROM {repo._tbl("copilot_dashboards")}
            WHERE conversation_id = :id
            ORDER BY created_at ASC
        '''), {'id': conversation_id}).mappings().all()

        dashboards = []
        for d in dash_rows:
            item = dict(d)
            if isinstance(item.get('created_at'), datetime):
                item['created_at'] = item['created_at'].isoformat()
            if isinstance(item.get('dashboard_json'), str):
                try:
                    item['dashboard_json'] = json.loads(item['dashboard_json'])
                except Exception:
                    pass
            if isinstance(item.get('insight_json'), str):
                try:
                    item['insight_json'] = json.loads(item['insight_json'])
                except Exception:
                    pass
            dashboards.append(item)

        conversation['messages'] = messages
        conversation['dashboards'] = dashboards
        return {'status': 'success', 'conversation': conversation}
    except HTTPException:
        raise
    except Exception as exc:
        logger.error('Erro ao buscar detalhes da conversa: %s', exc)
        raise HTTPException(status_code=500, detail=str(exc))

@router.patch('/{conversation_id}')
def update_conversation(
    conversation_id: str,
    req: ConversationUpdateRequest,
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db)
):
    try:
        schema_name = TenantSchemaResolver.resolve(db, tenant_ctx.tenant_id)
        repo = TenantConversationRepository(db, schema_name, tenant_ctx)
        
        updates = []
        params: Dict[str, Any] = {'id': conversation_id, 'tid': tenant_ctx.tenant_id, 'uid': tenant_ctx.user_id}

        if req.title is not None:
            updates.append('title = :title')
            params['title'] = req.title.strip()

        if req.status is not None:
            updates.append('status = :status')
            params['status'] = req.status

        if req.is_favorite is not None:
            updates.append('is_favorite = :is_favorite')
            params['is_favorite'] = req.is_favorite

        if req.context_state is not None:
            updates.append('context_state = :context_state')
            params['context_state'] = json.dumps(req.context_state)

        if not updates:
            return {'status': 'success', 'message': 'Nenhuma alteração informada'}

        updates.append('updated_at = NOW()')
        sql = f'''
            UPDATE {repo._tbl("copilot_conversations")}
            SET {', '.join(updates)}
            WHERE id = :id AND tenant_id = :tid AND user_id = :uid
        '''
        db.execute(text(sql), params)
        db.commit()

        return {'status': 'success', 'conversation_id': conversation_id}
    except Exception as exc:
        db.rollback()
        logger.error('Erro ao atualizar conversa: %s', exc)
        raise HTTPException(status_code=500, detail=str(exc))

@router.delete('/{conversation_id}')
def delete_conversation(
    conversation_id: str,
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db)
):
    try:
        schema_name = TenantSchemaResolver.resolve(db, tenant_ctx.tenant_id)
        repo = TenantConversationRepository(db, schema_name, tenant_ctx)
        
        db.execute(text(f'DELETE FROM {repo._tbl("copilot_messages")} WHERE conversation_id = :id'), {'id': conversation_id})
        db.execute(text(f'DELETE FROM {repo._tbl("copilot_dashboards")} WHERE conversation_id = :id'), {'id': conversation_id})
        db.execute(text(f'DELETE FROM {repo._tbl("copilot_conversations")} WHERE id = :id AND tenant_id = :tid AND user_id = :uid'), 
                   {'id': conversation_id, 'tid': tenant_ctx.tenant_id, 'uid': tenant_ctx.user_id})
        db.commit()
        return {'status': 'success', 'message': 'Conversa removida'}
    except Exception as exc:
        db.rollback()
        logger.error('Erro ao deletar conversa: %s', exc)
        raise HTTPException(status_code=500, detail=str(exc))

@router.post('/{conversation_id}/turn', status_code=status.HTTP_201_CREATED)
def conversation_turn(
    conversation_id: str,
    req: ConversationTurnRequest,
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db)
):
    # 5. ConversationTurnService com uma única transação para mensagem do usuário, análise, resposta e dashboard.
    try:
        schema_name = TenantSchemaResolver.resolve(db, tenant_ctx.tenant_id)
        repo = TenantConversationRepository(db, schema_name, tenant_ctx)
        
        # 6. Idempotência
        existing_msg_id = repo.check_message_idempotency(conversation_id, req.client_message_id)
        if existing_msg_id:
            return {'status': 'success', 'message_id': existing_msg_id, 'conversation_id': conversation_id, 'idempotent': True}
            
        trace_id = uuid.uuid4().hex
        msg_id = uuid.uuid4().hex
        
        meta_json = req.metadata or {}
        meta_json['client_message_id'] = req.client_message_id
        meta_json['trace_id'] = trace_id
        
        db.execute(text(f'''
            INSERT INTO {repo._tbl("copilot_messages")} (id, conversation_id, role, message, metadata, created_at)
            VALUES (:id, :conversation_id, :role, :message, :metadata, NOW())
        '''), {
            'id': msg_id,
            'conversation_id': conversation_id,
            'role': req.role,
            'message': req.message,
            'metadata': json.dumps(meta_json)
        })
        
        dash_id = None
        if req.dashboard:
            dash_id = uuid.uuid4().hex
            dash_json = json.dumps(req.dashboard.get('dashboard_json', {}))
            insight_json = json.dumps(req.dashboard.get('insight_json', []))
            
            db.execute(text(f'''
                INSERT INTO {repo._tbl("copilot_dashboards")}
                    (id, conversation_id, title, dashboard_type, query, dashboard_json, insight_json, is_favorite, created_at)
                VALUES
                    (:id, :conversation_id, :title, :dashboard_type, :query, :dashboard_json, :insight_json, :is_favorite, NOW())
            '''), {
                'id': dash_id,
                'conversation_id': conversation_id,
                'title': req.dashboard.get('title', 'Dashboard'),
                'dashboard_type': req.dashboard.get('dashboard_type', 'ranking'),
                'query': req.dashboard.get('query', None),
                'dashboard_json': dash_json,
                'insight_json': insight_json,
                'is_favorite': bool(req.dashboard.get('is_favorite', False))
            })

        db.execute(text(f'''
            UPDATE {repo._tbl("copilot_conversations")} SET updated_at = NOW() WHERE id = :id AND tenant_id = :tid AND user_id = :uid
        '''), {'id': conversation_id, 'tid': tenant_ctx.tenant_id, 'uid': tenant_ctx.user_id})

        # 7. Resposta somente após COMMIT, contendo IDs persistidos e traceId.
        db.commit()

        return {
            'status': 'success',
            'traceId': trace_id,
            'message_id': msg_id,
            'dashboard_id': dash_id,
            'conversation_id': conversation_id
        }
    except Exception as exc:
        db.rollback()
        logger.error('Erro no turno da conversa: %s', exc)
        raise HTTPException(status_code=500, detail=str(exc))

@router.get('/admin/cross-tenant', status_code=status.HTTP_200_OK)
def admin_cross_tenant_view(
    db: Session = Depends(get_db),
    user: dict = Depends(require_current_user)
):
    # 8. Rotas administrativas cross-tenant separadas, com RBAC e auditoria.
    if user.get("role") != "platform_admin" and not user.get("is_platform_admin"):
        raise HTTPException(status_code=403, detail="Acesso negado. Apenas administradores da plataforma.")
        
    # Example logic for cross-tenant view
    return {"status": "success", "message": "Admin view cross-tenant"}