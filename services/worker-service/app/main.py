"""Entry module for `taskiq worker app.main:broker` and `taskiq scheduler app.main:scheduler`.

Importing the task modules below registers them on the broker so both the
worker and scheduler can discover them.
"""
from __future__ import annotations

from . import langfuse_sync  # noqa: F401  (registers the sync task + schedule label)
from .broker import broker, scheduler  # noqa: F401  (re-exported for taskiq CLI)
