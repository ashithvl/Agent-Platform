from functools import lru_cache
from typing import Any

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwk, jwt

from app.config import settings

security = HTTPBearer(auto_error=False)


@lru_cache
def _jwks_url() -> str:
    if settings.oidc_jwks_url:
        return settings.oidc_jwks_url
    issuer = settings.oidc_issuer_url.rstrip("/")
    with httpx.Client(timeout=10.0) as client:
        r = client.get(f"{issuer}/.well-known/openid-configuration")
        r.raise_for_status()
        discovery = r.json()
    jwks_uri = discovery.get("jwks_uri")
    if not jwks_uri:
        raise RuntimeError("OIDC discovery response missing jwks_uri")
    return jwks_uri


@lru_cache(maxsize=1)
def _jwks() -> dict[str, Any]:
    with httpx.Client(timeout=10.0) as client:
        r = client.get(_jwks_url())
        r.raise_for_status()
        return r.json()


def decode_token(token: str) -> dict[str, Any]:
    try:
        jwks = _jwks()
        unverified = jwt.get_unverified_header(token)
        kid = unverified.get("kid")
        key = None
        for k in jwks.get("keys", []):
            if k.get("kid") == kid:
                key = k
                break
        if not key:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unknown signing key")
        rsa_key = jwk.construct(key)
        payload = jwt.decode(
            token,
            rsa_key,
            algorithms=["RS256"],
            audience=settings.oidc_client_id,
            options={"verify_aud": False},
        )
        return payload
    except JWTError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token: {e}") from e


def realm_roles(payload: dict[str, Any]) -> set[str]:
    # Provider-specific role/group extraction.
    ra = payload.get("realm_access") or {}
    roles = ra.get("roles") or []
    out = set(roles)
    # Authentik commonly emits groups in "groups".
    groups = payload.get("groups")
    if isinstance(groups, list):
        out.update(str(g) for g in groups)
    # Optional direct "roles" claim support.
    direct_roles = payload.get("roles")
    if isinstance(direct_roles, list):
        out.update(str(r) for r in direct_roles)
    return out


def require_roles(*allowed: str):
    def _dep(
        creds: HTTPAuthorizationCredentials | None = Depends(security),
    ) -> dict[str, Any]:
        if creds is None or creds.scheme.lower() != "bearer":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
        payload = decode_token(creds.credentials)
        roles = realm_roles(payload)
        if not roles.intersection(set(allowed)):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
        return payload

    return _dep


def optional_user(
    creds: HTTPAuthorizationCredentials | None = Depends(security),
) -> dict[str, Any] | None:
    if creds is None or creds.scheme.lower() != "bearer":
        return None
    return decode_token(creds.credentials)
