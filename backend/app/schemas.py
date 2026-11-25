"""Schémas Pydantic : entrées d'API et sorties IA validées."""
from __future__ import annotations

import re
import unicodedata
from datetime import date
from typing import Literal

from pydantic import BaseModel, Field

# types de pièces admis (cf. docs/03-data-model.md et frontend/src/lib/format.js)
PIECE_KINDS = {"attestation_fiscale", "cnss", "rccm", "reference", "bilan", "autre"}

PIECE_KIND_LIST = Literal["attestation_fiscale", "cnss", "rccm", "reference", "bilan", "autre"]


class OrgIn(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    ifu: str | None = Field(default=None, max_length=40)
    rccm: str | None = Field(default=None, max_length=60)
    sector: str | None = Field(default=None, max_length=120)
    headcount: int | None = Field(default=None, ge=0, le=1_000_000)


class OrgPatch(BaseModel):
    """Mise à jour du profil : seuls les champs envoyés changent ; null efface un champ facultatif."""

    name: str | None = Field(default=None, min_length=2, max_length=200)
    ifu: str | None = Field(default=None, max_length=40)
    rccm: str | None = Field(default=None, max_length=60)
    sector: str | None = Field(default=None, max_length=120)
    headcount: int | None = Field(default=None, ge=0, le=1_000_000)


class SignupIn(BaseModel):
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=8, max_length=128)
    org_name: str | None = Field(default=None, min_length=2, max_length=200)


class LoginIn(BaseModel):
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=1, max_length=128)


class RequirementIn(BaseModel):
    label: str = Field(min_length=2, max_length=500)
    kind: Literal["piece", "critere"] = "piece"
    mandatory: bool = True
    weight: float | None = Field(default=None, ge=0, le=100)
    page: int | None = Field(default=None, ge=1, le=5000)
    excerpt: str | None = Field(default=None, max_length=2000)
    confidence: float | None = Field(default=None, ge=0, le=1)
    to_check: bool = False  # décidé par le code : page absente ou extrait introuvable


class RequirementPatch(BaseModel):
    """Correction manuelle : tous les champs sont facultatifs, types vérifiés."""

    label: str | None = Field(default=None, min_length=1, max_length=500)
    kind: Literal["piece", "critere"] | None = None
    mandatory: bool | None = None
    weight: float | None = Field(default=None, ge=0, le=100)
    page: int | None = Field(default=None, ge=1, le=5000)
    excerpt: str | None = Field(default=None, max_length=2000)


class ExtractOut(BaseModel):
    title: str | None = None
    buyer: str | None = None
    deadline: str | None = None
    requirements: list[RequirementIn] = []
    grid: list[RequirementIn] = []


class ChatIn(BaseModel):
    """Une question à l'agent, dans le périmètre d'une entreprise et d'un dossier."""

    org_id: str = Field(min_length=3, max_length=64)
    tender_id: str | None = Field(default=None, max_length=64)
    message: str = Field(min_length=1, max_length=2000)


class SearchIn(BaseModel):
    org_id: str = Field(min_length=3, max_length=64)
    tender_id: str | None = Field(default=None, max_length=64)
    query: str = Field(min_length=2, max_length=300)
    k: int = Field(default=6, ge=1, le=20)


class DraftIn(BaseModel):
    section: str = Field(default="methodologie", min_length=1, max_length=60)


# ------------------------------------------------- lecture de la sortie du modèle

_MOIS = {
    "janvier": 1, "fevrier": 2, "février": 2, "mars": 3, "avril": 4, "mai": 5, "juin": 6,
    "juillet": 7, "aout": 8, "août": 8, "septembre": 9, "octobre": 10, "novembre": 11,
    "decembre": 12, "décembre": 12,
}

_MOIS_MOTIF = "|".join(sorted(_MOIS, key=len, reverse=True))


def iso_date(value: object) -> str | None:
    """Une date lisible devient AAAA-MM-JJ ; illisible reste None : on n'invente pas.

    Le modèle écrit « 18 décembre 2026 » aussi souvent que « 2026-12-18 ». Les statuts de
    ``state.py`` comparent des chaînes ISO : sans cette conversion, une échéance en
    français passerait pour dépassée ou pour absente.
    """
    if not isinstance(value, str):
        return None
    s = value.strip().lower()
    if not s:
        return None
    motif = None
    m = re.search(r"(\d{4})-(\d{1,2})-(\d{1,2})", s)
    if m:
        motif = (int(m.group(1)), int(m.group(2)), int(m.group(3)))
    else:
        m = re.search(r"(\d{1,2})\s*[/.]\s*(\d{1,2})\s*[/.]\s*(\d{4})", s)
        if m:
            motif = (int(m.group(3)), int(m.group(2)), int(m.group(1)))
        else:
            m = re.search(rf"(\d{{1,2}})\s*(?:er)?\s+({_MOIS_MOTIF})\s+(\d{{4}})", s)
            if m:
                motif = (int(m.group(3)), _MOIS[m.group(2)], int(m.group(1)))
    if not motif:
        return None
    try:
        return date(*motif).isoformat()
    except ValueError:  # 31 février : le document est faux, on ne corriGe pas
        return None


_LABEL = ("label", "name", "intitule", "intitulé", "libelle", "libellé", "exigence",
          "requirement", "description", "title", "titre")
_KIND = ("kind", "type", "categorie", "catégorie", "nature")
_MANDATORY = ("mandatory", "obligatoire", "required", "requis")
_WEIGHT = ("weight", "ponderation", "pondération", "points", "poids", "note")
_PAGE = ("page", "page_number", "page_num", "numero_page", "numéro_page", "pages")
_EXCERPT = ("excerpt", "extrait", "citation", "quote", "verbatim")
_CONFIDENCE = ("confidence", "confiance", "certitude")
_TITLE = ("title", "titre", "objet", "intitule", "intitulé")
_BUYER = ("buyer", "acheteur", "maitre_ouvrage", "maître_ouvrage", "pouvoir_adjudicateur",
          "commanditaire")
_DEADLINE = ("deadline", "date_limite", "date_limite_depot", "date_limite_de_depot",
             "echeance", "échéance")


def _pick(obj: dict, names: tuple[str, ...]) -> object:
    for n in names:
        if n in obj and obj[n] not in (None, ""):
            return obj[n]
    return None


def _text(value: object, limit: int | None = None) -> str | None:
    if value is None or isinstance(value, (int, float)):
        value = None if value is None else str(value)
    if not isinstance(value, str):
        return None
    value = " ".join(value.split()).strip()
    if not value:
        return None
    return value[:limit] if limit else value


def _bool(value: object) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() not in {"non", "false", "0", "facultatif", "no"}
    return bool(value) if value is not None else True


def _float(value: object) -> float | None:
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        m = re.search(r"\d+(?:[.,]\d+)?", value)
        if m:
            return float(m.group(0).replace(",", "."))
    return None


def _int(value: object) -> int | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)
    if isinstance(value, str):
        m = re.search(r"\d+", value)
        if m:
            return int(m.group(0))
    return None


def _kind(value: object) -> str:
    s = (_text(value) or "").lower()
    if any(k in s for k in ("critere", "critère", "notation", "grille", "evaluation", "évaluation")):
        return "critere"
    if any(k in s for k in ("piece", "pièce", "administratif", "document", "papier")):
        return "piece"
    return "piece"


CONFIANCE_A_VERIFIER = 0.3  # plafond appliqué quand le code n'a pas pu confirmer la source


def _squash(texte: str) -> str:
    """Forme comparable : ligatures dépliées, sans accent ni casse ni ponctuation."""
    texte = texte.lower().replace("œ", "oe").replace("æ", "ae")  # sans décomposition Unicode
    texte = unicodedata.normalize("NFKD", texte)
    texte = "".join(c for c in texte if unicodedata.category(c) != "Mn")
    return " ".join(re.sub(r"[^a-z0-9]+", " ", texte).split())


def excerpt_in_page(excerpt: str, page_text: str) -> bool:
    """L'extrait cité figure-t-il dans la page ? Les « … » du modèle séparent des fragments."""
    page = _squash(page_text)
    fragments = [f for f in (_squash(morceau) for morceau in re.split(r"\.{3}|…", excerpt)) if f]
    if not fragments:
        return False
    longs = [f for f in fragments if len(f) >= 8]
    if longs:
        return all(f in page for f in longs)
    # extrait court (« IFU », « RCCM ») : comparaison directe, mais sur des mots entiers
    entoure = f" {page} "
    return all(f" {f} " in entoure for f in fragments)


def _requirement(raw: object, page_count: int | None, stat: dict,
                 pages: dict[int, str] | None = None) -> RequirementIn | None:
    if isinstance(raw, str):  # le modèle rend parfois une simple liste de phrases
        raw = {"label": raw}
    if not isinstance(raw, dict):
        stat["ignorees"] += 1
        return None
    label = _text(_pick(raw, _LABEL), 500)
    if not label:
        stat["ignorees"] += 1
        return None
    page = _int(_pick(raw, _PAGE))
    if page is not None and (page < 1 or (page_count and page > page_count)):
        # page hors du document : on la perd plutôt que d'afficher une fausse référence
        stat["pages_hors_document"] += 1
        page = None
    excerpt = _text(_pick(raw, _EXCERPT), 2000)
    confidence = _float(_pick(raw, _CONFIDENCE))
    to_check = False
    if page is None:
        stat["sans_page"] += 1
        to_check = True
    elif pages is not None:
        # le code relit la page citée : un extrait absent de cette page n'est pas une source
        if not excerpt:
            stat["sans_extrait"] += 1
            to_check = True
        elif not excerpt_in_page(excerpt, pages.get(page, "")):
            stat["extraits_introuvables"] += 1
            to_check = True
    if to_check:
        confidence = min(confidence, CONFIANCE_A_VERIFIER) if confidence is not None else CONFIANCE_A_VERIFIER
        stat["a_verifier"] += 1
    return RequirementIn(
        label=label,
        kind=_kind(_pick(raw, _KIND)),
        mandatory=_bool(_pick(raw, _MANDATORY)),
        weight=_float(_pick(raw, _WEIGHT)),
        page=page,
        excerpt=excerpt,
        confidence=confidence,
        to_check=to_check,
    )


def normalize_extract(obj: object, page_count: int | None = None,
                      pages: dict[int, str] | None = None) -> tuple[ExtractOut, dict]:
    """Traduit la sortie réelle du modèle vers le schéma, et dit ce qu'elle a coûté.

    Les modèles renomment volontiers les clés (``name`` pour ``label``, ``pondération``
    pour ``weight``) ou écrivent une date en français. On accepte ces variantes, on
    convertit les dates en ISO et on écarte ce qui est inutilisable — sans jamais
    fabriquer une valeur absente du document. Quand `pages` (texte par page) est fourni, le
    code vérifie que l'extrait cité figure dans la page citée ; sinon l'exigence est marquée
    `to_check`.
    """
    if not isinstance(obj, dict):
        raise ValueError("la réponse du modèle n'est pas un objet JSON")
    stat = {"ignorees": 0, "sans_page": 0, "pages_hors_document": 0, "sans_extrait": 0,
            "extraits_introuvables": 0, "a_verifier": 0}
    requirements = [
        r for r in (_requirement(x, page_count, stat, pages)
                    for x in (obj.get("requirements") or [])) if r
    ]
    grid = [
        r for r in (_requirement({**_kind_as_critere(x), "kind": "critere"}, page_count, stat, pages)
                    for x in (obj.get("grid") or [])) if r
    ]
    parsed = ExtractOut(
        title=_text(_pick(obj, _TITLE), 300),
        buyer=_text(_pick(obj, _BUYER), 300),
        deadline=iso_date(_pick(obj, _DEADLINE)),
        requirements=requirements,
        grid=grid,
    )
    if not parsed.requirements and not parsed.grid:
        raise ValueError("aucune exigence exploitable dans la réponse du modèle")
    return parsed, stat


def _kind_as_critere(raw: object) -> dict:
    """La grille est un critère par construction, même si le modèle l'a mal étiquetée."""
    return raw if isinstance(raw, dict) else {"label": raw}


def dedupe(items: list[RequirementIn]) -> tuple[list[RequirementIn], int]:
    """Le modèle écrit parfois la même grille dans ``requirements`` et dans ``grid``.

    Deux exigences ne sont confondues que si le libellé, le type et la page coïncident :
    le code tranche, l'interface ne montre jamais la même ligne deux fois.
    """
    vus: set[tuple[str, str, int | None]] = set()
    uniques: list[RequirementIn] = []
    for r in items:
        cle = (re.sub(r"\W+", "", r.label.lower()), r.kind, r.page)
        if cle in vus:
            continue
        vus.add(cle)
        uniques.append(r)
    return uniques, len(items) - len(uniques)
