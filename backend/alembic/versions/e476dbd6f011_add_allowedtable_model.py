"""Add AllowedTable model

Revision ID: e476dbd6f011
Revises: 65ec11a486ca
Create Date: 2026-07-19 17:05:22.296217

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e476dbd6f011'
down_revision: Union[str, Sequence[str], None] = '65ec11a486ca'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('allowed_tables',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('tenant_id', sa.String(length=100), server_default='default', nullable=False),
        sa.Column('alias', sa.String(length=50), nullable=False),
        sa.Column('description', sa.String(length=255), nullable=True),
        sa.Column('tipo', sa.String(length=100), nullable=True),
        sa.Column('fields', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        schema='public'
    )
    op.create_index(op.f('ix_public_allowed_tables_id'), 'allowed_tables', ['id'], unique=False, schema='public')
    op.create_index(op.f('ix_public_allowed_tables_tenant_id'), 'allowed_tables', ['tenant_id'], unique=False, schema='public')


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_public_allowed_tables_tenant_id'), table_name='allowed_tables', schema='public')
    op.drop_index(op.f('ix_public_allowed_tables_id'), table_name='allowed_tables', schema='public')
    op.drop_table('allowed_tables', schema='public')
