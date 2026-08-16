"""add dinner management

Revision ID: 002_dinner_management
Revises: 001_initial_schema
Create Date: 2026-08-15 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "002_dinner_management"
down_revision = "001_initial_schema"
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
        "dinner_caterers",
        sa.Column("id", sa.Integer(), nullable=False),
        mongo_id_column(),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("contact_person", sa.String(length=255), nullable=False),
        sa.Column("primary_mobile", sa.String(length=50), nullable=False),
        sa.Column("alternate_mobile", sa.String(length=50), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("address", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        *timestamp_columns(),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("mongo_id"),
    )

    op.create_table(
        "dinner_events",
        sa.Column("id", sa.Integer(), nullable=False),
        mongo_id_column(),
        sa.Column("festival_id", sa.Integer(), nullable=False),
        sa.Column("caterer_id", sa.Integer(), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("event_date", sa.Date(), nullable=False),
        sa.Column("event_time", sa.String(length=20), nullable=True),
        sa.Column("venue", sa.String(length=255), nullable=True),
        sa.Column("dinner_type", sa.String(length=100), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=40), nullable=False, server_default="Draft"),
        sa.Column("caterer_pricing_type", sa.String(length=20), nullable=False, server_default="per_plate"),
        sa.Column("caterer_rate_per_plate", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("expected_plates", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("fixed_contract_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("advance_paid", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("collection_start_date", sa.Date(), nullable=True),
        sa.Column("collection_deadline", sa.Date(), nullable=True),
        sa.Column("coupon_deadline", sa.Date(), nullable=True),
        sa.Column("final_plate_submission_at", sa.DateTime(), nullable=True),
        sa.Column("contribution_type", sa.String(length=30), nullable=False, server_default="payee_full"),
        sa.Column("member_contribution_rate", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("payee_percent", sa.Numeric(5, 2), nullable=False, server_default="100"),
        sa.Column("mandal_percent", sa.Numeric(5, 2), nullable=False, server_default="0"),
        sa.Column("final_plate_count", sa.Integer(), nullable=True),
        sa.Column("plate_shared_at", sa.DateTime(), nullable=True),
        sa.Column("caterer_confirmed_at", sa.DateTime(), nullable=True),
        sa.Column("confirmed_by", sa.String(length=255), nullable=True),
        sa.Column("closed_at", sa.DateTime(), nullable=True),
        *timestamp_columns(),
        sa.ForeignKeyConstraint(["caterer_id"], ["dinner_caterers.id"]),
        sa.ForeignKeyConstraint(["festival_id"], ["festivals.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("mongo_id"),
    )
    op.create_index("ix_dinner_events_festival_id", "dinner_events", ["festival_id"])
    op.create_index("ix_dinner_events_caterer_id", "dinner_events", ["caterer_id"])

    op.create_table(
        "dinner_registrations",
        sa.Column("id", sa.Integer(), nullable=False),
        mongo_id_column(),
        sa.Column("event_id", sa.Integer(), nullable=False),
        sa.Column("house_id", sa.Integer(), nullable=False),
        sa.Column("existing_member_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("adults", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("children_below_7", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("contribution_type", sa.String(length=30), nullable=False),
        sa.Column("member_contribution_rate", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("payee_percent", sa.Numeric(5, 2), nullable=False, server_default="100"),
        sa.Column("mandal_percent", sa.Numeric(5, 2), nullable=False, server_default="0"),
        sa.Column("payee_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("mandal_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("amount_received", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("payment_method", sa.String(length=30), nullable=True),
        sa.Column("transaction_reference", sa.String(length=255), nullable=True),
        sa.Column("payment_status", sa.String(length=30), nullable=False, server_default="Pending"),
        sa.Column("notes", sa.Text(), nullable=True),
        *timestamp_columns(),
        sa.ForeignKeyConstraint(["event_id"], ["dinner_events.id"]),
        sa.ForeignKeyConstraint(["house_id"], ["houses.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("event_id", "house_id", name="uq_dinner_registration_event_house"),
        sa.UniqueConstraint("mongo_id"),
    )
    op.create_index("ix_dinner_registrations_event_id", "dinner_registrations", ["event_id"])
    op.create_index("ix_dinner_registrations_house_id", "dinner_registrations", ["house_id"])

    op.create_table(
        "dinner_coupons",
        sa.Column("id", sa.Integer(), nullable=False),
        mongo_id_column(),
        sa.Column("event_id", sa.Integer(), nullable=False),
        sa.Column("registration_id", sa.Integer(), nullable=False),
        sa.Column("token", sa.String(length=512), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="Generated"),
        sa.Column("delivery_status", sa.String(length=30), nullable=False, server_default="Not Sent"),
        sa.Column("delivery_channel", sa.String(length=30), nullable=True),
        sa.Column("sent_to", sa.String(length=255), nullable=True),
        sa.Column("sent_at", sa.DateTime(), nullable=True),
        *timestamp_columns(),
        sa.ForeignKeyConstraint(["event_id"], ["dinner_events.id"]),
        sa.ForeignKeyConstraint(["registration_id"], ["dinner_registrations.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("mongo_id"),
        sa.UniqueConstraint("registration_id"),
        sa.UniqueConstraint("token"),
    )

    op.create_table(
        "dinner_checkins",
        sa.Column("id", sa.Integer(), nullable=False),
        mongo_id_column(),
        sa.Column("event_id", sa.Integer(), nullable=False),
        sa.Column("registration_id", sa.Integer(), nullable=False),
        sa.Column("house_id", sa.Integer(), nullable=False),
        sa.Column("adults_entered", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("children_entered", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("plates_consumed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("entry_method", sa.String(length=30), nullable=False),
        sa.Column("gate_name", sa.String(length=100), nullable=True),
        sa.Column("volunteer_name", sa.String(length=255), nullable=True),
        sa.Column("restricted_attempt", sa.Boolean(), nullable=False, server_default=sa.text("0")),
        sa.Column("override_reason", sa.Text(), nullable=True),
        *timestamp_columns(),
        sa.ForeignKeyConstraint(["event_id"], ["dinner_events.id"]),
        sa.ForeignKeyConstraint(["house_id"], ["houses.id"]),
        sa.ForeignKeyConstraint(["registration_id"], ["dinner_registrations.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("mongo_id"),
    )

    op.create_table(
        "dinner_settlements",
        sa.Column("id", sa.Integer(), nullable=False),
        mongo_id_column(),
        sa.Column("event_id", sa.Integer(), nullable=False),
        sa.Column("final_plate_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("base_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("gross_amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("advance_paid", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("final_payable", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="Pending"),
        sa.Column("payment_date", sa.Date(), nullable=True),
        sa.Column("payment_method", sa.String(length=30), nullable=True),
        sa.Column("reference_number", sa.String(length=255), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("expense_id", sa.Integer(), nullable=True),
        *timestamp_columns(),
        sa.ForeignKeyConstraint(["event_id"], ["dinner_events.id"]),
        sa.ForeignKeyConstraint(["expense_id"], ["expenses.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("event_id"),
        sa.UniqueConstraint("mongo_id"),
    )

    op.create_table(
        "dinner_settlement_adjustments",
        sa.Column("id", sa.Integer(), nullable=False),
        mongo_id_column(),
        sa.Column("settlement_id", sa.Integer(), nullable=False),
        sa.Column("adjustment_type", sa.String(length=100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("direction", sa.String(length=20), nullable=False, server_default="increase"),
        *timestamp_columns(),
        sa.ForeignKeyConstraint(["settlement_id"], ["dinner_settlements.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("mongo_id"),
    )


def downgrade():
    op.drop_table("dinner_settlement_adjustments")
    op.drop_table("dinner_settlements")
    op.drop_table("dinner_checkins")
    op.drop_table("dinner_coupons")
    op.drop_index("ix_dinner_registrations_house_id", table_name="dinner_registrations")
    op.drop_index("ix_dinner_registrations_event_id", table_name="dinner_registrations")
    op.drop_table("dinner_registrations")
    op.drop_index("ix_dinner_events_caterer_id", table_name="dinner_events")
    op.drop_index("ix_dinner_events_festival_id", table_name="dinner_events")
    op.drop_table("dinner_events")
    op.drop_table("dinner_caterers")
