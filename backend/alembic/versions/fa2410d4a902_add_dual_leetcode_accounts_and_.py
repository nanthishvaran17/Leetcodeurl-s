"""Add dual leetcode accounts and verification

Revision ID: fa2410d4a902
Revises: b4e81e80d1af
Create Date: 2026-09-07 18:37:32.188301

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fa2410d4a902'
down_revision: Union[str, Sequence[str], None] = 'b4e81e80d1af'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('students', schema=None) as batch_op:
        batch_op.add_column(sa.Column('primary_leetcode_id', sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column('secondary_leetcode_id', sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column('secondary_status', sa.String(length=50), server_default='none', nullable=True))
        batch_op.create_index(batch_op.f('ix_students_primary_leetcode_id'), ['primary_leetcode_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_students_secondary_leetcode_id'), ['secondary_leetcode_id'], unique=False)

    op.execute("UPDATE students SET primary_leetcode_id = username WHERE username IS NOT NULL")

    op.create_table(
        'weekly_verification_records',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('student_id', sa.Integer(), nullable=False),
        sa.Column('verification_week', sa.Integer(), nullable=False),
        sa.Column('notification_type', sa.String(length=50), nullable=False),
        sa.Column('primary_solved', sa.Integer(), nullable=True),
        sa.Column('secondary_solved', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(length=30), nullable=True),
        sa.Column('email_dispatched', sa.Boolean(), nullable=True),
        sa.Column('timestamp', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['student_id'], ['students.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('student_id', 'verification_week', 'notification_type', name='uq_weekly_verification_record')
    )
    with op.batch_alter_table('weekly_verification_records', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_weekly_verification_records_student_id'), ['student_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_weekly_verification_records_verification_week'), ['verification_week'], unique=False)
        batch_op.create_index(batch_op.f('ix_weekly_verification_records_notification_type'), ['notification_type'], unique=False)

def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('weekly_verification_records', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_weekly_verification_records_notification_type'))
        batch_op.drop_index(batch_op.f('ix_weekly_verification_records_verification_week'))
        batch_op.drop_index(batch_op.f('ix_weekly_verification_records_student_id'))
    op.drop_table('weekly_verification_records')

    with op.batch_alter_table('students', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_students_secondary_leetcode_id'))
        batch_op.drop_index(batch_op.f('ix_students_primary_leetcode_id'))
        batch_op.drop_column('secondary_status')
        batch_op.drop_column('secondary_leetcode_id')
        batch_op.drop_column('primary_leetcode_id')
