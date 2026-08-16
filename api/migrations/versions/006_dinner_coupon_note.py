"""add dinner coupon note settings

Revision ID: 006_coupon_note
Revises: 005_dinner_fund
Create Date: 2026-08-16 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "006_coupon_note"
down_revision = "005_dinner_fund"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("dinner_events", sa.Column("show_coupon_note", sa.Boolean(), nullable=False, server_default=sa.true()))
    op.add_column("dinner_events", sa.Column("coupon_important_note", sa.Text(), nullable=True))
    op.alter_column("dinner_events", "show_coupon_note", server_default=None)


def downgrade():
    op.drop_column("dinner_events", "coupon_important_note")
    op.drop_column("dinner_events", "show_coupon_note")
