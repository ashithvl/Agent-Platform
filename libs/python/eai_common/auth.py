"""JWT helpers shared by auth-service (signs) and other services (verify).

The token shape intentionally matches the SPA's `realmRolesFromAccessToken`
in `apps/web/src/auth/roles.ts` - the SPA reads `realm_access.roles`, so we
keep that claim here even though the backend also looks at `sub` + `roles`.
"""
from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Iterable

import jwt
from fastapi import HTTPException, Request, status

from .settings import Settings


@dataclass(frozen=True)
class TokenClaims:
    sub: str
    preferred_username: str
    roles: frozenset[str]


def _now() -> int:
    return int(time.time())


def encode_access_token(
    *,
    settings: Settings,
    sub: str,
    preferred_username: str,
    roles: Iterable[str],
) -> str:
    roles_list = sorted(set(roles))
    payload = {
        "iss": settings.jwt_issuer,
        "aud": settings.jwt_audience,
        "sub": sub,
        "preferred_username": preferred_username,
        "iat": _now(),
        "exp": _now() + settings.jwt_ttl_minutes * 60,
        "realm_access": {"roles": roles_list},
        "roles": roles_list,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_access_token(settings: Settings, token: str) -> TokenClaims:
    try:
        data = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=["HS256"],
            audience=settings.jwt_audience,
            issuer=settings.jwt_issuer,
        )
    except jwt.PyJWTError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"Invalid token: {exc}") from exc
    roles = data.get("roles") or data.get("realm_access", {}).get("roles") or []
    return TokenClaims(
        sub=str(data["sub"]),
        preferred_username=str(data.get("preferred_username", data["sub"])),
        roles=frozenset(roles),
    )


def claims_from_request(settings: Settings, request: Request) -> TokenClaims:
    auth_header = request.headers.get("authorization", "")
    if not auth_header.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing bearer token")
    token = auth_header.split(" ", 1)[1].strip()
    return decode_access_token(settings, token)


def require_any_role(claims: TokenClaims, roles: Iterable[str]) -> None:
    wanted = set(roles)
    if not (wanted & set(claims.roles)):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            f"Requires one of roles: {sorted(wanted)}",
        )
