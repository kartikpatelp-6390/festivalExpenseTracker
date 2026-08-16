"""add dinner settlement fund link

Revision ID: 005_dinner_fund
Revises: 004_dinner_handover
Create Date: 2026-08-16 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "005_dinner_fund"
down_revision = "004_dinner_handover"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("dinner_settlements", sa.Column("fund_transaction_id", sa.Integer(), nullable=True))
    op.create_index("ix_dinner_settlements_fund_transaction_id", "dinner_settlements", ["fund_transaction_id"])
    op.create_foreign_key("fk_dinner_settlements_fund_transaction_id", "dinner_settlements", "fund_transactions", ["fund_transaction_id"], ["id"])


def downgrade():
    op.drop_constraint("fk_dinner_settlements_fund_transaction_id", "dinner_settlements", type_="foreignkey")
    op.drop_index("ix_dinner_settlements_fund_transaction_id", table_name="dinner_settlements")
    op.drop_column("dinner_settlements", "fund_transaction_id")
