"""Add NLCI v3.1 tables

Revision ID: 7de62f37279a
Revises: fa2410d4a902
Create Date: 2026-09-10 14:14:12.716397

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7de62f37279a'
down_revision: Union[str, Sequence[str], None] = 'fa2410d4a902'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. nlci_profiles
    op.create_table('nlci_profiles',
        sa.Column('student_id', sa.Integer(), nullable=False),
        sa.Column('leetcode_username', sa.String(length=255), nullable=True),
        sa.Column('ranking', sa.Integer(), nullable=True),
        sa.Column('total_solved', sa.Integer(), nullable=True),
        sa.Column('easy_solved', sa.Integer(), nullable=True),
        sa.Column('medium_solved', sa.Integer(), nullable=True),
        sa.Column('hard_solved', sa.Integer(), nullable=True),
        sa.Column('total_submissions', sa.Integer(), nullable=True),
        sa.Column('total_accepted', sa.Integer(), nullable=True),
        sa.Column('acceptance_rate', sa.Float(), nullable=True),
        sa.Column('contest_rating', sa.Float(), nullable=True),
        sa.Column('contest_global_rank', sa.Integer(), nullable=True),
        sa.Column('contests_attended', sa.Integer(), nullable=True),
        sa.Column('current_streak', sa.Integer(), nullable=True),
        sa.Column('total_active_days', sa.Integer(), nullable=True),
        sa.Column('last_active_date', sa.String(length=50), nullable=True),
        sa.Column('fetched_at', sa.String(length=50), nullable=True),
        sa.Column('source_hash', sa.String(length=255), nullable=True),
        sa.Column('is_valid', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['student_id'], ['students.id'], ),
        sa.PrimaryKeyConstraint('student_id')
    )
    op.create_index(op.f('ix_nlci_profiles_contest_rating'), 'nlci_profiles', ['contest_rating'], unique=False)
    op.create_index(op.f('ix_nlci_profiles_leetcode_username'), 'nlci_profiles', ['leetcode_username'], unique=True)
    op.create_index(op.f('ix_nlci_profiles_total_solved'), 'nlci_profiles', ['total_solved'], unique=False)

    # 2. nlci_daily_snapshots
    op.create_table('nlci_daily_snapshots',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('student_id', sa.Integer(), nullable=True),
        sa.Column('snapshot_date', sa.String(length=50), nullable=True),
        sa.Column('total_solved', sa.Integer(), nullable=True),
        sa.Column('easy_solved', sa.Integer(), nullable=True),
        sa.Column('medium_solved', sa.Integer(), nullable=True),
        sa.Column('hard_solved', sa.Integer(), nullable=True),
        sa.Column('contest_rating', sa.Float(), nullable=True),
        sa.Column('acceptance_rate', sa.Float(), nullable=True),
        sa.Column('active_days', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['student_id'], ['students.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('student_id', 'snapshot_date')
    )
    op.create_index('idx_daily_snapshots_student_date', 'nlci_daily_snapshots', ['student_id', 'snapshot_date'], unique=False)

    # 3. nlci_language_stats
    op.create_table('nlci_language_stats',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('student_id', sa.Integer(), nullable=True),
        sa.Column('language', sa.String(length=100), nullable=True),
        sa.Column('display_name', sa.String(length=100), nullable=True),
        sa.Column('solved_count', sa.Integer(), nullable=True),
        sa.Column('submission_count', sa.Integer(), nullable=True),
        sa.Column('accepted_count', sa.Integer(), nullable=True),
        sa.Column('updated_at', sa.String(length=50), nullable=True),
        sa.ForeignKeyConstraint(['student_id'], ['students.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('student_id', 'language')
    )
    op.create_index('idx_language_stats_lang_solved', 'nlci_language_stats', ['language', 'solved_count'], unique=False)

    # 4. nlci_contests
    op.create_table('nlci_contests',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('contest_slug', sa.String(length=255), nullable=True),
        sa.Column('contest_name', sa.String(length=255), nullable=True),
        sa.Column('contest_type', sa.String(length=50), nullable=True),
        sa.Column('start_time', sa.String(length=50), nullable=True),
        sa.Column('end_time', sa.String(length=50), nullable=True),
        sa.Column('is_upcoming', sa.Integer(), nullable=True),
        sa.Column('fetched_at', sa.String(length=50), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('contest_slug')
    )

    # 5. nlci_contest_participations
    op.create_table('nlci_contest_participations',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('student_id', sa.Integer(), nullable=True),
        sa.Column('contest_id', sa.Integer(), nullable=True),
        sa.Column('rank', sa.Integer(), nullable=True),
        sa.Column('problems_solved', sa.Integer(), nullable=True),
        sa.Column('rating_after', sa.Float(), nullable=True),
        sa.Column('rating_delta', sa.Float(), nullable=True),
        sa.Column('finish_time_seconds', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['contest_id'], ['nlci_contests.id'], ),
        sa.ForeignKeyConstraint(['student_id'], ['students.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('student_id', 'contest_id')
    )
    op.create_index('idx_contest_participations_contest_rank', 'nlci_contest_participations', ['contest_id', 'rank'], unique=False)

    # 6. nlci_student_analytics
    op.create_table('nlci_student_analytics',
        sa.Column('student_id', sa.Integer(), nullable=False),
        sa.Column('performance_score', sa.Float(), nullable=True),
        sa.Column('placement_readiness', sa.Float(), nullable=True),
        sa.Column('interview_readiness', sa.Float(), nullable=True),
        sa.Column('risk_level', sa.String(length=50), nullable=True),
        sa.Column('trend', sa.String(length=50), nullable=True),
        sa.Column('profile_class', sa.String(length=50), nullable=True),
        sa.Column('primary_language', sa.String(length=100), nullable=True),
        sa.Column('computed_at', sa.String(length=50), nullable=True),
        sa.Column('score_version', sa.String(length=50), nullable=True),
        sa.ForeignKeyConstraint(['student_id'], ['students.id'], ),
        sa.PrimaryKeyConstraint('student_id')
    )

    # 7. nlci_rbac_scopes
    op.create_table('nlci_rbac_scopes',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('scope_type', sa.String(length=50), nullable=True),
        sa.Column('scope_ref', sa.String(length=255), nullable=True),
        sa.Column('granted_at', sa.String(length=50), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )

    # 8. nlci_sync_log
    op.create_table('nlci_sync_log',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('started_at', sa.String(length=50), nullable=True),
        sa.Column('finished_at', sa.String(length=50), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=True),
        sa.Column('students_attempted', sa.Integer(), nullable=True),
        sa.Column('students_succeeded', sa.Integer(), nullable=True),
        sa.Column('students_failed', sa.Integer(), nullable=True),
        sa.Column('error_summary', sa.Text(), nullable=True),
        sa.Column('triggered_by', sa.String(length=100), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

    # 9. nlci_export_audit
    op.create_table('nlci_export_audit',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('export_type', sa.String(length=50), nullable=True),
        sa.Column('filter_snapshot', sa.Text(), nullable=True),
        sa.Column('row_count', sa.Integer(), nullable=True),
        sa.Column('generated_at', sa.String(length=50), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    op.drop_table('nlci_export_audit')
    op.drop_table('nlci_sync_log')
    op.drop_table('nlci_rbac_scopes')
    op.drop_table('nlci_student_analytics')
    op.drop_index('idx_contest_participations_contest_rank', table_name='nlci_contest_participations')
    op.drop_table('nlci_contest_participations')
    op.drop_table('nlci_contests')
    op.drop_index('idx_language_stats_lang_solved', table_name='nlci_language_stats')
    op.drop_table('nlci_language_stats')
    op.drop_index('idx_daily_snapshots_student_date', table_name='nlci_daily_snapshots')
    op.drop_table('nlci_daily_snapshots')
    op.drop_index(op.f('ix_nlci_profiles_total_solved'), table_name='nlci_profiles')
    op.drop_index(op.f('ix_nlci_profiles_leetcode_username'), table_name='nlci_profiles')
    op.drop_index(op.f('ix_nlci_profiles_contest_rating'), table_name='nlci_profiles')
    op.drop_table('nlci_profiles')
