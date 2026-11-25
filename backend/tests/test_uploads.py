"""Uploads : type réel vérifié, taille plafonnée, fichier effacé avec la pièce."""
from __future__ import annotations

from pathlib import Path

from app.config import settings
from tests.conftest import db_rows

PDF = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n"


def _piece(client, org, *, nom="cnss.pdf", contenu=PDF, kind="cnss", expires="2027-01-01", label="Attestation CNSS"):
    return client.post(
        "/api/pieces",
        data={"org_id": org, "kind": kind, "label": label, "expires_on": expires},
        files={"file": (nom, contenu, "application/pdf")},
    )


def test_pdf_accepte_et_stocke(client, org):
    res = _piece(client, org)
    assert res.status_code == 200, res.text
    stored = db_rows("SELECT file_path FROM pieces WHERE id=?", (res.json()["id"],))[0]
    assert Path(stored["file_path"]).read_bytes().startswith(b"%PDF-")
    assert Path(stored["file_path"]).name.endswith(".pdf")


def test_faux_pdf_refuse_par_les_octets(client, org):
    res = _piece(client, org, contenu=b"<html>ceci n'est pas un pdf</html>")
    assert res.status_code == 415
    assert res.json()["error"]["code"] == "format_non_supporte"
    assert db_rows("SELECT id FROM pieces WHERE org_id=?", (org,)) == []


def test_extension_non_pdf_refusee(client, org):
    res = _piece(client, org, nom="piece.docx")
    assert res.status_code == 415


def test_fichier_vide_refuse(client, org):
    res = _piece(client, org, contenu=b"")
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "fichier_vide"


def test_fichier_trop_lourd_refuse(client, org):
    ancien = settings.max_upload_mb
    settings.max_upload_mb = 1
    try:
        res = _piece(client, org, contenu=b"%PDF-" + b"0" * (1024 * 1024 + 10))
    finally:
        settings.max_upload_mb = ancien
    assert res.status_code == 413
    assert res.json()["error"]["code"] == "fichier_trop_lourd"


def test_corps_de_requete_plafonne_avant_lecture(client, org):
    ancien = settings.max_upload_mb
    settings.max_upload_mb = 1
    try:
        res = _piece(client, org, contenu=b"%PDF-" + b"0" * (3 * 1024 * 1024))
    finally:
        settings.max_upload_mb = ancien
    assert res.status_code == 413


def test_suppression_efface_le_fichier(client, org):
    res = _piece(client, org)
    piece_id = res.json()["id"]
    chemin = Path(db_rows("SELECT file_path FROM pieces WHERE id=?", (piece_id,))[0]["file_path"])
    assert chemin.exists()
    assert client.delete(f"/api/pieces/{piece_id}").status_code == 200
    assert not chemin.exists()
    assert client.delete(f"/api/pieces/{piece_id}").status_code == 404


def test_piece_inconnue_404(client):
    assert client.delete("/api/pieces/pc_inexistant").status_code == 404
