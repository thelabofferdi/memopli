"""OCR local : images (photo d'une pièce) et PDF scannés, sans sortie réseau.

Le binaire `tesseract` est utilisé directement ; `pdftoppm` (poppler) rend les
pages d'un PDF scanné. Aucun octet du document ne quitte la machine : l'OCR
local est la seule voie compatible avec « les pièces ne partent jamais au modèle ».
"""
from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from pathlib import Path

from .config import settings

# Un LD_LIBRARY_PATH hérité de l'IDE casse les binaires système (libstdc++ trop ancien).
CLEAN_ENV = {k: v for k, v in os.environ.items() if k not in ("LD_LIBRARY_PATH", "LD_PRELOAD")}
TIMEOUT = 120


def available() -> dict:
    return {
        "tesseract": bool(shutil.which("tesseract")),
        "pdftoppm": bool(shutil.which("pdftoppm")),
        "langues": languages(),
    }


def languages() -> list[str]:
    if not shutil.which("tesseract"):
        return []
    try:
        out = subprocess.run(["tesseract", "--list-langs"], capture_output=True, text=True,
                             timeout=30, env=CLEAN_ENV)
    except (OSError, subprocess.SubprocessError):
        return []
    lignes = [l.strip() for l in out.stdout.splitlines()[1:] if l.strip()]
    return lignes


def _langue() -> tuple[str, str, bool]:
    """(langue utilisée, langue demandée, exacte) : on dit toujours laquelle a servi."""
    dispo = languages()
    voulue = settings.ocr_langs
    demandees = [l.strip() for l in voulue.split("+") if l.strip()]
    if demandees and all(l in dispo for l in demandees):
        return "+".join(demandees), voulue, True
    return ("eng" if "eng" in dispo else ""), voulue, False


def _etiquette(langue: str, voulue: str, exacte: bool) -> str:
    return langue if exacte else f"{langue} (modèle {voulue} absent)"


def image_text(path: str | Path) -> tuple[str, str]:
    """Texte d'une image. Retourne (texte, langue_utilisée ou '')."""
    if not shutil.which("tesseract"):
        return "", ""
    langue, voulue, exacte = _langue()
    if not langue:
        return "", ""
    with tempfile.TemporaryDirectory() as tmp:
        sortie = Path(tmp) / "sortie"
        cmd = ["tesseract", str(path), str(sortie), "-l", langue, "--psm", "3"]
        try:
            subprocess.run(cmd, capture_output=True, text=True, timeout=TIMEOUT, env=CLEAN_ENV)
        except (OSError, subprocess.SubprocessError):
            return "", ""
        fichier = Path(str(sortie) + ".txt")
        if not fichier.exists():
            return "", ""
        texte = fichier.read_text(encoding="utf-8", errors="replace").strip()
    return texte, _etiquette(langue, voulue, exacte)


def pdf_scanned_text(path: str | Path, max_pages: int | None = None) -> tuple[str, str]:
    """Texte d'un PDF scanné, page par page, avec repères `--- PAGE n ---`."""
    if not (shutil.which("pdftoppm") and shutil.which("tesseract")):
        return "", ""
    limite = max_pages or settings.ocr_max_pages
    langue, voulue, exacte = _langue()
    if not langue:
        return "", ""
    morceaux: list[str] = []
    with tempfile.TemporaryDirectory() as tmp:
        prefixe = str(Path(tmp) / "page")
        try:
            subprocess.run(
                ["pdftoppm", "-r", "200", "-png", "-f", "1", "-l", str(limite), str(path), prefixe],
                capture_output=True, text=True, timeout=TIMEOUT, env=CLEAN_ENV,
            )
        except (OSError, subprocess.SubprocessError):
            return "", ""
        for i, image in enumerate(sorted(Path(tmp).glob("page*.png")), start=1):
            texte, _ = image_text(image)
            if texte:
                morceaux.append(f"\n--- PAGE {i} ---\n{texte}")
    return "".join(morceaux), _etiquette(langue, voulue, exacte)
