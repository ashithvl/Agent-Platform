from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    internal_service_token: str = "dev-internal-token"
    agent_service_url: str = "http://localhost:8001"
    litellm_url: str = "http://localhost:4000"
    litellm_api_key: str = "sk-litellm-master-key"
    langfuse_public_key: str = ""
    langfuse_secret_key: str = ""
    langfuse_host: str = ""


settings = Settings()
