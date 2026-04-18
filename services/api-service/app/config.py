from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    oidc_issuer_url: str = "http://localhost:8080/authentik/application/o/web-spa/"
    oidc_jwks_url: str = ""
    oidc_client_id: str = "web-spa"
    # BFF login: server talks to Authentik over Docker network; redirect_uri must match OAuth provider.
    authentik_internal_base: str = "http://authentik-server:9000/authentik"
    authentik_auth_flow_slug: str = "default-authentication-flow"
    oidc_redirect_uri: str = "http://localhost:8080/callback"

    internal_service_token: str = "dev-internal-token"
    agent_service_url: str = "http://localhost:8001"
    execution_service_url: str = "http://localhost:8002"
    knowledge_service_url: str = "http://localhost:8003"
    redis_url: str = "redis://localhost:6379/1"


settings = Settings()
