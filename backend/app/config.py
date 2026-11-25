"""Configuration d'exécution : une seule lecture de l'environnement, validée au boot.

Les valeurs invalides échouent au démarrage plutôt qu'au milieu d'une requête.
`.env` (jamais versionné) est chargé s'il existe, sans écraser une variable
déjà définie par le processus.
"""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def _load_env_file(path: Path) -> None:
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip("\"'"))


_load_env_file(Path(os.getenv("ENV_FILE") or ROOT / ".env"))


def _int(name: str, default: int, low: int, high: int) -> int:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        value = int(raw)
    except ValueError:
        raise RuntimeError(f"{name} doit être un entier, reçu {raw!r}") from None
    if not low <= value <= high:
        raise RuntimeError(f"{name} doit être compris entre {low} et {high}, reçu {value}")
    return value


def _bool(name: str, default: bool) -> bool:
    raw = os.getenv(name, "").strip().lower()
    if not raw:
        return default
    if raw in {"1", "true", "yes", "on"}:
        return True
    if raw in {"0", "false", "no", "off"}:
        return False
    raise RuntimeError(f"{name} doit valoir true ou false, reçu {raw!r}")


def _float(name: str, default: float, low: float, high: float) -> float:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        value = float(raw)
    except ValueError:
        raise RuntimeError(f"{name} doit être un nombre, reçu {raw!r}") from None
    if not low <= value <= high:
        raise RuntimeError(f"{name} doit être compris entre {low} et {high}, reçu {value}")
    return value


def _list(name: str, default: str) -> list[str]:
    raw = os.getenv(name, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


@dataclass
class Settings:
    """Réglages d'exécution. Mutable : les tests ajustent les plafonds."""

    db_path: Path = field(default_factory=lambda: Path(os.getenv("DATABASE_PATH", "data/app.db")))
    upload_dir: Path = field(default_factory=lambda: Path(os.getenv("UPLOAD_DIR", "data/uploads")))
    max_upload_mb: int = field(default_factory=lambda: _int("MAX_UPLOAD_MB", 20, 1, 200))
    max_pages: int = field(default_factory=lambda: _int("MAX_PAGES", 400, 1, 5000))
    max_chars: int = field(default_factory=lambda: _int("MAX_CHARS", 2_000_000, 10_000, 50_000_000))
    cors_origins: list[str] = field(
        default_factory=lambda: _list("CORS_ORIGIN", "http://127.0.0.1:5173,http://localhost:5173")
    )
    allowed_hosts: list[str] = field(
        default_factory=lambda: _list("ALLOWED_HOSTS", "127.0.0.1,localhost,testserver")
    )
    trust_proxy: bool = field(default_factory=lambda: _bool("TRUST_PROXY", False))
    auth_required: bool = field(default_factory=lambda: _bool("AUTH_REQUIRED", False))
    session_days: int = field(default_factory=lambda: _int("SESSION_DAYS", 30, 1, 365))
    rate_limit: bool = field(default_factory=lambda: _bool("RATE_LIMIT", True))
    rate_ai_per_hour: int = field(default_factory=lambda: _int("RATE_AI_PER_HOUR", 60, 1, 10_000))
    rate_upload_per_hour: int = field(default_factory=lambda: _int("RATE_UPLOAD_PER_HOUR", 60, 1, 10_000))
    rate_auth_per_minute: int = field(default_factory=lambda: _int("RATE_AUTH_PER_MINUTE", 10, 1, 1_000))
    docs_enabled: bool = field(default_factory=lambda: _bool("DOCS_ENABLED", False))
    # --- RodiumAi : noms de modèles exacts, vérifiés contre GET /v1/models
    ai_base_url: str = field(default_factory=lambda: os.getenv("RODIUM_BASE_URL", "https://api.rodiumai.io/v1").strip())
    model_extract: str = field(default_factory=lambda: os.getenv("MODEL_EXTRACT", "anthropic/claude-haiku-4-5-20251001").strip())
    model_match: str = field(default_factory=lambda: os.getenv("MODEL_MATCH", "google/gemini-3.5-flash-lite").strip())
    model_draft: str = field(default_factory=lambda: os.getenv("MODEL_DRAFT", "anthropic/claude-haiku-4-5-20251001").strip())
    model_chat: str = field(default_factory=lambda: os.getenv("MODEL_CHAT", "google/gemini-3.5-flash").strip())
    ai_timeout: float = field(default_factory=lambda: _float("AI_TIMEOUT", 120.0, 5.0, 600.0))
    cost_in: float = field(default_factory=lambda: _float("COST_IN", 1.2, 0.0, 1000.0))
    cost_out: float = field(default_factory=lambda: _float("COST_OUT", 6.0, 0.0, 1000.0))
    # --- recherche documentaire (RAG) et OCR
    rag_chunk_chars: int = field(default_factory=lambda: _int("RAG_CHUNK_CHARS", 1200, 200, 4000))
    rag_k: int = field(default_factory=lambda: _int("RAG_K", 6, 1, 20))
    model_ocr: str = field(default_factory=lambda: os.getenv("MODEL_OCR", "google/gemini-3.5-flash").strip())
    ocr_vision: bool = field(default_factory=lambda: _bool("OCR_VISION", False))
    ocr_langs: str = field(default_factory=lambda: os.getenv("OCR_LANGS", "fra").strip())
    ocr_max_pages: int = field(default_factory=lambda: _int("OCR_MAX_PAGES", 10, 1, 200))
    app_env: str = field(default_factory=lambda: os.getenv("APP_ENV", "dev").strip().lower())
    ai_key: str = field(default_factory=lambda: os.getenv("RODIUM_API_KEY", "").strip())

    @property
    def body_limit(self) -> int:
        """Plafond du corps de requête : l'upload toléré plus la marge multipart."""
        return self.max_upload_mb * 1024 * 1024 + 1024 * 1024


settings = Settings()


def enforce() -> None:
    """Réglages inacceptables en production : on refuse de démarrer plutôt que de servir ouvert."""
    if settings.app_env not in ("dev", "prod"):
        raise RuntimeError(f"APP_ENV doit valoir dev ou prod, reçu {settings.app_env!r}")
    if settings.app_env == "prod":
        if not settings.auth_required:
            raise RuntimeError(
                "APP_ENV=prod exige AUTH_REQUIRED=true : sans jeton, l'API expose toutes les organisations"
            )
        if "*" in settings.cors_origins:
            raise RuntimeError("APP_ENV=prod interdit CORS_ORIGIN=* : indiquer l'origine du front")


def describe() -> dict:
    """Résumé journalisé au démarrage : aucun secret n'y figure."""
    return {
        "base": str(settings.db_path),
        "auth_required": settings.auth_required,
        "rate_limit": settings.rate_limit,
        "cors_origins": settings.cors_origins,
        "allowed_hosts": settings.allowed_hosts,
        "max_upload_mb": settings.max_upload_mb,
        "docs_enabled": settings.docs_enabled,
        "env": settings.app_env,
        "cle_ia": "présente" if settings.ai_key else "absente",
        "modeles": {"extraction": settings.model_extract, "rapprochement": settings.model_match,
                    "redaction": settings.model_draft, "agent": settings.model_chat},
    }


def check() -> list[str]:
    """Avertissements de démarrage (non bloquants) sur les réglages risqués."""
    warnings = []
    if "*" in settings.cors_origins:
        warnings.append("CORS_ORIGIN=* : toute origine peut appeler l'API")
    if not settings.ai_key:
        warnings.append("RODIUM_API_KEY absente : extraction, rapprochement et rédaction échoueront en 502")
    if not settings.auth_required:
        warnings.append("AUTH_REQUIRED=false : l'API est ouverte, l'isolation par organisation n'est pas imposée")
    if settings.docs_enabled:
        warnings.append("DOCS_ENABLED=true : /docs et /openapi.json sont publics")
    return warnings
