"""initial public schema

Revision ID: 0001_init_public_schema
Revises:
Create Date: 2026-08-01
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0001_init_public_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── plans ────────────────────────────────────────────────────────────────
    op.create_table(
        "plans",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("plan_code", sa.String(32), nullable=False),
        sa.Column("plan_name", sa.String(128), nullable=False),
        sa.Column("max_users", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("max_queries_day", sa.Integer(), nullable=False, server_default="1000"),
        sa.Column("modules_allowed", sa.JSON(), nullable=False,
                  server_default=sa.text("'[]'::json")),
        sa.Column("price_brl", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("plan_code", name="uq_plans_plan_code"),
        schema="public",
    )

    # ── tenant_registry ──────────────────────────────────────────────────────
    op.create_table(
        "tenant_registry",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("tenant_code", sa.String(64), nullable=False),
        sa.Column("tenant_name", sa.String(255), nullable=False),
        sa.Column("schema_name", sa.String(64), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default=sa.text("'active'")),
        sa.Column("plan_id", sa.Integer(),
                  sa.ForeignKey("public.plans.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("tenant_code", name="uq_tenant_code"),
        sa.UniqueConstraint("schema_name", name="uq_schema_name"),
        schema="public",
    )

    # ── users ─────────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("tenant_id", sa.Integer(),
                  sa.ForeignKey("public.tenant_registry.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=True),
        sa.Column("role", sa.String(32), nullable=False, server_default=sa.text("'user'")),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        sa.Column("last_login", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("email", name="uq_users_email"),
        schema="public",
    )

    # ── protheus_modules_master ───────────────────────────────────────────────
    op.create_table(
        "protheus_modules_master",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("module_code", sa.String(8), nullable=False),
        sa.Column("module_name", sa.String(64), nullable=False),
        sa.Column("description", sa.String(255), nullable=True),
        sa.Column("main_tables", sa.JSON(), nullable=False,
                  server_default=sa.text("'[]'::json")),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        sa.UniqueConstraint("module_code", name="uq_protheus_module_code"),
        schema="public",
    )

    # ── conversations ─────────────────────────────────────────────────────────
    op.create_table(
        "conversations",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=False),
                  sa.ForeignKey("public.users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(255), nullable=True),
        sa.Column("module_context", sa.String(8), nullable=True),
        sa.Column("status", sa.String(32), nullable=False, server_default=sa.text("'active'")),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        schema="public",
    )

    # ── messages ──────────────────────────────────────────────────────────────
    op.create_table(
        "messages",
        sa.Column("id", UUID(as_uuid=False), primary_key=True),
        sa.Column("conversation_id", UUID(as_uuid=False),
                  sa.ForeignKey("public.conversations.id", ondelete="CASCADE"),
                  nullable=False),
        sa.Column("role", sa.String(16), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("tokens_used", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("protheus_tables_referenced", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        schema="public",
    )

    # ── audit_logs ────────────────────────────────────────────────────────────
    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("user_id", UUID(as_uuid=False),
                  sa.ForeignKey("public.users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("action", sa.String(64), nullable=False),
        sa.Column("resource", sa.String(64), nullable=False),
        sa.Column("resource_id", sa.String(128), nullable=True),
        sa.Column("detail", sa.JSON(), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
        schema="public",
    )

    # ── índices de performance ────────────────────────────────────────────────
    op.create_index("ix_messages_conversation_id",
                    "messages", ["conversation_id"], schema="public")
    op.create_index("ix_conversations_user_id",
                    "conversations", ["user_id"], schema="public")
    op.create_index("ix_audit_logs_user_id",
                    "audit_logs", ["user_id"], schema="public")
    op.create_index("ix_audit_logs_created_at",
                    "audit_logs", ["created_at"], schema="public")


def downgrade() -> None:
    op.drop_index("ix_audit_logs_created_at", table_name="audit_logs", schema="public")
    op.drop_index("ix_audit_logs_user_id", table_name="audit_logs", schema="public")
    op.drop_index("ix_conversations_user_id", table_name="conversations", schema="public")
    op.drop_index("ix_messages_conversation_id", table_name="messages", schema="public")
    op.drop_table("audit_logs", schema="public")
    op.drop_table("messages", schema="public")
    op.drop_table("conversations", schema="public")
    op.drop_table("protheus_modules_master", schema="public")
    op.drop_table("users", schema="public")
    op.drop_table("tenant_registry", schema="public")
    op.drop_table("plans", schema="public")
