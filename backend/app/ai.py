"""Client RodiumAi : appels modèles (compatible OpenAI) + validation JSON.

Toute la configuration vient de `config.py` : la clé est lue au moment de l'appel,
pas à l'import, sinon un `RODIUM_API_KEY` posé dans `.env` arriverait trop tard.
"""
from __future__ import annotations

import json
import re
import time

import httpx

from .config import settings

# dépendances : noms exposés aux routes, résolus depuis les réglages
MODEL_EXTRACT = settings.model_extract
MODEL_MATCH = settings.model_match
MODEL_DRAFT = settings.model_draft
MODEL_CHAT = settings.model_chat
MODEL_OCR = settings.model_ocr

# statuts qui méritent un second essai (le fournisseur répond « réessayez »)
RETRY_STATUS = {408, 425, 429, 500, 502, 503, 504}


class AIError(RuntimeError):
    def __init__(self, message: str, status: int | None = None):
        super().__init__(message)
        self.status = status


def configured() -> bool:
    return bool(settings.ai_key)


def _post(payload: dict, attempts: int = 2) -> dict:
    if not settings.ai_key:
        raise AIError("RODIUM_API_KEY absente")
    url = settings.ai_base_url.rstrip("/") + "/chat/completions"
    headers = {"Authorization": f"Bearer {settings.ai_key}", "Content-Type": "application/json"}
    dernier = "aucune tentative"
    for essai in range(attempts):
        if essai:
            time.sleep(1.5 * essai)
        try:
            with httpx.Client(timeout=settings.ai_timeout) as client:
                r = client.post(url, json=payload, headers=headers)
        except httpx.HTTPError as exc:
            dernier = f"réseau : {type(exc).__name__}"
            continue
        if r.status_code < 400:
            return r.json()
        dernier = f"API {r.status_code}: {r.text[:300]}"
        if r.status_code not in RETRY_STATUS:
            break
    raise AIError(dernier)


def _meta(model: str, started: float, usage: dict) -> dict:
    tokens_in = int(usage.get("prompt_tokens") or 0)
    tokens_out = int(usage.get("completion_tokens") or 0)
    return {
        "model": model,
        "seconds": round(time.time() - started, 2),
        "tokens_in": tokens_in,
        "tokens_out": tokens_out,
        "cost_fcfa": round(tokens_in / 1000 * settings.cost_in + tokens_out / 1000 * settings.cost_out, 2),
    }


def chat_json(system: str, user: str, model: str) -> tuple[dict, dict]:
    """Appel avec sortie JSON stricte. Retourne (objet, méta)."""
    payload = {
        "model": model,
        "temperature": 0,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "response_format": {"type": "json_object"},
    }
    started = time.time()
    data = _post(payload)
    content = data["choices"][0]["message"]["content"]
    try:
        obj = json.loads(content)
    except json.JSONDecodeError:
        # dernier recours : récupérer le premier bloc { ... }
        m = re.search(r"\{.*\}", content, re.S)
        if not m:
            raise AIError("réponse non JSON") from None
        obj = json.loads(m.group(0))
    return obj, _meta(model, started, data.get("usage", {}))


def chat_text(system: str, user: str, model: str) -> tuple[str, dict]:
    payload = {
        "model": model,
        "temperature": 0.3,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    }
    started = time.time()
    data = _post(payload)
    text = data["choices"][0]["message"]["content"].strip()
    return text, _meta(model, started, data.get("usage", {}))


def chat_messages(messages: list[dict], model: str, temperature: float = 0.2) -> tuple[str, dict]:
    """Conversation avec historique : utilisé par l'agent."""
    payload = {"model": model, "temperature": temperature, "messages": messages}
    started = time.time()
    data = _post(payload)
    text = data["choices"][0]["message"]["content"].strip()
    return text, _meta(model, started, data.get("usage", {}))


def describe() -> dict:
    """Résumé sans secret, exposé par /health."""
    return {
        "configure": configured(),
        "modeles": {
            "extraction": MODEL_EXTRACT,
            "rapprochement": MODEL_MATCH,
            "redaction": MODEL_DRAFT,
            "agent": MODEL_CHAT,
            "ocr": MODEL_OCR,
        },
    }
