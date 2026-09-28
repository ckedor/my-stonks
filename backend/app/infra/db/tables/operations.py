from sqlalchemy import JSON, CheckConstraint, Column, DateTime, Index, Integer, String, Table, Text

from app.infra.db.base import Base

task_run_table = Table(
    'task_run',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('task_name', String(100), nullable=False),
    #: Not unique: a retried message keeps its id and is a second run.
    Column('celery_task_id', String(64), nullable=True, index=True),
    Column('parent_task_id', String(64), nullable=True, index=True),
    Column('trigger', String(20), nullable=False),
    Column('status', String(20), nullable=False),
    Column('arguments', JSON, nullable=False, default=dict),
    Column('result', JSON, nullable=True),
    Column('error', Text, nullable=True),
    Column('started_at', DateTime(timezone=True), nullable=False),
    Column('finished_at', DateTime(timezone=True), nullable=True),
    Index('ix_operations_task_run_task_started', 'task_name', 'started_at'),
    Index('ix_operations_task_run_started', 'started_at'),
    CheckConstraint("trigger IN ('scheduled', 'manual', 'chained')", name='ck_task_run_trigger'),
    CheckConstraint("status IN ('running', 'success', 'failure')", name='ck_task_run_status'),
    schema='operations',
)
