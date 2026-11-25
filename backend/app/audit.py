"""Journal des appels modèle : modèle, tokens, durée, coût, dossier, requête.

`AGENTS.md` impose qu'un appel IA laisse une trace exploitable. Les totaux sont
calculés en code, jamais par le modèle.
"""
from __future__ import annotations

from .db import connect, rows
from .ids import nid, stamp


def log_ai_call(meta: dict, *, task: str, tender_id: str | None = None,
                request_id: str | None = None, ok: bool = True) -> None:
    with connect() as conn:
        conn.execute(
            "INSERT INTO ai_calls(id,request_id,task,model,tokens_in,tokens_out,seconds,cost_fcfa,tender_id,ok,created_at)"
            " VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            (
                nid("ai"), request_id, task, meta.get("model"),
                int(meta.get("tokens_in") or 0), int(meta.get("tokens_out") or 0),
                float(meta.get("seconds") or 0), float(meta.get("cost_fcfa") or 0),
                tender_id, 1 if ok else 0, stamp(),
            ),
        )


def tender_cost(tender_id: str) -> dict:
    """Coût cumulé d'un dossier, recalculé depuis les traces persistées."""
    with connect() as conn:
        calls = rows(conn.execute(
            "SELECT task, model, tokens_in, tokens_out, seconds, cost_fcfa, ok, created_at"
            " FROM ai_calls WHERE tender_id=? ORDER BY created_at",
            (tender_id,),
        ))
    totals = {
        "appels": len(calls),
        "tokens_in": sum(int(c["tokens_in"] or 0) for c in calls),
        "tokens_out": sum(int(c["tokens_out"] or 0) for c in calls),
        "seconds": round(sum(float(c["seconds"] or 0) for c in calls), 2),
        "cost_fcfa": round(sum(float(c["cost_fcfa"] or 0) for c in calls), 2),
    }
    return {"calls": calls, "totals": totals}
