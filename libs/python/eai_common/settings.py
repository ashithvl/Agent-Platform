"""Process-level settings loaded from environment variables.

Every service imports `Settings()` once at startup. Values deliberately
fall back to docker-compose defaults so local dev needs zero `.env` work.
"""
from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    service_name: str = os.getenv("SERVICE_NAME", "unknown")

    postgres_dsn: str = os.getenv(
        "POSTGRES_DSN",
        "postgresql+psycopg://eai:eai@postgres:5432/eai",
    )
    redis_url: str = os.getenv("REDIS_URL", "redis://redis:6379/0")

    jwt_secret: str = os.getenv("JWT_SECRET", "dev-only-secret-change-me")
    jwt_issuer: str = os.getenv("JWT_ISSUER", "eai-auth-service")
    jwt_audience: str = os.getenv("JWT_AUDIENCE", "eai-api")
    jwt_ttl_minutes: int = int(os.getenv("JWT_TTL_MINUTES", "60"))

    litellm_base_url: str = os.getenv("LITELLM_BASE_URL", "http://litellm:4000")
    litellm_master_key: str = os.getenv("LITELLM_MASTER_KEY", "sk-dev-master")

    langfuse_host: str = os.getenv("LANGFUSE_HOST", "http://langfuse-web:3000")
    langfuse_public_key: str = os.getenv("LANGFUSE_PUBLIC_KEY", "")
    langfuse_secret_key: str = os.getenv("LANGFUSE_SECRET_KEY", "")

    minio_endpoint: str = os.getenv("MINIO_ENDPOINT", "http://minio:9000")
    minio_access_key: str = os.getenv("MINIO_ACCESS_KEY", "minio")
    minio_secret_key: str = os.getenv("MINIO_SECRET_KEY", "minio12345")
