from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://platform:platform@localhost:5432/platform"
    internal_service_token: str = "dev-internal-token"


settings = Settings()
