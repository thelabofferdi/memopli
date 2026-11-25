"""Dépôt de fichiers : lecture en flux plafonnée et contrôle du type réel.

Le nom est choisi par le serveur (`{prefix}.{ext}`), jamais par le client. Le
contenu est vérifié par ses premiers octets, pas par son extension. Les photos
sont acceptées : une attestation photographiée doit pouvoir entrer dans le
coffre, et c'est l'OCR local qui lira son contenu.
"""
from __future__ import annotations

from pathlib import Path

from fastapi import UploadFile

from .config import settings
from .db import UPLOAD_DIR
from .errors import abort

CHUNK = 64 * 1024

# type réel -> (mime, extension)
TYPES = {
    b"%PDF-": ("application/pdf", ".pdf"),
    b"\xff\xd8\xff": ("image/jpeg", ".jpg"),
    b"\x89PNG\r\n\x1a\n": ("image/png", ".png"),
}
PDF_ONLY = ("application/pdf",)
DOCUMENTS = ("application/pdf", "image/jpeg", "image/png")


def _detecte(entete: bytes) -> tuple[str, str] | None:
    for magie, (mime, ext) in TYPES.items():
        if entete.startswith(magie):
            return mime, ext
    return None


async def save_document(file: UploadFile, prefix: str,
                         allowed: tuple[str, ...] = DOCUMENTS) -> tuple[Path, int, str, str]:
    """Enregistre le fichier et retourne (chemin, octets, mime, extension)."""
    nom = (file.filename or "").lower()
    if not nom.endswith((".pdf", ".jpg", ".jpeg", ".png")):
        abort("format_non_supporte", "seuls le PDF, le JPEG et le PNG sont acceptés", 415)
    limite = settings.max_upload_mb * 1024 * 1024
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    # premier passage : on lit juste de quoi identifier le type réel
    entete = b""
    total = 0
    morceaux: list[bytes] = []
    while len(entete) < 8:
        morceau = await file.read(CHUNK)
        if not morceau:
            break
        morceaux.append(morceau)
        entete += morceau
        total += len(morceau)
        if total > limite:
            abort("fichier_trop_lourd", f"fichier trop lourd (max {settings.max_upload_mb} Mo)", 413)
    if total == 0:
        abort("fichier_vide", "le fichier est vide", 400)

    detecte = _detecte(entete[:16])
    if detecte is None:
        abort("format_non_supporte", "ce fichier n'est ni un PDF, ni une image JPEG ou PNG", 415)
    mime, ext = detecte
    if mime not in allowed:
        attendu = "le PDF" if allowed == PDF_ONLY else "le PDF, le JPEG ou le PNG"
        abort("format_non_supporte", f"seul {attendu} est accepté ici", 415)

    path = UPLOAD_DIR / f"{prefix}{ext}"
    try:
        with path.open("wb") as sortie:
            for morceau in morceaux:
                sortie.write(morceau)
            while True:
                morceau = await file.read(CHUNK)
                if not morceau:
                    break
                total += len(morceau)
                if total > limite:
                    abort("fichier_trop_lourd",
                          f"fichier trop lourd (max {settings.max_upload_mb} Mo)", 413)
                sortie.write(morceau)
    except BaseException:
        path.unlink(missing_ok=True)
        raise
    return path, total, mime, ext


async def save_pdf(file: UploadFile, prefix: str) -> tuple[Path, int]:
    """Compatibilité : dépôt strictement PDF (DAO)."""
    path, taille, _mime, _ext = await save_document(file, prefix, PDF_ONLY)
    return path, taille


def remove(path_value: str | None) -> None:
    """Supprime un fichier déposé, uniquement s'il est dans le répertoire d'uploads."""
    if not path_value:
        return
    path = Path(path_value)
    try:
        path.resolve().relative_to(UPLOAD_DIR.resolve())
    except (ValueError, OSError):
        return
    Path(path).unlink(missing_ok=True)
