"""auth-service: username/password login, JWT issuance, user management.

This is intentionally a simple flat service - no OIDC, no SSO - so it can be
swapped for Authentik/Keycloak later without touching the SPA. The JWT shape
matches `apps/web/src/auth/roles.ts` (`realm_access.roles`).
"""
from __future__ import annotations

from typing import Iterable

import bcrypt
from fastapi import Depends, FastAPI, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from eai_common.auth import TokenClaims, claims_from_request, encode_access_token, require_any_role
from eai_common.db import make_engine, make_session_factory
from eai_common.settings import Settings

from .models import Base, User
from .seed import SEED_USERS

settings = Settings(service_name="auth-service")  # type: ignore[call-arg]
engine = make_engine(settings)
SessionFactory = make_session_factory(settings)

app = FastAPI(title="auth-service", version="0.1.0")


# ---------------------------------------------------------------------------
# Startup: create tables, seed demo users if missing.
# ---------------------------------------------------------------------------


def _hash(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt(rounds=10)).decode()


def _verify(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except ValueError:
        return False


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(engine)
    with SessionFactory() as db:
        existing = {u.username.lower() for u in db.scalars(select(User)).all()}
        for seed in SEED_USERS:
            if seed["username"].lower() in existing:
                continue
            db.add(
                User(
                    username=seed["username"],
                    password_hash=_hash(seed["password"]),
                    roles=list(seed["roles"]),
                )
            )
        db.commit()


# ---------------------------------------------------------------------------
# DI helpers.
# ---------------------------------------------------------------------------


def get_db() -> Iterable[Session]:
    db = SessionFactory()
    try:
        yield db
    finally:
        db.close()


def get_claims(request: Request) -> TokenClaims:
    return claims_from_request(settings, request)


# ---------------------------------------------------------------------------
# Schemas.
# ---------------------------------------------------------------------------


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    expires_in: int


class UserOut(BaseModel):
    username: str
    roles: list[str]
    label: str

    @staticmethod
    def from_row(u: User) -> "UserOut":
        roles = list(u.roles or [])
        if "admin" in roles or "platform-admin" in roles:
            label = "Admin"
        elif u.username.lower() == "developer":
            label = "Developer"
        else:
            label = "User"
        return UserOut(username=u.username, roles=roles, label=label)


class CreateUserRequest(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)
    role: str = Field(pattern=r"^(user|developer|admin)$")


ROLE_TEMPLATES: dict[str, list[str]] = {
    "user": ["consumer", "builder"],
    "developer": ["consumer", "builder"],
    "admin": ["platform-admin", "admin", "consumer", "builder"],
}


# ---------------------------------------------------------------------------
# Routes.
# ---------------------------------------------------------------------------


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok", "service": settings.service_name}


@app.post("/auth/login", response_model=LoginResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)) -> LoginResponse:
    user = db.scalar(select(User).where(User.username == body.username))
    if user is None or not _verify(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid username or password")
    token = encode_access_token(
        settings=settings,
        sub=user.username,
        preferred_username=user.username,
        roles=user.roles or [],
    )
    return LoginResponse(access_token=token, expires_in=settings.jwt_ttl_minutes * 60)


@app.get("/auth/me", response_model=UserOut)
def me(claims: TokenClaims = Depends(get_claims), db: Session = Depends(get_db)) -> UserOut:
    user = db.scalar(select(User).where(User.username == claims.sub))
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    return UserOut.from_row(user)


@app.get("/auth/users", response_model=list[UserOut])
def list_users(
    claims: TokenClaims = Depends(get_claims), db: Session = Depends(get_db)
) -> list[UserOut]:
    # Any authenticated user can list demo accounts (parity with Settings -> People).
    _ = claims
    rows = db.scalars(select(User).order_by(User.username)).all()
    return [UserOut.from_row(u) for u in rows]


@app.post("/auth/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(
    body: CreateUserRequest,
    claims: TokenClaims = Depends(get_claims),
    db: Session = Depends(get_db),
) -> UserOut:
    require_any_role(claims, ("admin", "platform-admin"))
    if db.scalar(select(User).where(User.username == body.username)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Username already taken")
    row = User(
        username=body.username,
        password_hash=_hash(body.password),
        roles=list(ROLE_TEMPLATES[body.role]),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return UserOut.from_row(row)
