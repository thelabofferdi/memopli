"""Recherche documentaire (RAG) : BM25 en Python, cloisonné par entreprise.

Pourquoi pas d'embeddings : la passerelle RodiumAi les rend indisponibles
(`502 provider temporarily unavailable` / `503 model unavailable`, constaté sur
`gemini-embedding-001` et `text-embedding-004`). Et sur du français
administratif, retrouver « garantie de soumission » ou « attestation CNSS » est
un problème de termes exacts, pas de voisinage sémantique. BM25 est
déterministe, sans coût par document et testable — le score est calculé par le
code, jamais par le modèle.

Cloisonnement : on ne lit que les morceaux des documents de l'entreprise
demandée. Aucune requête ne peut franchir l'organisation.
"""
from __future__ import annotations

import math
import re
import unicodedata
from collections import Counter

from .db import connect, rows

K1 = 1.5
B = 0.75
MAX_CHUNKS = 20_000  # borne de lecture : au-delà, on tronque plutôt que de tout charger

STOPWORDS = {
    "le", "la", "les", "un", "une", "des", "du", "de", "d", "et", "ou", "a", "au", "aux",
    "en", "dans", "sur", "pour", "par", "avec", "sans", "que", "qui", "quoi", "dont", "est",
    "sont", "etre", "avoir", "il", "elle", "ils", "elles", "on", "nous", "vous", "je", "tu",
    "ce", "cet", "cette", "ces", "son", "sa", "ses", "leur", "leurs", "plus", "moins", "tout",
    "tous", "toute", "toutes", "the", "of", "and", "to", "in",
}


def tokenize(texte: str) -> list[str]:
    texte = unicodedata.normalize("NFD", (texte or "").lower())
    texte = "".join(c for c in texte if unicodedata.category(c) != "Mn")
    mots = re.findall(r"[a-z0-9]{2,}", texte)
    return [m for m in mots if m not in STOPWORDS]


def _charge(org_id: str, tender_id: str | None) -> list[dict]:
    """Morceaux de l'entreprise, avec leur document et leur page."""
    requete = (
        "SELECT c.id, c.page, c.text, d.id AS document_id, d.kind, d.filename, d.tender_id, d.piece_id"
        " FROM chunks c JOIN documents d ON d.id = c.document_id WHERE d.org_id=?"
    )
    args: list = [org_id]
    if tender_id:
        requete += " AND (d.tender_id=? OR d.piece_id IS NOT NULL)"
        args.append(tender_id)
    requete += " ORDER BY c.document_id, c.ordre LIMIT " + str(MAX_CHUNKS)
    with connect() as conn:
        return rows(conn.execute(requete, tuple(args)))


def search(org_id: str, requete: str, k: int = 6, tender_id: str | None = None,
           kinds: tuple[str, ...] | None = None) -> list[dict]:
    """Meilleurs morceaux pour la question, du plus pertinent au moins pertinent."""
    mots = tokenize(requete)
    if not mots:
        return []
    morceaux = [m for m in _charge(org_id, tender_id) if not kinds or m["kind"] in kinds]
    if not morceaux:
        return []

    documents = [tokenize(m["text"]) for m in morceaux]
    longueur_moyenne = sum(len(d) for d in documents) / len(documents) or 1.0
    df: Counter = Counter()
    for mots_doc in documents:
        df.update(set(mots_doc))
    n = len(documents)

    scores: list[tuple[float, dict]] = []
    for morceau, mots_doc in zip(morceaux, documents):
        if not mots_doc:
            continue
        freq = Counter(mots_doc)
        score = 0.0
        for mot in mots:
            if mot not in freq:
                continue
            idf = math.log(1 + (n - df[mot] + 0.5) / (df[mot] + 0.5))
            tf = freq[mot]
            score += idf * (tf * (K1 + 1)) / (
                tf + K1 * (1 - B + B * len(mots_doc) / longueur_moyenne)
            )
        if score > 0:
            scores.append((score, morceau))

    scores.sort(key=lambda couple: couple[0], reverse=True)
    retenus = []
    for score, morceau in scores[:k]:
        retenus.append({
            "document_id": morceau["document_id"],
            "kind": morceau["kind"],
            "page": morceau["page"],
            "tender_id": morceau["tender_id"],
            "piece_id": morceau["piece_id"],
            "score": round(score, 3),
            "extrait": morceau["text"][:400],  # pour l'affichage
            "text": morceau["text"],           # pour le modèle : couper ici lui cacherait la fin de page
        })
    return retenus


def stats(org_id: str) -> dict:
    with connect() as conn:
        docs = rows(conn.execute(
            "SELECT COUNT(*) AS n, COALESCE(SUM(chars),0) AS chars FROM documents WHERE org_id=?",
            (org_id,)))
        chunks = rows(conn.execute(
            "SELECT COUNT(*) AS n FROM chunks c JOIN documents d ON d.id=c.document_id WHERE d.org_id=?",
            (org_id,)))
    return {"documents": docs[0]["n"], "caracteres": docs[0]["chars"], "morceaux": chunks[0]["n"]}
