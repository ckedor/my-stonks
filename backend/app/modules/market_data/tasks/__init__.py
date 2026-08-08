# app/modules/market_data/tasks/__init__.py
"""Market data task package.

The Celery composition root imports concrete task modules explicitly. Keeping
the package initializer side-effect free avoids cycles between tasks and
composition providers.
"""
