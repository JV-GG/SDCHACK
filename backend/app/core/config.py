import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Autonomous SME GrantFlow & Claim Engine"
    API_V1_STR: str = "/api/v1"
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]

    # Tier 1: Primary Cloud AI (Fast 1.8s, High Stability)
    DEEPSEEK_API_KEY: str = os.getenv("DEEPSEEK_API_KEY", "")
    DEEPSEEK_BASE_URL: str = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
    DEEPSEEK_MODEL: str = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")

    # Tier 2: RunPod Serverless GPU Failover
    RUNPOD_API_KEY: str = os.getenv("RUNPOD_API_KEY", "")
    RUNPOD_BASE_URL: str = os.getenv("RUNPOD_BASE_URL", "https://api.runpod.ai/v2/reig5yleze9o5f/openai/v1")
    RUNPOD_MODEL: str = os.getenv("RUNPOD_MODEL", "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B")

    # Optional Gemini
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")

    # Year-round opportunity scan: hours between automatic scans of every org (0 disables).
    SCHEDULED_SCAN_INTERVAL_HOURS: float = 24.0

    # Neon Postgres Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql://neondb_owner:npg_fANEriJHP0q1@ep-long-haze-az9yxzo0-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require"
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore"
    )

settings = Settings()
