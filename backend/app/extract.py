"""Extraction du texte d'un PDF, avec repli OCR si le PDF est un scan.

Le nombre de pages est lu avant d'extraire la moindre page : un PDF de 50 000
pages ne doit pas coûter dix secondes de CPU pour finir en 413.
"""
from __future__ import annotations

import re

MIN_CHARS = 500  # en dessous, le PDF n'a pas de texte exploitable : on tente l'OCR


class PdfTooLong(Exception):
    """Le document dépasse le plafond de pages accepté."""

    def __init__(self, pages: int, max_pages: int):
        super().__init__(f"{pages} pages (max {max_pages})")
        self.pages = pages
        self.max_pages = max_pages


def pdf_text(path: str, max_pages: int | None = None, max_chars: int | None = None) -> tuple[str, int]:
    """Retourne (texte avec repères de page, nombre de pages)."""
    from pypdf import PdfReader

    reader = PdfReader(path)
    total = len(reader.pages)
    if max_pages is not None and total > max_pages:
        raise PdfTooLong(total, max_pages)
    chunks: list[str] = []
    written = 0
    for i, page in enumerate(reader.pages, start=1):
        try:
            text = page.extract_text() or ""
        except Exception:
            text = ""
        morceau = f"\n--- PAGE {i} ---\n{text.strip()}"
        chunks.append(morceau)
        written += len(morceau)
        if max_chars is not None and written >= max_chars:
            break
    return "".join(chunks), total


def ocr_text(path: str, max_pages: int | None = None) -> str:
    """Repli OCR local (poppler + tesseract) ; vide si les binaires ou la langue manquent."""
    from . import ocr

    texte, _langue = ocr.pdf_scanned_text(path, max_pages)
    return texte


def extract(path: str, max_pages: int | None = None, max_chars: int | None = None) -> tuple[str, int, bool]:
    """Retourne (texte, pages, ocr_utilise)."""
    text, pages = pdf_text(path, max_pages=max_pages, max_chars=max_chars)
    if len(re.sub(r"--- PAGE \d+ ---", "", text).strip()) >= MIN_CHARS:
        return text, pages, False
    fallback = ocr_text(path)
    lu = lambda t: len(re.sub(r"--- PAGE \d+ ---", "", t).strip())  # noqa: E731
    if lu(fallback) > lu(text):
        return fallback, pages, True
    return text, pages, False


def pages_of(text: str) -> dict[int, str]:
    """Découpe le texte par page : {num_page: contenu}."""
    out, current, buf = {}, 0, []
    for line in text.splitlines():
        m = re.match(r"--- PAGE (\d+) ---", line.strip())
        if m:
            if current:
                out[current] = "\n".join(buf).strip()
            current, buf = int(m.group(1)), []
        else:
            buf.append(line)
    if current:
        out[current] = "\n".join(buf).strip()
    return out
