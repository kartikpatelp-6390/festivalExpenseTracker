"""add dinner collection handover

Revision ID: 004_dinner_handover
Revises: 003_dinner_volunteer
Create Date: 2026-08-16 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "004_dinner_handover"
down_revision = "003_dinner_volunteer"
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
        "dinner_collection_handovers",
        sa.Column("id", sa.Integer(), nullable=False),
        mongo_id_column(),
        sa.Column("event_id", sa.Integer(), nullable=False),
        sa.Column("volunteer_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="Pending"),
        sa.Column("collected_at", sa.DateTime(), nullable=True),
        sa.Column("collected_by", sa.String(length=255), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        *timestamp_columns(),
        sa.ForeignKeyConstraint(["event_id"], ["dinner_events.id"]),
        sa.ForeignKeyConstraint(["volunteer_id"], ["volunteers.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("event_id", "volunteer_id", name="uq_dinner_collection_event_volunteer"),
        sa.UniqueConstraint("mongo_id"),
    )
    op.create_index("ix_dinner_collection_handovers_event_id", "dinner_collection_handovers", ["event_id"])
    op.create_index("ix_dinner_collection_handovers_volunteer_id", "dinner_collection_handovers", ["volunteer_id"])


def downgrade():
    op.drop_index("ix_dinner_collection_handovers_volunteer_id", table_name="dinner_collection_handovers")
    op.drop_index("ix_dinner_collection_handovers_event_id", table_name="dinner_collection_handovers")
    op.drop_table("dinner_collection_handovers")
