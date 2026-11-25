"""L'agent MemoPli : « Pli », l'assistant qui lit le dossier et cite ses pages.

Ce qui part au modèle : la question, les derniers échanges, les faits calculés
par `state.py` et des morceaux du **DAO** seulement. Les pièces de l'entreprise
restent locales : elles sont indexées, l'agent peut les nommer, mais leur texte
n'entre jamais dans une requête. C'est la règle « les pièces ne partent jamais
au modèle », tenue par construction et non par discipline.
"""
from __future__ import annotations

import json

from . import ai, rag, state
from .config import settings
from .db import connect, rows
from .ids import nid, stamp

SYSTEM = """Tu es Pli, l'assistant de MemoPli, un poste de travail pour répondre aux appels d'offres.
Tu réponds en français, en trois phrases maximum, sans emphase commerciale ni promesse.

Règles strictes :
- n'utilise que les extraits de dossier et les faits fournis ci-dessous ;
- si l'information n'y est pas, écris « le dossier ne le dit pas » et rien d'autre ;
- quand la question porte sur plusieurs points, traite-les séparément : réponds à ceux que le dossier tranche, et n'écris « le dossier ne le dit pas » que pour les autres ;
- chaque affirmation tirée du dossier cite sa page entre crochets, par exemple [p.12] ;
- quand plusieurs extraits donnent la même information, garde le plus précis : un montant en FCFA plutôt qu'un pourcentage, une date complète plutôt qu'un mois ;
- les faits (statuts, dates, totaux, compteurs) sont calculés par le logiciel : reprends-les tels quels, ne les recalcule pas, ne les arrondis pas différemment ;
- ne complète jamais une information manquante par une supposition."""


def identity() -> dict:
    return {
        "nom": "Pli",
        "role": "assistant du dossier d'appel d'offres",
        "accueil": "Je lis le dossier avec vous. Demandez-moi une exigence, une date, une pièce qui bloque.",
        "capacites": [
            "retrouver une exigence et sa page",
            "dire ce qui bloque la soumission",
            "rappeler la date limite et le coût déjà engagé",
            "pointer une pièce du coffre sans en divulguer le contenu",
        ],
        "limites": [
            "ne répond pas sur un document qui n'est pas indexé",
            "n'invente pas une information absente du dossier",
        ],
        "modele": ai.MODEL_CHAT,
        "configure": ai.configured(),
    }


def _historique(org_id: str, tender_id: str | None, limite: int = 6) -> list[dict]:
    with connect() as conn:
        if tender_id:
            lignes = rows(conn.execute(
                "SELECT role, content FROM agent_messages WHERE org_id=? AND tender_id=?"
                " ORDER BY created_at DESC, rowid DESC LIMIT ?", (org_id, tender_id, limite)))
        else:
            lignes = rows(conn.execute(
                "SELECT role, content FROM agent_messages WHERE org_id=?"
                " ORDER BY created_at DESC, rowid DESC LIMIT ?", (org_id, limite)))
    return [{"role": l["role"], "content": l["content"]} for l in reversed(lignes)]


def history(org_id: str, tender_id: str | None = None, limite: int = 40) -> list[dict]:
    with connect() as conn:
        if tender_id:
            lignes = rows(conn.execute(
                "SELECT id, role, content, citations, created_at FROM agent_messages"
                " WHERE org_id=? AND tender_id=? ORDER BY created_at, rowid LIMIT ?",
                (org_id, tender_id, limite)))
        else:
            lignes = rows(conn.execute(
                "SELECT id, role, content, citations, created_at FROM agent_messages"
                " WHERE org_id=? ORDER BY created_at, rowid LIMIT ?", (org_id, limite)))
    for ligne in lignes:
        ligne["citations"] = json.loads(ligne["citations"]) if ligne["citations"] else []
    return lignes


def _enregistre(org_id: str, tender_id: str | None, role: str, contenu: str,
                citations: list | None = None) -> None:
    with connect() as conn:
        conn.execute(
            "INSERT INTO agent_messages(id,org_id,tender_id,role,content,citations,created_at)"
            " VALUES (?,?,?,?,?,?,?)",
            (nid("msg"), org_id, tender_id, role, contenu,
             json.dumps(citations or [], ensure_ascii=False), stamp()),
        )


def answer(org_id: str, message: str, tender_id: str | None = None,
           request_id: str | None = None) -> dict:
    """Une question, une réponse ancrée : contexte récupéré localement, faits calculés."""
    faits = state.facts(org_id, tender_id)
    # on ne met dans le prompt que des morceaux du DAO : les pièces restent locales
    trouves = rag.search(org_id, message, k=settings.rag_k, tender_id=tender_id, kinds=("dao",))

    extraits = "\n\n".join(
        f"[p.{c['page']}] {c.get('text') or c['extrait']}" for c in trouves
    ) or "(aucun extrait du dossier ne correspond à la question)"

    messages = [{"role": "system", "content": SYSTEM}]
    messages += _historique(org_id, tender_id)
    messages.append({
        "role": "user",
        "content": (
            f"Faits calculés (à reprendre tels quels) :\n{json.dumps(faits, ensure_ascii=False)}\n\n"
            f"Extraits du dossier d'appel d'offres :\n{extraits}\n\n"
            f"Question : {message}"
        ),
    })

    texte, meta = ai.chat_messages(messages, ai.MODEL_CHAT)
    citations = [
        {"document_id": c["document_id"], "page": c["page"], "score": c["score"],
         "extrait": c["extrait"][:200]}
        for c in trouves
    ]
    _enregistre(org_id, tender_id, "user", message)
    _enregistre(org_id, tender_id, "assistant", texte, citations)
    return {
        "answer": texte,
        "citations": citations,
        "meta": meta,
        "contexte": {"morceaux": len(trouves), "pieces_envoyees": 0},
    }
