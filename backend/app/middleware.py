"""Chaîne HTTP : identifiant de requête, journal d'accès, en-têtes de sécurité,
plafond du corps de requête et contrôle de l'hôte.

Le contrôle de l'hôte et du plafond est fait ici (et non par
`TrustedHostMiddleware`) pour que le refus respecte le contrat d'erreur JSON.
"""
from __future__ import annotations

import json
import logging
import re
import time
import uuid

from urllib.parse import urlsplit

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from .config import settings

log = logging.getLogger("memopli.access")

REQUEST_ID_RE = re.compile(r"^[A-Za-z0-9._-]{8,64}$")

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
}

CONTENT_SECURITY_POLICY = (
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
    "img-src 'self' data:; font-src 'self'; connect-src 'self'; "
    "frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
)

# chemins qui ne doivent jamais être mis en cache par un intermédiaire
NO_STORE_PREFIXES = ("/api/", "/health")


def setup_logging() -> None:
    """Journal lisible sur une ligne par événement, sans doublon de propagation."""
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(message)s"))
    for name in ("memopli", "memopli.access", "memopli.error"):
        logger = logging.getLogger(name)
        logger.setLevel(logging.INFO)
        logger.propagate = False
        if not logger.handlers:
            logger.addHandler(handler)


def host_allowed(host_header: str) -> bool:
    """Hôte comparé à la liste blanche, sans se laisser berner par une autorité falsifiée."""
    allowed = settings.allowed_hosts
    if "*" in allowed:
        return True
    host = (host_header or "").strip().lower()
    if not host or any(c in host for c in "@ /\\"):
        return False
    name = (urlsplit("//" + host).hostname or "").strip(".")
    if not name:
        return False
    for pattern in allowed:
        pattern = pattern.lower().strip(".")
        if pattern.startswith("*."):
            if name == pattern[2:] or name.endswith(pattern[1:]):
                return True
        elif name == pattern:
            return True
    return False


class BodyLimit:
    """Plafonne le corps réellement reçu, y compris sans `Content-Length` (chunked).

    Un plafond qui ne lit que l'en-tête se contourne en une ligne. On compte donc
    les octets au fil de l'eau ; dès dépassement, la réponse de l'application est
    remplacée par notre 413 au contrat, sans lever d'exception (FastAPI traduirait
    la levée en 400 « error parsing the body »).
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        limite = settings.body_limit
        etat = {"recus": 0, "depasse": False, "entete": False, "corps": False}

        async def guarded_receive():
            message = await receive()
            if message["type"] == "http.request":
                etat["recus"] += len(message.get("body", b""))
                if etat["recus"] > limite:
                    etat["depasse"] = True
            return message

        async def guarded_send(message):
            if not etat["depasse"]:
                await send(message)
                return
            if message["type"] not in ("http.response.start", "http.response.body"):
                await send(message)
                return
            if not etat["entete"]:
                etat["entete"] = True
                await send(self._start(scope))
            if message["type"] == "http.response.body" and not etat["corps"]:
                etat["corps"] = True
                await send({"type": "http.response.body",
                            "body": self._corps(self._identifiant(scope)), "more_body": False})

        return await self.app(scope, guarded_receive, guarded_send)

    @staticmethod
    def _corps(request_id: str | None = None) -> bytes:
        message = f"corps de requête trop lourd (max {settings.max_upload_mb} Mo)"
        return json.dumps({"error": {"code": "fichier_trop_lourd", "message": message,
                                     "request_id": request_id}}, ensure_ascii=False).encode()

    @staticmethod
    def _identifiant(scope) -> str | None:
        return (scope.get("state") or {}).get("request_id")

    def _start(self, scope) -> dict:
        corps = self._corps(self._identifiant(scope))
        return {
            "type": "http.response.start",
            "status": 413,
            "headers": [
                (b"content-type", b"application/json"),
                (b"content-length", str(len(corps)).encode()),
                (b"x-content-type-options", b"nosniff"),
            ],
        }


class HttpGuard(BaseHTTPMiddleware):
    """Une seule traversée : contexte, garde-fous, en-têtes, journal."""

    async def dispatch(self, request: Request, call_next) -> Response:
        started = time.perf_counter()
        rid = self._request_id(request)
        request.state.request_id = rid

        if not host_allowed(request.headers.get("host", "")):
            response = self._error(rid, "hote_non_autorise", "hôte non autorisé", 400)
        elif self._too_large(request):
            response = self._error(
                rid, "fichier_trop_lourd",
                f"corps de requête trop lourd (max {settings.max_upload_mb} Mo)", 413,
            )
        else:
            try:
                response = await call_next(request)
            except Exception:  # dernier recours : le contrat d'erreur tient quand même
                log.exception(json.dumps({"request_id": rid, "path": request.url.path,
                                          "issue": "exception_non_geree"}, ensure_ascii=False))
                response = self._error(rid, "erreur_interne", "erreur interne, réessayez", 500)

        self._decorate(response, rid, request.url.path)
        log.info(json.dumps({
            "request_id": rid,
            "method": request.method,
            "path": request.url.path,
            "status": response.status_code,
            "ms": round((time.perf_counter() - started) * 1000, 1),
            "ip": request.client.host if request.client else None,
        }, ensure_ascii=False))
        return response

    @staticmethod
    def _request_id(request: Request) -> str:
        candidate = request.headers.get("x-request-id", "").strip()
        return candidate if REQUEST_ID_RE.match(candidate) else uuid.uuid4().hex

    @staticmethod
    def _too_large(request: Request) -> bool:
        if request.method in ("GET", "HEAD", "OPTIONS"):
            return False
        raw = request.headers.get("content-length")
        if not raw:
            return False
        try:
            return int(raw) > settings.body_limit
        except ValueError:
            return True

    @staticmethod
    def _error(rid: str, code: str, message: str, status: int) -> JSONResponse:
        return JSONResponse(
            status_code=status,
            content={"error": {"code": code, "message": message, "request_id": rid}},
        )

    @staticmethod
    def _decorate(response: Response, rid: str, path: str) -> None:
        response.headers["X-Request-ID"] = rid
        for name, value in SECURITY_HEADERS.items():
            response.headers.setdefault(name, value)
        response.headers.setdefault("Content-Security-Policy", CONTENT_SECURITY_POLICY)
        if path.startswith(NO_STORE_PREFIXES):
            response.headers.setdefault("Cache-Control", "no-store")
