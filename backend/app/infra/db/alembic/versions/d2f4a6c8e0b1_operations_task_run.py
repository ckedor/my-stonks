"""operations: a run record for every worker task

Revision ID: d2f4a6c8e0b1
Revises: b8d0f2a4c6e9
Create Date: 2026-09-26 10:00:00.000000

The task runner writes one row when a task starts and closes it when it ends,
for every task. Before this only the data ingestions kept executions, and for
two days: the consolidation, the dividend sweep and the history cleanup left a
log line and nothing else, and a weekly registry run was gone from the history
by the Thursday after it. The admin's operations screen reads from here.
"""

from typing import Sequence, Union

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'd2f4a6c8e0b1'
down_revision: Union[str, None] = 'b8d0f2a4c6e9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute('CREATE SCHEMA IF NOT EXISTS operations')
    op.create_table(
        'task_run',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('task_name', sa.String(100), nullable=False),
        sa.Column('celery_task_id', sa.String(64), nullable=True, index=True),
        sa.Column('parent_task_id', sa.String(64), nullable=True, index=True),
        sa.Column('trigger', sa.String(20), nullable=False),
        sa.Column('status', sa.String(20), nullable=False),
        sa.Column('arguments', sa.JSON(), nullable=False),
        sa.Column('result', sa.JSON(), nullable=True),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('finished_at', sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "trigger IN ('scheduled', 'manual', 'chained')", name='ck_task_run_trigger'
        ),
        sa.CheckConstraint(
            "status IN ('running', 'success', 'failure')", name='ck_task_run_status'
        ),
        schema='operations',
    )
    op.create_index(
        'ix_operations_task_run_task_started',
        'task_run',
        ['task_name', 'started_at'],
        schema='operations',
    )
    op.create_index(
        'ix_operations_task_run_started', 'task_run', ['started_at'], schema='operations'
    )


def downgrade() -> None:
    op.drop_table('task_run', schema='operations')
    op.execute('DROP SCHEMA IF EXISTS operations')
