"""Contrat d'erreur unique : toute erreur sort en {"error": {code, message, request_id}}.

Le frontend (`frontend/src/api.js`) lit déjà `body.error.code` et
`body.error.message` : ce module aligne enfin le serveur sur ce contrat, y
compris pour les 404 et les erreurs de validation, qui renvoyaient `detail`.
"""
from __future__ import annotations

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

log = logging.getLogger("memopli.error")

# code stable par statut quand l'appelant n'en fournit pas
CODES = {
    400: "requete_invalide",
    401: "non_authentifie",
    403: "acces_refuse",
    404: "introuvable",
    405: "methode_non_permise",
    409: "conflit",
    413: "fichier_trop_lourd",
    415: "format_non_supporte",
    422: "requete_invalide",
    429: "trop_de_requetes",
    500: "erreur_interne",
    502: "ia_indisponible",
    503: "service_indisponible",
}


class ApiError(Exception):
    """Erreur métier : code stable, statut HTTP, en-têtes éventuels."""

    def __init__(self, code: str, message: str, status: int = 400, headers: dict[str, str] | None = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status
        self.headers = headers or {}


def abort(code: str, message: str, status: int = 400, headers: dict[str, str] | None = None):
    raise ApiError(code, message, status, headers)


def _render(status: int, code: str, message: str, request: Request,
            headers: dict[str, str] | None = None) -> JSONResponse:
    rid = getattr(request.state, "request_id", None)
    return JSONResponse(
        status_code=status,
        content={"error": {"code": code, "message": message, "request_id": rid}},
        headers=headers,
    )


# Starlette répond en anglais sur ses propres erreurs : on garde le contrat en français
DEFAULT_MESSAGES = {
    "Not Found": "ressource inconnue",
    "Method Not Allowed": "méthode non permise",
    "Forbidden": "accès refusé",
    "Bad Request": "requête invalide",
    "Internal Server Error": "erreur interne, réessayez",
}


def _detail_message(exc: StarletteHTTPException) -> str:
    if isinstance(exc.detail, str) and exc.detail.strip():
        return DEFAULT_MESSAGES.get(exc.detail.strip(), exc.detail)
    return "requête refusée"


def _validation_message(exc: RequestValidationError) -> str:
    parts = []
    for err in exc.errors()[:5]:
        loc = ".".join(str(p) for p in err.get("loc", ()) if p not in ("body", "query", "path"))
        msg = err.get("msg", "invalide")
        parts.append(f"{loc} : {msg}" if loc else msg)
    return " ; ".join(parts) or "requête invalide"


def install(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def _api_error(request: Request, exc: ApiError):
        return _render(exc.status, exc.code, exc.message, request, exc.headers)

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(request: Request, exc: StarletteHTTPException):
        code = CODES.get(exc.status_code, f"http_{exc.status_code}")
        return _render(exc.status_code, code, _detail_message(exc), request, exc.headers)

    @app.exception_handler(RequestValidationError)
    async def _validation_error(request: Request, exc: RequestValidationError):
        return _render(422, "requete_invalide", _validation_message(exc), request)

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception):
        rid = getattr(request.state, "request_id", None)
        log.exception("erreur_non_geree path=%s request_id=%s", request.url.path, rid)
        return _render(500, "erreur_interne", "erreur interne, réessayez", request)
