"""Ingestion documentaire : un fichier déposé devient des morceaux citables.

Chaque morceau garde sa page et son document d'origine : c'est la condition pour
que l'agent puisse toujours répondre « page 12 de tel document » au lieu d'une
phrase vague. Un nouveau dépôt pour la même source remplace l'ancien.
"""
from __future__ import annotations

from .config import settings
from .db import connect, rows
from .extract import pages_of
from .ids import nid, stamp


def chunk_pages(text: str, size: int | None = None) -> list[dict]:
    """Découpe page par page : jamais un morceau à cheval sur deux pages."""
    taille = size or settings.rag_chunk_chars
    pages = pages_of(text)
    if not pages:
        pages = {1: text}
    morceaux: list[dict] = []
    for page, contenu in sorted(pages.items()):
        tampon = ""
        for ligne in contenu.splitlines():
            ligne = ligne.strip()
            if not ligne:
                continue
            if len(ligne) > taille:
                if tampon:
                    morceaux.append({"page": page, "text": tampon})
                    tampon = ""
                while len(ligne) > taille:
                    morceaux.append({"page": page, "text": ligne[:taille]})
                    ligne = ligne[taille:]
                tampon = ligne
                continue
            if not tampon:
                tampon = ligne
            elif len(tampon) + len(ligne) + 1 <= taille:
                tampon = f"{tampon}\n{ligne}"
            else:
                morceaux.append({"page": page, "text": tampon})
                tampon = ligne
        if tampon:
            morceaux.append({"page": page, "text": tampon})
    return morceaux


def register(*, org_id: str, kind: str, filename: str | None, mime: str | None,
             size_bytes: int | None, pages: int | None, text: str,
             tender_id: str | None = None, piece_id: str | None = None,
             text_path: str | None = None, ocr_lang: str | None = None) -> dict:
    """Enregistre le document et ses morceaux ; retourne de quoi l'afficher."""
    morceaux = chunk_pages(text) if text and text.strip() else []
    statut = "ingere" if morceaux else "texte_absent"
    with connect() as conn:
        anciens = rows(conn.execute(
            "SELECT id FROM documents WHERE org_id=? AND COALESCE(tender_id,'')=?"
            " AND COALESCE(piece_id,'')=?",
            (org_id, tender_id or "", piece_id or ""),
        ))
        for ancien in anciens:
            conn.execute("DELETE FROM chunks WHERE document_id=?", (ancien["id"],))
            conn.execute("DELETE FROM documents WHERE id=?", (ancien["id"],))
        did = nid("doc")
        conn.execute(
            "INSERT INTO documents(id,org_id,tender_id,piece_id,kind,filename,mime,bytes,pages,chars,"
            "status,text_path,ocr_lang,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (did, org_id, tender_id, piece_id, kind, filename, mime, size_bytes, pages,
             len(text or ""), statut, text_path, ocr_lang, stamp()),
        )
        for i, m in enumerate(morceaux):
            conn.execute(
                "INSERT INTO chunks(id,document_id,page,ordre,text,created_at) VALUES (?,?,?,?,?,?)",
                (nid("ch"), did, m["page"], i, m["text"], stamp()),
            )
    return {"id": did, "chunks": len(morceaux), "status": statut, "pages": pages,
            "chars": len(text or ""), "ocr_lang": ocr_lang}


def list_documents(org_id: str, tender_id: str | None = None) -> list[dict]:
    with connect() as conn:
        if tender_id:
            lignes = rows(conn.execute(
                "SELECT d.id, d.kind, d.filename, d.mime, d.pages, d.chars, d.status, d.ocr_lang,"
                " d.created_at, d.tender_id, d.piece_id,"
                " (SELECT COUNT(*) FROM chunks c WHERE c.document_id=d.id) AS chunks"
                " FROM documents d WHERE d.org_id=? AND (d.tender_id=? OR d.piece_id IS NOT NULL)"
                " ORDER BY d.created_at DESC", (org_id, tender_id)))
        else:
            lignes = rows(conn.execute(
                "SELECT d.id, d.kind, d.filename, d.mime, d.pages, d.chars, d.status, d.ocr_lang,"
                " d.created_at, d.tender_id, d.piece_id,"
                " (SELECT COUNT(*) FROM chunks c WHERE c.document_id=d.id) AS chunks"
                " FROM documents d WHERE d.org_id=? ORDER BY d.created_at DESC", (org_id,)))
    return lignes


def forget(*, tender_id: str | None = None, piece_id: str | None = None) -> None:
    """Supprime l'index d'une source effacée : pas de morceau orphelin."""
    if not tender_id and not piece_id:
        return
    colonne, valeur = ("tender_id", tender_id) if tender_id else ("piece_id", piece_id)
    with connect() as conn:
        ids = rows(conn.execute(f"SELECT id FROM documents WHERE {colonne}=?", (valeur,)))
        for ligne in ids:
            conn.execute("DELETE FROM chunks WHERE document_id=?", (ligne["id"],))
            conn.execute("DELETE FROM documents WHERE id=?", (ligne["id"],))
