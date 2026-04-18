"""SQLAlchemy models owned by auth-service.

Tables live in the shared `eai` database but only auth-service writes to them.
Other services look up users via auth-service REST, never the DB directly.
"""
from __future__ import annotations

from sqlalchemy import ARRAY, Column, DateTime, String, func
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    username = Column(String(64), primary_key=True)
    password_hash = Column(String(255), nullable=False)
    roles = Column(ARRAY(String), nullable=False, default=list)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
