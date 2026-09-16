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

logger = logging.getLogger('app.conversations')

router = APIRouter(prefix='/api/conversations', tags=['Conversations'])


class ConversationCreateRequest(BaseModel):
    title: Optional[str] = None
    domain_code: Optional[str] = None
    initial_prompt: Optional[str] = None
    tenant_id: Optional[str] = None
    user_id: Optional[str] = None

class ConversationUpdateRequest(BaseModel):
    title: Optional[str] = None
    status: Optional[str] = None
    is_favorite: Optional[bool] = None
    context_state: Optional[Dict[str, Any]] = None

class MessageCreateRequest(BaseModel):
    role: str = Field(..., description='user, assistant ou system')
    message: str
    metadata: Optional[Dict[str, Any]] = None

class DashboardCreateRequest(BaseModel):
    title: str
    dashboard_type: Optional[str] = 'ranking'
    query: Optional[str] = None
    dashboard_json: Dict[str, Any]
    insight_json: Optional[List[Dict[str, Any]]] = None
    is_favorite: Optional[bool] = False

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
    tenant_id: Optional[str] = Query('rodol_prod'),
    user_id: Optional[str] = Query('admin'),
    db: Session = Depends(get_db)
):
    try:
        query_sql = '''
            SELECT id, tenant_id, user_id, title, domain_code, status, is_favorite,
                   context_state, created_at, updated_at
            FROM public.copilot_conversations
            WHERE tenant_id = :tenant_id
        '''
        params: Dict[str, Any] = {'tenant_id': tenant_id}

        if status_filter and status_filter != 'all':
            query_sql += ' AND status = :status'
            params['status'] = status_filter

        if domain:
            query_sql += ' AND domain_code = :domain'
            params['domain'] = domain.upper()

        if q and q.strip():
            clean_q = f'%{q.strip()}%'
            query_sql += '''
                AND (
                    title ILIKE :search
                    OR id IN (
                        SELECT conversation_id FROM public.copilot_messages
                        WHERE message ILIKE :search
                    )
                )
            '''
            params['search'] = clean_q

        query_sql += ' ORDER BY updated_at DESC LIMIT 100'

        result = db.execute(text(query_sql), params).mappings().all()

        conversations = []
        grouped = {
            'today': [],
            'last_7_days': [],
            'last_30_days': [],
            'older': []
        }

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

        return {
            'status': 'success',
            'total': len(conversations),
            'conversations': conversations,
            'grouped': grouped
        }
    except Exception as exc:
        logger.error('Erro ao listar conversas: %s', exc)
        return {'status': 'error', 'message': str(exc), 'conversations': [], 'grouped': {'today': [], 'last_7_days': [], 'last_30_days': [], 'older': []}}


@router.post('', status_code=status.HTTP_201_CREATED)
def create_conversation(
    req: ConversationCreateRequest,
    db: Session = Depends(get_db)
):
    try:
        conv_id = uuid.uuid4().hex
        tenant = req.tenant_id or 'rodol_prod'
        user = req.user_id or 'admin'
        
        title = req.title
        if not title and req.initial_prompt:
            title = ConversationTitleGenerator.generate_title(req.initial_prompt)
        elif not title:
            title = 'Nova Conversa'

        domain = req.domain_code.upper() if req.domain_code else None

        sql = '''
            INSERT INTO public.copilot_conversations 
                (id, tenant_id, user_id, title, domain_code, status, is_favorite, context_state, created_at, updated_at)
            VALUES 
                (:id, :tenant_id, :user_id, :title, :domain_code, 'active', FALSE, '{}', NOW(), NOW())
        '''
        db.execute(text(sql), {
            'id': conv_id,
            'tenant_id': tenant,
            'user_id': user,
            'title': title,
            'domain_code': domain
        })
        db.commit()

        return {
            'status': 'success',
            'conversation': {
                'id': conv_id,
                'tenant_id': tenant,
                'user_id': user,
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
    tenant_id: Optional[str] = Query('rodol_prod'),
    user_id: Optional[str] = Query('admin'),
    db: Session = Depends(get_db)
):
    try:
        fav_conversations = db.execute(text('''
            SELECT id, title, domain_code, updated_at, 'conversation' AS type
            FROM public.copilot_conversations
            WHERE tenant_id = :tenant_id AND is_favorite = TRUE AND status = 'active'
            ORDER BY updated_at DESC
        '''), {'tenant_id': tenant_id}).mappings().all()

        fav_dashboards = db.execute(text('''
            SELECT d.id, d.conversation_id, d.title, d.dashboard_type, d.dashboard_json, d.created_at, 'dashboard' AS type
            FROM public.copilot_dashboards d
            JOIN public.copilot_conversations c ON d.conversation_id = c.id
            WHERE c.tenant_id = :tenant_id AND d.is_favorite = TRUE
            ORDER BY d.created_at DESC
        '''), {'tenant_id': tenant_id}).mappings().all()

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
    tenant_id: Optional[str] = Query('rodol_prod'),
    user_id: Optional[str] = Query('admin'),
    db: Session = Depends(get_db)
):
    try:
        if req.item_type == 'conversation':
            current = db.execute(text('''
                SELECT is_favorite FROM public.copilot_conversations WHERE id = :id
            '''), {'id': req.item_id}).scalar()
            new_state = not bool(current)
            db.execute(text('''
                UPDATE public.copilot_conversations SET is_favorite = :val, updated_at = NOW() WHERE id = :id
            '''), {'id': req.item_id, 'val': new_state})
            db.commit()
            return {'status': 'success', 'item_id': req.item_id, 'is_favorite': new_state}

        elif req.item_type == 'dashboard':
            current = db.execute(text('''
                SELECT is_favorite FROM public.copilot_dashboards WHERE id = :id
            '''), {'id': req.item_id}).scalar()
            new_state = not bool(current)
            db.execute(text('''
                UPDATE public.copilot_dashboards SET is_favorite = :val WHERE id = :id
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
    db: Session = Depends(get_db)
):
    try:
        conv = db.execute(text('''
            SELECT id, tenant_id, user_id, title, domain_code, status, is_favorite, context_state, created_at, updated_at
            FROM public.copilot_conversations
            WHERE id = :id
        '''), {'id': conversation_id}).mappings().first()

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

        msg_rows = db.execute(text('''
            SELECT id, role, message, metadata, created_at
            FROM public.copilot_messages
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

        dash_rows = db.execute(text('''
            SELECT id, title, dashboard_type, query, dashboard_json, insight_json, is_favorite, created_at
            FROM public.copilot_dashboards
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
    db: Session = Depends(get_db)
):
    try:
        updates = []
        params: Dict[str, Any] = {'id': conversation_id}

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
            UPDATE public.copilot_conversations
            SET {', '.join(updates)}
            WHERE id = :id
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
    db: Session = Depends(get_db)
):
    try:
        db.execute(text('DELETE FROM public.copilot_messages WHERE conversation_id = :id'), {'id': conversation_id})
        db.execute(text('DELETE FROM public.copilot_dashboards WHERE conversation_id = :id'), {'id': conversation_id})
        db.execute(text('DELETE FROM public.copilot_conversations WHERE id = :id'), {'id': conversation_id})
        db.commit()
        return {'status': 'success', 'message': 'Conversa removida'}
    except Exception as exc:
        db.rollback()
        logger.error('Erro ao deletar conversa: %s', exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post('/{conversation_id}/messages', status_code=status.HTTP_201_CREATED)
def add_message(
    conversation_id: str,
    req: MessageCreateRequest,
    db: Session = Depends(get_db)
):
    try:
        msg_id = uuid.uuid4().hex
        meta_json = json.dumps(req.metadata or {})

        db.execute(text('''
            INSERT INTO public.copilot_messages (id, conversation_id, role, message, metadata, created_at)
            VALUES (:id, :conversation_id, :role, :message, :metadata, NOW())
        '''), {
            'id': msg_id,
            'conversation_id': conversation_id,
            'role': req.role,
            'message': req.message,
            'metadata': meta_json
        })

        if req.role == 'user':
            conv = db.execute(text('''
                SELECT title FROM public.copilot_conversations WHERE id = :id
            '''), {'id': conversation_id}).first()
            if conv and conv[0] in ('Nova Conversa', 'Consulta sem título', None):
                auto_title = ConversationTitleGenerator.generate_title(req.message)
                db.execute(text('''
                    UPDATE public.copilot_conversations
                    SET title = :title, updated_at = NOW()
                    WHERE id = :id
                '''), {'id': conversation_id, 'title': auto_title})
            else:
                db.execute(text('''
                    UPDATE public.copilot_conversations SET updated_at = NOW() WHERE id = :id
                '''), {'id': conversation_id})
        else:
            db.execute(text('''
                UPDATE public.copilot_conversations SET updated_at = NOW() WHERE id = :id
            '''), {'id': conversation_id})

        db.commit()

        return {
            'status': 'success',
            'message_id': msg_id,
            'conversation_id': conversation_id
        }
    except Exception as exc:
        db.rollback()
        logger.error('Erro ao adicionar mensagem: %s', exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post('/{conversation_id}/dashboards', status_code=status.HTTP_201_CREATED)
def add_dashboard(
    conversation_id: str,
    req: DashboardCreateRequest,
    db: Session = Depends(get_db)
):
    try:
        dash_id = uuid.uuid4().hex
        dash_json = json.dumps(req.dashboard_json)
        insight_json = json.dumps(req.insight_json or [])

        db.execute(text('''
            INSERT INTO public.copilot_dashboards
                (id, conversation_id, title, dashboard_type, query, dashboard_json, insight_json, is_favorite, created_at)
            VALUES
                (:id, :conversation_id, :title, :dashboard_type, :query, :dashboard_json, :insight_json, :is_favorite, NOW())
        '''), {
            'id': dash_id,
            'conversation_id': conversation_id,
            'title': req.title,
            'dashboard_type': req.dashboard_type,
            'query': req.query,
            'dashboard_json': dash_json,
            'insight_json': insight_json,
            'is_favorite': bool(req.is_favorite)
        })

        db.execute(text('''
            UPDATE public.copilot_conversations SET updated_at = NOW() WHERE id = :id
        '''), {'id': conversation_id})

        db.commit()

        return {
            'status': 'success',
            'dashboard_id': dash_id,
            'conversation_id': conversation_id
        }
    except Exception as exc:
        db.rollback()
        logger.error('Erro ao vincular dashboard: %s', exc)
        raise HTTPException(status_code=500, detail=str(exc))