from minio import Minio

from app.config import settings


def get_client() -> Minio:
    ep = settings.minio_endpoint.replace("http://", "").replace("https://", "")
    secure = settings.minio_endpoint.startswith("https://")
    return Minio(
        ep,
        access_key=settings.minio_access_key,
        secret_key=settings.minio_secret_key,
        secure=secure,
    )


def ensure_bucket() -> None:
    client = get_client()
    if not client.bucket_exists(settings.minio_bucket):
        client.make_bucket(settings.minio_bucket)
