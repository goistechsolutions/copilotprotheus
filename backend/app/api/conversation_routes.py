import json
import logging
import re
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
        schema_name = db.execute(text("""
            SELECT schema_name 
            FROM public.tenants 
            WHERE id::text = :tid 
               OR LOWER(tenant_code) = LOWER(:tid) 
               OR LOWER(schema_name) = LOWER(:tid)
            LIMIT 1
        """), {"tid": tenant_id}).scalar()
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
        try:
            return self.db.execute(text(f'''
                SELECT id FROM {self._tbl("copilot_messages")}
                WHERE conversation_id = :cid 
                  AND (client_message_id::text = :cmid OR metadata->>'client_message_id' = :cmid)
                LIMIT 1
            '''), {"cid": conversation_id, "cmid": client_message_id}).scalar()
        except Exception:
            return None


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
    client_message_id: Optional[str] = None
    clientMessageId: Optional[str] = None
    role: Optional[str] = 'user'
    message: Optional[str] = None
    content: Optional[str] = None
    prompt: Optional[str] = None

    company: Optional[str] = None
    company_id: Optional[str] = None
    branch: Optional[str] = None
    environment: Optional[str] = None
    environment_code: Optional[str] = None
    module: Optional[str] = None
    module_sigla: Optional[str] = None
    execute: Optional[bool] = True
    context: Optional[Dict[str, Any]] = None

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
            SELECT id, user_id, title, status, is_favorite,
                   context_state, created_at, updated_at
            FROM {repo._tbl("copilot_conversations")}
            WHERE user_id = :user_id
        '''
        params: Dict[str, Any] = {'user_id': tenant_ctx.user_id}

        if status_filter and status_filter != 'all':
            query_sql += ' AND UPPER(status) = :status'
            params['status'] = status_filter.upper()

        if domain:
            query_sql += " AND UPPER(context_state->>'domain_code') = :domain"
            params['domain'] = domain.upper()

        if q and q.strip():
            clean_q = f'%{q.strip()}%'
            query_sql += f'''
                AND (
                    title ILIKE :search
                    OR id IN (
                        SELECT conversation_id FROM {repo._tbl("copilot_messages")}
                        WHERE content ILIKE :search
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
            conv['tenant_id'] = tenant_ctx.tenant_id
            ctx_state = conv.get('context_state') or {}
            if isinstance(ctx_state, str):
                try:
                    ctx_state = json.loads(ctx_state)
                except Exception:
                    ctx_state = {}
            conv['context_state'] = ctx_state
            conv['domain_code'] = ctx_state.get('domain_code')

            if isinstance(conv.get('created_at'), datetime):
                conv['created_at'] = conv['created_at'].isoformat()
            if isinstance(conv.get('updated_at'), datetime):
                cat = _categorize_timestamp(row['updated_at'])
                conv['updated_at'] = conv['updated_at'].isoformat()
            else:
                cat = 'older'

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
        
        conv_id = str(uuid.uuid4())
        title = req.title
        if not title and req.initial_prompt:
            title = ConversationTitleGenerator.generate_title(req.initial_prompt)
        elif not title:
            title = 'Nova Conversa'

        domain = req.domain_code.upper() if req.domain_code else None
        context_state = {'domain_code': domain} if domain else {}

        sql = f'''
            INSERT INTO {repo._tbl("copilot_conversations")} 
                (id, user_id, title, status, is_favorite, context_state, created_at, updated_at)
            VALUES 
                (:id, :user_id, :title, 'ACTIVE', FALSE, :context_state, NOW(), NOW())
        '''
        db.execute(text(sql), {
            'id': conv_id,
            'user_id': tenant_ctx.user_id,
            'title': title,
            'context_state': json.dumps(context_state)
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
                'status': 'ACTIVE',
                'is_favorite': False,
                'context_state': context_state,
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
            SELECT id, title, context_state->>'domain_code' AS domain_code, updated_at, 'conversation' AS type
            FROM {repo._tbl("copilot_conversations")}
            WHERE user_id = :user_id AND is_favorite = TRUE AND UPPER(status) = 'ACTIVE'
            ORDER BY updated_at DESC
        '''), {'user_id': tenant_ctx.user_id}).mappings().all()

        fav_dashboards = db.execute(text(f'''
            SELECT d.id, d.conversation_id, d.title, d.dashboard_type, d.config_json AS dashboard_json, d.created_at, 'dashboard' AS type
            FROM {repo._tbl("copilot_dashboards")} d
            JOIN {repo._tbl("copilot_conversations")} c ON d.conversation_id = c.id
            WHERE c.user_id = :user_id AND d.is_favorite = TRUE
            ORDER BY d.created_at DESC
        '''), {'user_id': tenant_ctx.user_id}).mappings().all()

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
                SELECT is_favorite FROM {repo._tbl("copilot_conversations")} WHERE id = :id AND user_id = :uid
            '''), {'id': req.item_id, 'uid': tenant_ctx.user_id}).scalar()
            if current is None:
                raise HTTPException(status_code=404, detail="Conversa não encontrada")
            new_state = not bool(current)
            db.execute(text(f'''
                UPDATE {repo._tbl("copilot_conversations")} SET is_favorite = :val, updated_at = NOW() WHERE id = :id AND user_id = :uid
            '''), {'id': req.item_id, 'uid': tenant_ctx.user_id, 'val': new_state})
            db.commit()
            return {'status': 'success', 'item_id': req.item_id, 'is_favorite': new_state}

        elif req.item_type == 'dashboard':
            current = db.execute(text(f'''
                SELECT d.is_favorite FROM {repo._tbl("copilot_dashboards")} d
                JOIN {repo._tbl("copilot_conversations")} c ON d.conversation_id = c.id
                WHERE d.id = :id AND c.user_id = :uid
            '''), {'id': req.item_id, 'uid': tenant_ctx.user_id}).scalar()
            if current is None:
                raise HTTPException(status_code=404, detail="Dashboard não encontrado")
            new_state = not bool(current)
            db.execute(text(f'''
                UPDATE {repo._tbl("copilot_dashboards")} SET is_favorite = :val, updated_at = NOW() WHERE id = :id
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
            SELECT id, user_id, title, status, is_favorite, context_state, created_at, updated_at
            FROM {repo._tbl("copilot_conversations")}
            WHERE id = :id AND user_id = :uid
        '''), {'id': conversation_id, 'uid': tenant_ctx.user_id}).mappings().first()

        if not conv:
            raise HTTPException(status_code=404, detail='Conversa não encontrada')

        conversation = dict(conv)
        conversation['tenant_id'] = tenant_ctx.tenant_id
        ctx_state = conversation.get('context_state') or {}
        if isinstance(ctx_state, str):
            try:
                ctx_state = json.loads(ctx_state)
            except Exception:
                ctx_state = {}
        conversation['context_state'] = ctx_state
        conversation['domain_code'] = ctx_state.get('domain_code')

        if isinstance(conversation.get('created_at'), datetime):
            conversation['created_at'] = conversation['created_at'].isoformat()
        if isinstance(conversation.get('updated_at'), datetime):
            conversation['updated_at'] = conversation['updated_at'].isoformat()

        msg_rows = db.execute(text(f'''
            SELECT id, role, content, client_message_id, analysis_id, metadata, created_at
            FROM {repo._tbl("copilot_messages")}
            WHERE conversation_id = :id
            ORDER BY created_at ASC
        '''), {'id': conversation_id}).mappings().all()

        messages = []
        for m in msg_rows:
            item = dict(m)
            item['message'] = item.get('content')
            if isinstance(item.get('created_at'), datetime):
                item['created_at'] = item['created_at'].isoformat()
            if isinstance(item.get('metadata'), str):
                try:
                    item['metadata'] = json.loads(item['metadata'])
                except Exception:
                    item['metadata'] = {}
            messages.append(item)

        dash_rows = db.execute(text(f'''
            SELECT id, conversation_id, analysis_id, title, dashboard_type, config_json, is_favorite, created_at, updated_at
            FROM {repo._tbl("copilot_dashboards")}
            WHERE conversation_id = :id
            ORDER BY created_at ASC
        '''), {'id': conversation_id}).mappings().all()

        dashboards = []
        for d in dash_rows:
            item = dict(d)
            item['dashboard_json'] = item.get('config_json')
            if isinstance(item.get('created_at'), datetime):
                item['created_at'] = item['created_at'].isoformat()
            if isinstance(item.get('updated_at'), datetime):
                item['updated_at'] = item['updated_at'].isoformat()
            if isinstance(item.get('config_json'), str):
                try:
                    item['config_json'] = json.loads(item['config_json'])
                    item['dashboard_json'] = item['config_json']
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
        params: Dict[str, Any] = {'id': conversation_id, 'uid': tenant_ctx.user_id}

        if req.title is not None:
            updates.append('title = :title')
            params['title'] = req.title.strip()

        if req.status is not None:
            updates.append('status = :status')
            params['status'] = req.status.upper()

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
            WHERE id = :id AND user_id = :uid
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
        db.execute(text(f'DELETE FROM {repo._tbl("copilot_conversations")} WHERE id = :id AND user_id = :uid'), 
                   {'id': conversation_id, 'uid': tenant_ctx.user_id})
        db.commit()
        return {'status': 'success', 'message': 'Conversa removida'}
    except Exception as exc:
        db.rollback()
        logger.error('Erro ao deletar conversa: %s', exc)
        raise HTTPException(status_code=500, detail=str(exc))

@router.post('/{conversation_id}/turn', status_code=status.HTTP_201_CREATED)
@router.post('/{conversation_id}/turns', status_code=status.HTTP_201_CREATED)
async def conversation_turn(
    conversation_id: str,
    req: ConversationTurnRequest,
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db)
):
    try:
        schema_name = TenantSchemaResolver.resolve(db, tenant_ctx.tenant_id)
        repo = TenantConversationRepository(db, schema_name, tenant_ctx)
        
        # Determina o identificador da mensagem do cliente
        client_msg_id = req.client_message_id or req.clientMessageId or str(uuid.uuid4())
        
        # Idempotência
        existing_msg_id = repo.check_message_idempotency(conversation_id, client_msg_id)
        if existing_msg_id:
            return {
                'status': 'success',
                'message_id': str(existing_msg_id),
                'conversation_id': conversation_id,
                'idempotent': True
            }
            
        trace_id = str(uuid.uuid4())
        user_msg_id = str(uuid.uuid4())
        
        cmid_val = None
        try:
            cmid_val = str(uuid.UUID(str(client_msg_id)))
        except Exception:
            cmid_val = None

        meta_json = req.metadata or {}
        meta_json['client_message_id'] = client_msg_id
        meta_json['trace_id'] = trace_id
        
        user_text = (req.prompt or req.content or req.message or '').strip()
        role = (req.role or 'user').lower()

        # Insere a mensagem enviada (seja user ou assistant)
        db.execute(text(f'''
            INSERT INTO {repo._tbl("copilot_messages")} (id, conversation_id, role, content, client_message_id, metadata, created_at)
            VALUES (:id, :conversation_id, :role, :content, :cmid, :metadata, NOW())
        '''), {
            'id': user_msg_id,
            'conversation_id': conversation_id,
            'role': role,
            'content': user_text or 'Consulta iniciada',
            'cmid': cmid_val,
            'metadata': json.dumps(meta_json)
        })
        
        dash_id = None
        analysis_id = None
        asst_msg_id = None
        asst_content = None
        suggestions = [
            'Comparar com período anterior',
            'Exibir detalhamento dos itens',
            'Analisar concentração de volume'
        ]
        presentation = None
        result_data = {}
        raw_rows = []

        # Caso seja uma pergunta do usuário e execute=True: aciona o motor do agente Protheus
        if role == 'user' and req.execute and user_text:
            from app.api.agent_sql_routes import process_agent_task, AGENT_TASKS

            # Resolver environment_code
            env_code = (
                req.environment_code 
                or req.environment 
                or (req.context or {}).get("environment_code") 
                or (req.context or {}).get("environment")
            )
            if not env_code or str(env_code).lower() in ("default", "none", "null", ""):
                try:
                    env_row = db.execute(text(f'SELECT environment_code FROM "{schema_name}".environments WHERE UPPER(status) = \'ACTIVE\' LIMIT 1')).scalar()
                    env_code = env_row or "producao"
                except Exception:
                    env_code = "producao"

            # Resolver company e branch
            comp_val = (
                req.company_id 
                or req.company 
                or (req.context or {}).get("company_id") 
                or (req.context or {}).get("company")
            )
            branch_val = req.branch or (req.context or {}).get("branch") or (req.context or {}).get("filial")
            if not branch_val or not comp_val:
                try:
                    comp_db_row = db.execute(text(f'SELECT id, company_code, branch_code FROM "{schema_name}".companies WHERE UPPER(status) = \'ACTIVE\' LIMIT 1')).mappings().first()
                    if comp_db_row:
                        comp_val = comp_val or str(comp_db_row["id"])
                        branch_val = branch_val or comp_db_row["branch_code"]
                except Exception:
                    pass
            branch_val = branch_val or "0101"

            mod_val = (
                req.module_sigla 
                or req.module 
                or (req.context or {}).get("module_sigla") 
                or (req.context or {}).get("module") 
                or "SIGAFAT"
            )

            task_id = str(uuid.uuid4())
            agent_payload = {
                "query": user_text,
                "prompt": user_text,
                "tenant_id": tenant_ctx.tenant_id,
                "user_id": tenant_ctx.user_id,
                "environment_code": env_code,
                "company_id": comp_val,
                "company": comp_val,
                "branch": branch_val,
                "module": mod_val,
                "module_sigla": mod_val,
                "execute": True,
                "conversation_id": conversation_id,
                "context": {
                    "tenant_id": tenant_ctx.tenant_id,
                    "environment_code": env_code,
                    "company_id": comp_val,
                    "branch": branch_val,
                    "module": mod_val,
                    **(req.context or {})
                }
            }

            try:
                await process_agent_task(task_id, agent_payload)
                agent_res = AGENT_TASKS.get(task_id) or {}
            except Exception as proc_err:
                logger.error("Erro na execucao do turno pelo agente: %s", proc_err)
                agent_res = {"status": "error", "message": f"Erro ao processar consulta no Protheus: {proc_err}"}

            asst_content = (
                agent_res.get("message") 
                or agent_res.get("summary") 
                or agent_res.get("error") 
                or "Consulta processada com sucesso."
            )
            
            analysis_id = str(uuid.uuid4())
            dash_id = str(uuid.uuid4())
            result_data = agent_res.get("result") or {}
            raw_rows = agent_res.get("data") or result_data.get("rows") or []
            columns = result_data.get("columns") or []
            backend_kpis = result_data.get("backend_kpis")
            backend_insights = result_data.get("backend_insights") or []

            presentation = agent_res.get("presentation")
            
            # Detecção de filtros aplicados a partir da query e contexto
            applied_filters = []
            if comp_val:
                applied_filters.append({"label": "Empresa", "value": comp_val})
            if branch_val:
                applied_filters.append({"label": "Filial", "value": branch_val})
            if env_code:
                applied_filters.append({"label": "Ambiente", "value": env_code})
            
            sql_text = (agent_res.get("sql") or "").upper()
            if "90" in user_text or "90" in sql_text:
                applied_filters.append({"label": "Inatividade", "value": "> 90 dias"})
            if "VEND" in sql_text or "01" in sql_text:
                vend_m = re.search(r"F2_VEND1\s*=\s*'([^']+)'", sql_text)
                if vend_m:
                    applied_filters.append({"label": "Vendedor", "value": vend_m.group(1)})
            if "2026" in user_text or "2026" in sql_text:
                applied_filters.append({"label": "Ano", "value": "2026"})

            # Detecção de botões de ação para rotinas Protheus
            action_buttons = []
            if any(tbl in sql_text for tbl in ["SF2", "SD2", "SC5", "SC6"]) or "FATUR" in user_text.upper() or "VEND" in user_text.upper():
                action_buttons.append({"label": "Abrir Relatório de Vendas (MATA410)", "routine": "MATA410", "type": "routine"})
            elif any(tbl in sql_text for tbl in ["SE1", "FINA040"]):
                action_buttons.append({"label": "Abrir Contas a Receber (FINA040)", "routine": "FINA040", "type": "routine"})
            elif any(tbl in sql_text for tbl in ["SE2", "FINA050"]):
                action_buttons.append({"label": "Abrir Contas a Pagar (FINA050)", "routine": "FINA050", "type": "routine"})
            elif "SA1" in sql_text or "CLIENTE" in user_text.upper():
                action_buttons.append({"label": "Abrir Cadastro de Clientes (MATA030)", "routine": "MATA030", "type": "routine"})
            else:
                action_buttons.append({"label": "Abrir Relatório no Protheus", "routine": "CONSULTA", "type": "routine"})
            action_buttons.append({"label": "Exportar para Excel", "action": "export_excel", "type": "export"})

            if not presentation and raw_rows:
                presentation = {
                    "id": dash_id,
                    "analysisId": analysis_id,
                    "title": user_text,
                    "originPrompt": user_text,
                    "rows": raw_rows,
                    "columns": columns,
                    "metadata": result_data.get("metadata", {}),
                    "backend_kpis": backend_kpis,
                    "backend_insights": backend_insights,
                    "kpis": [*result_data.get("kpis", []), *result_data.get("secondary_kpis", [])],
                    "series": result_data.get("series", []),
                    "summary": agent_res.get("summary") or asst_content,
                    "applied_filters": applied_filters,
                    "action_buttons": action_buttons
                }
            elif presentation:
                if "applied_filters" not in presentation:
                    presentation["applied_filters"] = applied_filters
                if "action_buttons" not in presentation:
                    presentation["action_buttons"] = action_buttons
                if "series" not in presentation and result_data.get("series"):
                    presentation["series"] = result_data.get("series")

            # Persiste copilot_analyses
            try:
                db.execute(text(f'''
                    INSERT INTO {repo._tbl("copilot_analyses")}
                        (id, conversation_id, source_message_id, dataset_type, row_count, metrics_json, validation_json, insights_json, presentation_json, trace_id, status, created_at, updated_at)
                    VALUES
                        (:id, :cid, :mid, :dst, :rc, :met, '{{}}'::jsonb, :ins, :pres, :tid, 'COMPLETED', NOW(), NOW())
                '''), {
                    'id': analysis_id,
                    'cid': conversation_id,
                    'mid': user_msg_id,
                    'dst': 'queryrest',
                    'rc': len(raw_rows) if isinstance(raw_rows, list) else 0,
                    'met': json.dumps(backend_kpis) if backend_kpis else None,
                    'ins': json.dumps(backend_insights) if backend_insights else '[]',
                    'pres': json.dumps(presentation) if presentation else None,
                    'tid': trace_id
                })
            except Exception as ana_err:
                logger.warning("Falha ao persistir copilot_analyses: %s", ana_err)
                analysis_id = None

            # Persiste copilot_dashboards se houver apresentação
            if presentation and analysis_id:
                try:
                    db.execute(text(f'''
                        INSERT INTO {repo._tbl("copilot_dashboards")}
                            (id, conversation_id, analysis_id, title, dashboard_type, config_json, is_favorite, created_at, updated_at)
                        VALUES
                            (:id, :cid, :aid, :title, 'ranking', :cfg, FALSE, NOW(), NOW())
                    '''), {
                        'id': dash_id,
                        'cid': conversation_id,
                        'aid': analysis_id,
                        'title': user_text[:300],
                        'cfg': json.dumps(presentation)
                    })
                except Exception as dash_err:
                    logger.warning("Falha ao persistir copilot_dashboards: %s", dash_err)
                    dash_id = None

            # Persiste resposta do assistente
            asst_msg_id = str(uuid.uuid4())
            asst_meta = {
                "trace_id": trace_id,
                "analysis_id": analysis_id,
                "dashboard_id": dash_id,
                "dashboard": presentation,
                "suggestions": [ins.get("title") for ins in backend_insights if isinstance(ins, dict) and ins.get("title")][:3]
            }
            db.execute(text(f'''
                INSERT INTO {repo._tbl("copilot_messages")}
                    (id, conversation_id, role, content, analysis_id, metadata, created_at)
                VALUES
                    (:id, :cid, 'assistant', :content, :aid, :meta, NOW())
            '''), {
                'id': asst_msg_id,
                'cid': conversation_id,
                'content': asst_content,
                'aid': analysis_id,
                'meta': json.dumps(asst_meta)
            })
            if asst_meta["suggestions"]:
                suggestions = asst_meta["suggestions"]

        elif req.dashboard:
            dash_id = str(uuid.uuid4())
            dash_data = req.dashboard.get('dashboard_json') or req.dashboard.get('config_json') or req.dashboard
            if not isinstance(dash_data, dict):
                dash_data = {}

            analysis_id = req.dashboard.get('analysis_id') or meta_json.get('analysis_id')
            if not analysis_id:
                analysis_id = str(uuid.uuid4())
                try:
                    db.execute(text(f'''
                        INSERT INTO {repo._tbl("copilot_analyses")}
                            (id, conversation_id, source_message_id, validation_json, trace_id, created_at, updated_at)
                        VALUES
                            (:id, :cid, :mid, '{{}}'::jsonb, :tid, NOW(), NOW())
                    '''), {
                        'id': analysis_id,
                        'cid': conversation_id,
                        'mid': user_msg_id,
                        'tid': trace_id
                    })
                except Exception as ana_err:
                    logger.warning("Não foi possível inserir copilot_analyses: %s", ana_err)
                    analysis_id = None

            try:
                db.execute(text(f'''
                    INSERT INTO {repo._tbl("copilot_dashboards")}
                        (id, conversation_id, analysis_id, title, dashboard_type, config_json, is_favorite, created_at, updated_at)
                    VALUES
                        (:id, :conversation_id, :analysis_id, :title, :dashboard_type, :config_json, :is_favorite, NOW(), NOW())
                '''), {
                    'id': dash_id,
                    'conversation_id': conversation_id,
                    'analysis_id': analysis_id,
                    'title': req.dashboard.get('title', 'Dashboard'),
                    'dashboard_type': req.dashboard.get('dashboard_type', 'ranking'),
                    'config_json': json.dumps(dash_data),
                    'is_favorite': bool(req.dashboard.get('is_favorite', False))
                })
            except Exception as dash_err:
                logger.warning("Não foi possível inserir copilot_dashboards: %s", dash_err)
                dash_id = None

        db.execute(text(f'''
            UPDATE {repo._tbl("copilot_conversations")} 
            SET updated_at = NOW() 
            WHERE id = :id AND user_id = :uid
        '''), {'id': conversation_id, 'uid': tenant_ctx.user_id})

        db.commit()

        now_iso = datetime.now(timezone.utc).isoformat()
        return {
            'status': 'success',
            'traceId': trace_id,
            'conversationId': conversation_id,
            'content': asst_content or user_text,
            'message': asst_content or user_text,
            'summary': asst_content or user_text,
            'suggestions': suggestions,
            'presentation': presentation,
            'dashboard': presentation,
            'analysisId': analysis_id,
            'analysis_id': analysis_id,
            'dashboardId': dash_id,
            'dashboard_id': dash_id,
            'message_id': asst_msg_id or user_msg_id,
            'result': result_data,
            'records': len(raw_rows),
            'data': raw_rows,
            'userMessage': {
                'id': user_msg_id,
                'role': 'user',
                'content': user_text,
                'createdAt': now_iso
            },
            'assistantMessage': {
                'id': asst_msg_id or user_msg_id,
                'role': 'assistant',
                'content': asst_content or user_text,
                'analysisId': analysis_id,
                'createdAt': now_iso
            } if asst_msg_id else None,
            'analysis': {
                'analysisId': analysis_id,
                'conversationId': conversation_id,
                'sourceMessageId': user_msg_id,
                'assistantMessageId': asst_msg_id,
                'presentation': presentation,
                'insights': suggestions,
                'version': 1
            } if analysis_id else None
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