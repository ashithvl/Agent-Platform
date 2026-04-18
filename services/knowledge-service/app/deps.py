from fastapi import Header, HTTPException

from app.config import settings


def verify_internal_token(x_internal_token: str | None = Header(default=None, alias="X-Internal-Token")) -> None:
    if x_internal_token != settings.internal_service_token:
        raise HTTPException(status_code=401, detail="Invalid internal token")
