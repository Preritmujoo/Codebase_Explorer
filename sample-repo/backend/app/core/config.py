from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str = "sqlite:///./shop.db"
    secret_key: str = "supersecret"
    debug: bool = True

settings = Settings()
