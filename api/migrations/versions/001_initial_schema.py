"""initial schema from phpMyAdmin designer

Revision ID: 001_initial_schema
Revises:
Create Date: 2026-06-03 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def timestamp_columns():
    return [
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
    ]


def mongo_id_column():
    return sa.Column("mongo_id", sa.String(length=24), nullable=True)


def upgrade():
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        mongo_id_column(),
        sa.Column("username", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        *timestamp_columns(),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("mongo_id"),
        sa.UniqueConstraint("username"),
    )

    op.create_table(
        "volunteers",
        sa.Column("id", sa.Integer(), nullable=False),
        mongo_id_column(),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=50), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        *timestamp_columns(),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("mongo_id"),
        sa.UniqueConstraint("phone"),
    )

    op.create_table(
        "houses",
        sa.Column("id", sa.Integer(), nullable=False),
        mongo_id_column(),
        sa.Column("house_number", sa.String(length=100), nullable=False),
        sa.Column("owner_name", sa.String(length=255), nullable=True),
        sa.Column("phone", sa.String(length=50), nullable=True),
        *timestamp_columns(),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("house_number"),
        sa.UniqueConstraint("mongo_id"),
    )

    op.create_table(
        "festivals",
        sa.Column("id", sa.Integer(), nullable=False),
        mongo_id_column(),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("festival_date", sa.Date(), nullable=True),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        *timestamp_columns(),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("mongo_id"),
    )

    op.create_table(
        "inventory",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("item", sa.String(length=150), nullable=False),
        sa.Column("category", sa.String(length=100), nullable=False),
        sa.Column("count", sa.Integer(), nullable=False),
        sa.Column("place", sa.String(length=150), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        *timestamp_columns(),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "inventory_items",
        sa.Column("id", sa.Integer(), nullable=False),
        mongo_id_column(),
        sa.Column("item", sa.String(length=255), nullable=False),
        sa.Column("category", sa.String(length=255), nullable=False),
        sa.Column("item_count", sa.Integer(), nullable=False),
        sa.Column("place", sa.String(length=255), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        *timestamp_columns(),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("mongo_id"),
    )

    op.create_table(
        "short_links",
        sa.Column("id", sa.Integer(), nullable=False),
        mongo_id_column(),
        sa.Column("short_code", sa.String(length=255), nullable=False),
        sa.Column("target_url", sa.Text(), nullable=False),
        *timestamp_columns(),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("mongo_id"),
        sa.UniqueConstraint("short_code"),
    )

    op.create_table(
        "todos",
        sa.Column("id", sa.Integer(), nullable=False),
        mongo_id_column(),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("is_done", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("created_by_mongo_id", sa.String(length=24), nullable=True),
        *timestamp_columns(),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("mongo_id"),
    )

    op.create_table(
        "estimates",
        sa.Column("id", sa.Integer(), nullable=False),
        mongo_id_column(),
        sa.Column("festival_id", sa.Integer(), nullable=False),
        sa.Column("festival_year", sa.Integer(), nullable=False),
        sa.Column("category", sa.String(length=255), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("estimated_amount", sa.Numeric(12, 2), nullable=False),
        *timestamp_columns(),
        sa.ForeignKeyConstraint(["festival_id"], ["festivals.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("mongo_id"),
    )
    op.create_index("ix_estimates_festival_id", "estimates", ["festival_id"])

    op.create_table(
        "expenses",
        sa.Column("id", sa.Integer(), nullable=False),
        mongo_id_column(),
        sa.Column("festival_id", sa.Integer(), nullable=False),
        sa.Column("volunteer_id", sa.Integer(), nullable=True),
        sa.Column("category", sa.String(length=255), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("payment_method", sa.String(length=20), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("expense_date", sa.DateTime(), nullable=True),
        sa.Column("is_settled", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("settled_on", sa.DateTime(), nullable=True),
        sa.Column("festival_year", sa.Integer(), nullable=False),
        *timestamp_columns(),
        sa.ForeignKeyConstraint(["festival_id"], ["festivals.id"]),
        sa.ForeignKeyConstraint(["volunteer_id"], ["volunteers.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("mongo_id"),
    )
    op.create_index("ix_expenses_festival_id", "expenses", ["festival_id"])
    op.create_index("ix_expenses_volunteer_id", "expenses", ["volunteer_id"])

    op.create_table(
        "fund_transactions",
        sa.Column("id", sa.Integer(), nullable=False),
        mongo_id_column(),
        sa.Column("type", sa.String(length=50), nullable=False),
        sa.Column("house_id", sa.Integer(), nullable=True),
        sa.Column("volunteer_id", sa.Integer(), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=True),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("payment_method", sa.String(length=20), nullable=True),
        sa.Column("reference_no", sa.String(length=255), nullable=True),
        sa.Column("transaction_date", sa.DateTime(), nullable=True),
        sa.Column("festival_year", sa.Integer(), nullable=False),
        sa.Column("alternative_phone", sa.String(length=50), nullable=True),
        *timestamp_columns(),
        sa.ForeignKeyConstraint(["house_id"], ["houses.id"]),
        sa.ForeignKeyConstraint(["volunteer_id"], ["volunteers.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("mongo_id"),
    )
    op.create_index("ix_fund_transactions_house_id", "fund_transactions", ["house_id"])
    op.create_index("ix_fund_transactions_volunteer_id", "fund_transactions", ["volunteer_id"])


def downgrade():
    op.drop_index("ix_fund_transactions_volunteer_id", table_name="fund_transactions")
    op.drop_index("ix_fund_transactions_house_id", table_name="fund_transactions")
    op.drop_table("fund_transactions")
    op.drop_index("ix_expenses_volunteer_id", table_name="expenses")
    op.drop_index("ix_expenses_festival_id", table_name="expenses")
    op.drop_table("expenses")
    op.drop_index("ix_estimates_festival_id", table_name="estimates")
    op.drop_table("estimates")
    op.drop_table("todos")
    op.drop_table("short_links")
    op.drop_table("inventory_items")
    op.drop_table("inventory")
    op.drop_table("festivals")
    op.drop_table("houses")
    op.drop_table("volunteers")
    op.drop_table("users")

