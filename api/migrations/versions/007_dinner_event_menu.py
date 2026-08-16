"""add dinner event menu

Revision ID: 007_event_menu
Revises: 006_coupon_note
Create Date: 2026-08-16 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "007_event_menu"
down_revision = "006_coupon_note"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("dinner_events", sa.Column("menu", sa.Text(), nullable=True))


def downgrade():
    op.drop_column("dinner_events", "menu")
