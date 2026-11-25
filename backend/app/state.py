"""État calculé d'un dossier : la seule source de vérité pour les faits.

Les routes et l'agent lisent tous les deux ce module : un blocage affiché à
l'écran et un blocage énoncé par l'agent ne peuvent pas diverger.
"""
from __future__ import annotations

from datetime import date

from .db import connect, rows
from .schemas import _squash

# Mots qui, dans l'intitulé d'une exigence, désignent un type de pièce précis.
# Une exigence qui n'en contient aucun n'est pas jugée : le code ne devine pas.
MOTS_PAR_TYPE = {
    "attestation_fiscale": ("fiscal", "impot", "ifu", "quitus"),
    "cnss": ("cnss", "securite sociale", "caisse nationale"),
    "rccm": ("rccm", "registre du commerce", "registre de commerce"),
    "reference": ("reference", "marches similaires", "marche similaire", "bonne execution",
                  "experience"),
    "bilan": ("bilan", "etats financiers", "chiffre d affaires"),
}


def types_attendus(label: str) -> set[str]:
    """Types de pièce que l'intitulé d'une exigence désigne ; vide si rien n'est reconnu."""
    texte = _squash(label or "")
    return {kind for kind, mots in MOTS_PAR_TYPE.items() if any(m in texte for m in mots)}


def types_compatibles(label: str, piece_kind: str | None) -> bool:
    """Le modèle propose, le code vérifie : une attestation fiscale ne répond pas à « CNSS »."""
    attendus = types_attendus(label)
    return not attendus or piece_kind in attendus or piece_kind == "autre"


def _jour(valeur: str | None) -> date | None:
    """Une date ISO, ou None : les statuts ne comparent jamais des chaînes approximatives."""
    try:
        return date.fromisoformat(valeur or "")
    except (TypeError, ValueError):
        return None


def reference_date(deadline: str | None = None, today: str | None = None) -> date:
    """Date à laquelle le bailleur jugera la pièce : la plus tardive entre aujourd'hui et la
    date limite du DAO. Une date limite illisible est ignorée : on retombe sur aujourd'hui.
    """
    aujourdhui = _jour(today) or date.today()
    limite = _jour(deadline)
    return max(aujourdhui, limite) if limite else aujourdhui


def compute_status(piece: dict | None, deadline: str | None = None,
                   today: str | None = None) -> tuple[str, str]:
    """Statut d'une pièce, calculé par le code, à la date où le bailleur la jugera."""
    if piece is None:
        return "manquant", "aucune pièce correspondante"
    brut = piece.get("expires_on")
    if not brut:
        return "a_verifier", "date de validité non déclarée"
    expire = _jour(brut)
    if not expire:
        return "a_verifier", f"date de validité illisible : {brut}"
    aujourdhui = _jour(today) or date.today()
    reference = reference_date(deadline, today)
    if expire < aujourdhui:
        return "perime", f"expirée le {expire:%d/%m/%Y}"
    if expire < reference:
        return "perime", f"expirera le {expire:%d/%m/%Y}, avant la date limite du {reference:%d/%m/%Y}"
    return "valide", f"valable jusqu'au {expire:%d/%m/%Y}"


def readiness(tender_id: str) -> dict:
    """Verdict du dossier : bloqué dès qu'une pièce obligatoire manque ou a expiré.

    Le statut est recalculé à chaque lecture depuis la date de la pièce : une pièce qui
    expire après le rapprochement ne reste jamais « valide ». La colonne `matches.status`
    n'est plus qu'un historique.
    """
    with connect() as conn:
        data = rows(conn.execute(
            """SELECT r.id, r.label, r.mandatory, m.id AS match_id, m.piece_id, m.reason AS match_reason,
                      p.expires_on, t.deadline
               FROM requirements r
               JOIN tenders t ON t.id = r.tender_id
               LEFT JOIN matches m ON m.requirement_id = r.id
               LEFT JOIN pieces p ON p.id = m.piece_id
               WHERE r.tender_id=? AND r.kind='piece'""",
            (tender_id,),
        ))
    for d in data:
        if d["match_id"] is None:
            d["status"], d["reason"] = None, None
        elif d["piece_id"] is None:
            # refus tranché par le code (mauvais type) : sa raison vaut mieux que « aucune pièce »
            d["status"], d["reason"] = "manquant", d["match_reason"] or "aucune pièce correspondante"
        else:
            d["status"], d["reason"] = compute_status({"expires_on": d["expires_on"]}, d["deadline"])
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

    aujourdhui = date.today().isoformat()
    dossier = next((d for d in dossiers if d["id"] == tender_id), None)
    # même date de référence que le verdict : l'agent ne peut pas contredire l'écran
    reference = reference_date(dossier["deadline"] if dossier else None)
    etat = {
        "entreprise": org[0]["name"] if org else None,
        "secteur": org[0]["sector"] if org else None,
        "pieces": {
            "total": len(pieces),
            "perimees": [p["label"] for p in pieces
                         if (expire := _jour(p["expires_on"])) and expire < reference],
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
        # la date à laquelle les pièces de ce dossier ont été jugées (défaut n° 2)
        "date_reference": reference.isoformat(),
    }
    if tender_id:
        verdict = readiness(tender_id)
        etat["dossier"] = {
            "titre": dossier["title"] if dossier else None,
            "acheteur": dossier["buyer"] if dossier else None,
            "date_limite": dossier["deadline"] if dossier else None,
            "pret": verdict["ready"],
            "blocages": [b["requirement"] + " (" + b["status"] + ")" for b in verdict["blockers"]],
        }
    return etat
