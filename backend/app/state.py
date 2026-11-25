"""État calculé d'un dossier : la seule source de vérité pour les faits.

Les routes et l'agent lisent tous les deux ce module : un blocage affiché à
l'écran et un blocage énoncé par l'agent ne peuvent pas diverger.
"""
from __future__ import annotations

from datetime import date

from .db import connect, rows


def readiness(tender_id: str) -> dict:
    """Verdict du dossier : bloqué dès qu'une pièce obligatoire manque ou a expiré."""
    with connect() as conn:
        data = rows(conn.execute(
            """SELECT r.id, r.label, r.mandatory, m.status, m.reason, p.expires_on
               FROM requirements r
               LEFT JOIN matches m ON m.requirement_id = r.id
               LEFT JOIN pieces p ON p.id = m.piece_id
               WHERE r.tender_id=? AND r.kind='piece'""",
            (tender_id,),
        ))
    blocages = [
        {"requirement": d["label"], "status": d["status"] or "manquant",
         "reason": d["reason"], "expires_on": d["expires_on"]}
        for d in data
        if d["mandatory"] and (d["status"] or "manquant") in ("manquant", "perime")
    ]
    return {
        "ready": not blocages,
        "blockers": blocages,
        "checked": len(data),
        "matched": sum(1 for d in data if d["status"]),
    }


def facts(org_id: str, tender_id: str | None = None) -> dict:
    """Faits destinés à l'agent : tout est calculé ici, rien n'est laissé au modèle."""
    aujourdhui = date.today().isoformat()
    with connect() as conn:
        org = rows(conn.execute("SELECT name, sector FROM organizations WHERE id=?", (org_id,)))
        pieces = rows(conn.execute(
            "SELECT label, kind, expires_on FROM pieces WHERE org_id=? ORDER BY created_at",
            (org_id,)))
        dossiers = rows(conn.execute(
            "SELECT id, title, buyer, deadline FROM tenders WHERE org_id=?"
            " ORDER BY created_at DESC, rowid DESC", (org_id,)))
        cout = rows(conn.execute(
            "SELECT COALESCE(SUM(cost_fcfa),0) AS total, COUNT(*) AS appels FROM ai_calls"
            " WHERE tender_id IN (SELECT id FROM tenders WHERE org_id=?)", (org_id,)))
        documents = rows(conn.execute(
            "SELECT COUNT(*) AS n, COALESCE(SUM(chars),0) AS chars FROM documents WHERE org_id=?",
            (org_id,)))

    etat = {
        "entreprise": org[0]["name"] if org else None,
        "secteur": org[0]["sector"] if org else None,
        "pieces": {
            "total": len(pieces),
            "perimees": [p["label"] for p in pieces if p["expires_on"] and p["expires_on"] < aujourdhui],
            "sans_date": [p["label"] for p in pieces if not p["expires_on"]],
        },
        "dossiers": [
            {"titre": d["title"], "acheteur": d["buyer"], "date_limite": d["deadline"]}
            for d in dossiers[:5]
        ],
        "cout_fcfa": round(float(cout[0]["total"]), 2),
        "appels_ia": cout[0]["appels"],
        "documents_indexes": documents[0]["n"],
        "caracteres_indexes": documents[0]["chars"],
        "aujourd_hui": aujourdhui,
    }
    if tender_id:
        verdict = readiness(tender_id)
        dossier = next((d for d in dossiers if d["id"] == tender_id), None)
        etat["dossier"] = {
            "titre": dossier["title"] if dossier else None,
            "acheteur": dossier["buyer"] if dossier else None,
            "date_limite": dossier["deadline"] if dossier else None,
            "pret": verdict["ready"],
            "blocages": [b["requirement"] + " (" + b["status"] + ")" for b in verdict["blockers"]],
        }
    return etat
