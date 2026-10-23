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

    # Neon Postgres connection string. Set it in backend/.env (local) or Replit Secrets; never in code.
    # When empty, the app runs on its local SQLite store only (the Neon mirror is skipped).
    DATABASE_URL: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore"
    )

settings = Settings()
