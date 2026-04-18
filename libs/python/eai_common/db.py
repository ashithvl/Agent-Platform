"""SQLAlchemy engine + session factory shared across services."""
from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from .settings import Settings


def make_engine(settings: Settings):
    return create_engine(
        settings.postgres_dsn,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=5,
        future=True,
    )


def make_session_factory(settings: Settings):
    return sessionmaker(bind=make_engine(settings), autoflush=False, autocommit=False, future=True)


@contextmanager
def session_scope(factory) -> Iterator[Session]:
    db: Session = factory()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
