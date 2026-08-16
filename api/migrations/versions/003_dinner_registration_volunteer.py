"""add dinner registration volunteer

Revision ID: 003_dinner_volunteer
Revises: 002_dinner_management
Create Date: 2026-08-16 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = "003_dinner_volunteer"
down_revision = "002_dinner_management"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("dinner_registrations")}
    indexes = {index["name"] for index in inspector.get_indexes("dinner_registrations")}
    foreign_keys = {fk["name"] for fk in inspector.get_foreign_keys("dinner_registrations")}
    if "volunteer_id" not in columns:
        op.add_column("dinner_registrations", sa.Column("volunteer_id", sa.Integer(), nullable=True))
    if "ix_dinner_registrations_volunteer_id" not in indexes:
        op.create_index("ix_dinner_registrations_volunteer_id", "dinner_registrations", ["volunteer_id"])
    if "fk_dinner_registrations_volunteer_id" not in foreign_keys:
        op.create_foreign_key("fk_dinner_registrations_volunteer_id", "dinner_registrations", "volunteers", ["volunteer_id"], ["id"])


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("dinner_registrations")}
    indexes = {index["name"] for index in inspector.get_indexes("dinner_registrations")}
    foreign_keys = {fk["name"] for fk in inspector.get_foreign_keys("dinner_registrations")}
    if "fk_dinner_registrations_volunteer_id" in foreign_keys:
        op.drop_constraint("fk_dinner_registrations_volunteer_id", "dinner_registrations", type_="foreignkey")
    if "ix_dinner_registrations_volunteer_id" in indexes:
        op.drop_index("ix_dinner_registrations_volunteer_id", table_name="dinner_registrations")
    if "volunteer_id" in columns:
        op.drop_column("dinner_registrations", "volunteer_id")
