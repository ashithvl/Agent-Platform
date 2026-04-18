"""
Server-side login against Authentik: Identification + Password flow executor,
then OAuth2 authorization code with PKCE and token exchange.
The browser never visits Authentik (BFF-only).
"""

from __future__ import annotations

import base64
import hashlib
import logging
import secrets
from typing import Any
from urllib.parse import parse_qs, unquote, urlparse, urlencode

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


async def login_with_credentials(username: str, password: str) -> dict[str, Any]:
    if not username or not password:
        raise ValueError("Username and password required")

    base = settings.authentik_internal_base.rstrip("/")
    flow_slug = settings.authentik_auth_flow_slug
    redirect_uri = settings.oidc_redirect_uri
    client_id = settings.oidc_client_id
    scope = "openid profile email"

    executor = f"{base}/api/v3/flows/executor/{flow_slug}/"
    token_url = f"{base}/application/o/token/"

    async with httpx.AsyncClient(timeout=60.0, follow_redirects=False) as client:
        r0 = await client.get(executor)
        r0.raise_for_status()
        j0 = r0.json()
        if j0.get("component") != "ak-stage-identification":
            logger.warning("unexpected first stage: %s", j0.get("component"))

        r1 = await client.post(executor, json={"uid_field": username})
        r1.raise_for_status()
        r1b = await client.get(executor)
        r1b.raise_for_status()

        r2 = await client.post(executor, json={"password": password})
        r2.raise_for_status()
        body2 = r2.json()
        if body2.get("component") not in ("xak-flow-redirect",):
            err = body2.get("response_errors") or body2.get("error")
            if err:
                raise ValueError("Invalid credentials")
            if body2.get("component") == "ak-stage-password":
                raise ValueError("Invalid credentials")

        verifier = secrets.token_urlsafe(32)
        challenge = _b64url(hashlib.sha256(verifier.encode()).digest())
        state = secrets.token_urlsafe(16)
        auth_params = urlencode(
            {
                "client_id": client_id,
                "redirect_uri": redirect_uri,
                "response_type": "code",
                "scope": scope,
                "state": state,
                "code_challenge": challenge,
                "code_challenge_method": "S256",
            }
        )
        auth_url = f"{base}/application/o/authorize/?{auth_params}"
        ra = await client.get(auth_url)
        if ra.status_code not in (301, 302, 303, 307, 308):
            raise RuntimeError(f"authorize failed: HTTP {ra.status_code}")
        loc = ra.headers.get("location")
        if not loc:
            raise RuntimeError("authorize missing Location")
        if "error=" in loc:
            raise RuntimeError(f"authorize error: {loc}")
        parsed = urlparse(loc)
        qs = parse_qs(parsed.query)
        codes = qs.get("code")
        if not codes:
            raise RuntimeError("No authorization code in redirect")
        code = unquote(codes[0])

        tr = await client.post(
            token_url,
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": redirect_uri,
                "client_id": client_id,
                "code_verifier": verifier,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        if tr.status_code >= 400:
            logger.warning("token exchange failed: %s", tr.text[:500])
            raise RuntimeError("Token exchange failed")
        return tr.json()
