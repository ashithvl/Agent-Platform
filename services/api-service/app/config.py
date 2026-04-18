from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    oidc_issuer_url: str = "http://localhost:9000/application/o/web-spa/"
    oidc_jwks_url: str = ""
    oidc_client_id: str = "web-spa"

    internal_service_token: str = "dev-internal-token"
    agent_service_url: str = "http://localhost:8001"
    execution_service_url: str = "http://localhost:8002"
    knowledge_service_url: str = "http://localhost:8003"
    redis_url: str = "redis://localhost:6379/1"


settings = Settings()
