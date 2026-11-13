from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict


class HealthResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    status: Literal["healthy", "loading", "degraded"]
    model_loaded: bool
    model_state: Literal["loading", "ready", "failed"]
    model_version: str | None
    model_sha256: str | None
    device: str | None
    mode: Literal["real", "unavailable"]
    error_code: str | None
    load_ms: int | None
    uptime_s: int
    requests_served: int
