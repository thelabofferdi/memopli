"""Limitation de débit : fenêtre glissante en mémoire, par IP et par classe de route.

Suffisant pour un déploiement à un seul processus ; les compteurs sont vidés au
redémarrage. Les routes qui appellent le modèle coûtent de l'argent et les routes
de connexion se devinent : elles sont plafonnées séparément.
"""
from __future__ import annotations

import ipaddress
import time
from collections import OrderedDict, deque

from fastapi import Request

from .config import settings
from .errors import abort

# OrderedDict pour évincer le compartiment le moins récemment vu, jamais tout vider
WINDOW_HITS: OrderedDict[tuple[str, str], deque[float]] = OrderedDict()
MAX_BUCKETS = 10_000


def _normalize_ip(value: str) -> str:
    """Une valeur d'IP valide, sinon une clé commune : jamais une clé unique par requête."""
    candidate = (value or "").strip().strip("[]")
    if candidate.count(":") == 1:  # "1.2.3.4:5678"
        hote, _, port = candidate.partition(":")
        if port.isdigit():
            candidate = hote
    try:
        return ipaddress.ip_address(candidate).compressed
    except ValueError:
        return "inconnu"


def client_ip(request: Request) -> str:
    if settings.trust_proxy:
        forwarded = [part for part in request.headers.get("x-forwarded-for", "").split(",") if part.strip()]
        if forwarded:
            # le saut le plus à droite est celui ajouté par notre proxy ; ceux de gauche sont du client
            return _normalize_ip(forwarded[-1])
    return _normalize_ip(request.client.host if request.client else "")


def _ceiling(bucket: str) -> int:
    """Plafond courant : relu à chaque appel pour rester réglable à chaud."""
    if bucket.startswith("auth"):
        return settings.rate_auth_per_minute
    if bucket == "ai":
        return settings.rate_ai_per_hour
    return settings.rate_upload_per_hour


def _bucket(key: tuple[str, str], window: int, now: float) -> deque[float]:
    hits = WINDOW_HITS.get(key)
    if hits is None:
        hits = deque()
        WINDOW_HITS[key] = hits
        while len(WINDOW_HITS) > MAX_BUCKETS:  # borne la mémoire sans offrir de remise à zéro
            WINDOW_HITS.popitem(last=False)
    else:
        WINDOW_HITS.move_to_end(key)
    while hits and now - hits[0] > window:
        hits.popleft()
    return hits


def exceeded(bucket: str, value: str, ceiling: int, window: int) -> int | None:
    """Secondes d'attente si le plafond est déjà atteint, sinon ``None``."""
    hits = _bucket((bucket, value), window, time.monotonic())
    if len(hits) < ceiling:
        return None
    return max(1, int(window - (time.monotonic() - hits[0])))


def record(bucket: str, value: str, window: int) -> None:
    _bucket((bucket, value), window, time.monotonic()).append(time.monotonic())


def clear(bucket: str, value: str) -> None:
    """Efface un compartiment (connexion réussie : on repart de zéro)."""
    WINDOW_HITS.pop((bucket, value), None)


def limit(bucket: str, window: int):
    """Fabrique une dépendance FastAPI : `Depends(limit("ai", 3600))`."""

    async def dependency(request: Request) -> None:
        if not settings.rate_limit:
            return
        ceiling = _ceiling(bucket)
        key_value = client_ip(request)
        retry = exceeded(bucket, key_value, ceiling, window)
        if retry is not None:
            abort("trop_de_requetes",
                  f"trop de requêtes sur cette route, réessayez dans {retry} s",
                  429, {"Retry-After": str(retry)})
        record(bucket, key_value, window)

    return dependency


def auth_guard():
    return limit("auth", 60)


def ai_guard():
    return limit("ai", 3600)


def upload_guard():
    return limit("upload", 3600)


def reset() -> None:
    WINDOW_HITS.clear()
