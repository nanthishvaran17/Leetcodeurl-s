"""update_submission_log_unique_constraint

Revision ID: b4e81e80d1af
Revises: 
Create Date: 2026-09-07 07:29:43.290220

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b4e81e80d1af'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('submission_log') as batch_op:
        batch_op.drop_constraint('uix_submission_log_student_slug', type_='unique')
        batch_op.create_unique_constraint('uix_sublog_all', ['student_id', 'contest_id', 'title_slug', 'submitted_at'])


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('submission_log') as batch_op:
        batch_op.drop_constraint('uix_sublog_all', type_='unique')
        batch_op.create_unique_constraint('uix_submission_log_student_slug', ['student_id', 'title_slug'])
