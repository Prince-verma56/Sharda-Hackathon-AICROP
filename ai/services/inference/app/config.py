"""Service configuration. All values come from environment variables (server-only)."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

SERVICE_DIR = Path(__file__).resolve().parents[1]
DEFAULT_MODEL_DIR = SERVICE_DIR.parents[1] / "models" / "agrismart-india"


class Settings(BaseSettings):
    # Real environment variables win; ai/services/inference/.env (git-ignored) is a local fallback.
    model_config = SettingsConfigDict(env_file=SERVICE_DIR / ".env", env_file_encoding="utf-8",
                                      extra="ignore", protected_namespaces=())

    # Shared secret between the Next.js server and this service. Never NEXT_PUBLIC_*.
    ai_service_token: str = Field(default="", alias="AI_SERVICE_TOKEN")
    # Folder holding predict.py, weights.json and reports/ (the model package).
    model_dir: Path = Field(default=DEFAULT_MODEL_DIR, alias="AGRISMART_MODEL_DIR")
    # Explicit checkpoint path; defaults to <model_dir>/checkpoints/model.pt.
    model_path: Path | None = Field(default=None, alias="AGRISMART_MODEL_PATH")
    device: Literal["auto", "cpu", "cuda"] = Field(default="auto", alias="AI_INFERENCE_DEVICE")
    threads: int = Field(default=4, ge=1, le=16, alias="AI_INFERENCE_THREADS")
    timeout_seconds: float = Field(default=60, gt=0, le=300, alias="AI_INFERENCE_TIMEOUT_SECONDS")
    # Requests allowed in flight (1 running + queued). Beyond this -> 429.
    max_in_flight: int = Field(default=2, ge=1, le=16, alias="AI_INFERENCE_MAX_IN_FLIGHT")
    enable_docs: bool = Field(default=True, alias="AI_INFERENCE_ENABLE_DOCS")
    log_level: str = Field(default="INFO", alias="AI_INFERENCE_LOG_LEVEL")

    @field_validator("model_path", mode="before")
    @classmethod
    def _empty_path_is_none(cls, value):
        return value or None

    @property
    def checkpoint_path(self) -> Path:
        return self.model_path or self.model_dir / "checkpoints" / "model.pt"


@lru_cache
def get_settings() -> Settings:
    return Settings()
