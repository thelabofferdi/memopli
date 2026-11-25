"""MemoPli — API du MVP.

Parcours : créer une entreprise -> déposer des pièces -> déposer un DAO ->
extraire les exigences -> rapprocher -> état de préparation -> générer une section.

Garde-fous : contrat d'erreur unique (`errors.py`), authentification facultative
puis obligatoire selon `AUTH_REQUIRED` (`auth.py`), uploads vérifiés (`uploads.py`),
en-têtes et journal d'accès (`middleware.py`), débits plafonnés (`ratelimit.py`).
"""
from __future__ import annotations

import json
import logging
from contextlib import asynccontextmanager
from datetime import date
from pathlib import Path

from fastapi import Depends, FastAPI, File, Form, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.concurrency import run_in_threadpool

from . import agent, ai, audit, auth, errors, extract, ingest, ocr, rag, ratelimit, state, uploads
from .config import check, describe, enforce, settings
from .db import UPLOAD_DIR, connect, init_db, rows
from .errors import abort
from .ids import epoch, nid, today
from .middleware import BodyLimit, HttpGuard, setup_logging
from .schemas import (ChatIn, DraftIn, LoginIn, OrgIn, OrgPatch, PIECE_KINDS,
                      RequirementPatch, SearchIn, SignupIn, dedupe, normalize_extract)
from .uploads import save_document, save_pdf

log = logging.getLogger("memopli")

AI_DOWN = "l'IA n'a pas répondu ; réessayez dans un instant"


def _purge_expired() -> None:
    """Une session expirée n'a plus à occuper la base."""
    with connect() as conn:
        conn.execute("DELETE FROM sessions WHERE expires_at < ?", (epoch(),))


@asynccontextmanager
async def lifespan(_app: FastAPI):
    setup_logging()
    enforce()
    init_db()
    _purge_expired()
    log.info(json.dumps({"demarrage": "memopli", **describe()}, ensure_ascii=False))
    for warning in check():
        log.warning(json.dumps({"avertissement": warning}, ensure_ascii=False))
    yield


app = FastAPI(
    title="MemoPli",
    version="0.2.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.docs_enabled else None,
    redoc_url=None,
    openapi_url="/openapi.json" if settings.docs_enabled else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["content-type", "authorization", "x-request-id"],
    expose_headers=["x-request-id"],
    max_age=600,
)
app.add_middleware(BodyLimit)  # compte les octets, y compris en chunked
app.add_middleware(HttpGuard)  # ajouté en dernier : enveloppe tout le reste
errors.install(app)


# ------------------------------------------------------------------ utilitaires


def _require_org(org_id: str) -> None:
    with connect() as conn:
        if not rows(conn.execute("SELECT 1 FROM organizations WHERE id=?", (org_id,))):
            abort("organisation_inconnue", "organisation inconnue", 404)


def _require_tender(tender_id: str) -> dict:
    with connect() as conn:
        found = rows(conn.execute("SELECT * FROM tenders WHERE id=?", (tender_id,)))
    if not found:
        abort("introuvable", "DAO inconnu", 404)
    return found[0]


def _ai_failure(exc: Exception, task: str, tender_id: str | None = None,
                request_id: str | None = None) -> None:
    """Le détail du fournisseur reste dans le journal : le client reçoit un message court."""
    log.warning(json.dumps({"appel_ia": task, "echec": str(exc)[:500]}, ensure_ascii=False))
    audit.log_ai_call({}, task=task, tender_id=tender_id, request_id=request_id, ok=False)
    abort("ia_indisponible", AI_DOWN, 502)


# ---------------------------------------------------------------------- santé


@app.get("/health")
def health():
    return {
        "ok": True,
        "service": "memopli",
        "version": app.version,
        "ai_key": bool(settings.ai_key),
        "auth_required": settings.auth_required,
        "modeles": ai.describe()["modeles"],
        "ocr": ocr.available(),
        "rag": "bm25",
    }


# -------------------------------------------------------------------- comptes


@app.post("/api/auth/signup")
def signup(payload: SignupIn, _: None = Depends(ratelimit.auth_guard())):
    return auth.create_account(payload.email, payload.password, payload.org_name)


@app.post("/api/auth/login")
def login(payload: LoginIn, _: None = Depends(ratelimit.auth_guard())):
    return auth.authenticate(payload.email, payload.password)


@app.post("/api/auth/logout")
def logout(request: Request, user: dict = Depends(auth.required_user)):
    token = auth.bearer(request)
    if token:
        auth.revoke_session(token)
    return {"ok": True, "user_id": user["id"]}


@app.get("/api/auth/me")
def me(user: dict = Depends(auth.required_user)):
    return {"user": user, "orgs": auth.orgs_of(user["id"])}


# ---------------------------------------------------------------- entreprises


@app.post("/api/orgs")
def create_org(payload: OrgIn, user: dict | None = Depends(auth.optional_user)):
    oid = nid("org")
    with connect() as conn:
        conn.execute(
            "INSERT INTO organizations(id,user_id,name,ifu,rccm,sector,headcount,created_at)"
            " VALUES (?,?,?,?,?,?,?,?)",
            (oid, user["id"] if user else None, payload.name, payload.ifu, payload.rccm,
             payload.sector, payload.headcount, today()),
        )
    return {"id": oid, **payload.model_dump()}


@app.get("/api/orgs/{org_id}")
def get_org(org_id: str, user: dict | None = Depends(auth.optional_user)):
    auth.assert_access(user, org_id=org_id)
    with connect() as conn:
        found = rows(conn.execute(
            "SELECT id, name, ifu, rccm, sector, headcount, created_at FROM organizations WHERE id=?",
            (org_id,),
        ))
    if not found:
        abort("introuvable", "organisation inconnue", 404)
    return found[0]


@app.patch("/api/orgs/{org_id}")
def update_org(org_id: str, payload: OrgPatch, user: dict | None = Depends(auth.optional_user)):
    """Compléter le profil créé à l'inscription (IFU, RCCM, secteur, effectif)."""
    auth.assert_access(user, org_id=org_id)
    _require_org(org_id)
    envoyes = payload.model_dump(exclude_unset=True)
    if not envoyes:
        abort("rien_a_modifier", "aucun champ à modifier", 400)
    # espaces retirés ; chaîne vide sur un champ facultatif = champ effacé
    fields: dict = {}
    for cle, valeur in envoyes.items():
        if isinstance(valeur, str):
            valeur = valeur.strip()
            if cle != "name" and valeur == "":
                valeur = None
        fields[cle] = valeur
    if "name" in fields and (fields["name"] is None or len(fields["name"]) < 2):
        abort("requete_invalide", "le nom de l'entreprise ne peut pas être vide", 400)
    # liste blanche : les noms de colonnes viennent du schéma, jamais du client
    allowed = ("name", "ifu", "rccm", "sector", "headcount")
    cols = [k for k in allowed if k in fields]
    with connect() as conn:
        conn.execute(
            f"UPDATE organizations SET {', '.join(f'{k}=?' for k in cols)} WHERE id=?",
            (*[fields[k] for k in cols], org_id),
        )
    return get_org(org_id, user)


@app.get("/api/orgs/{org_id}/tenders")
def list_tenders(org_id: str, user: dict | None = Depends(auth.optional_user)):
    """Dossiers de l'entreprise, du plus récent au plus ancien, avec leur avancement."""
    auth.assert_access(user, org_id=org_id)
    _require_org(org_id)
    with connect() as conn:
        return rows(conn.execute(
            "SELECT t.id, t.title, t.buyer, t.deadline, t.page_count, t.created_at,"
            " (SELECT COUNT(*) FROM requirements q WHERE q.tender_id = t.id) AS requirements,"
            " (SELECT COUNT(*) FROM drafts d WHERE d.tender_id = t.id) AS drafts"
            " FROM tenders t WHERE t.org_id=? ORDER BY t.created_at DESC, t.rowid DESC",
            (org_id,),
        ))


# -------------------------------------------------------------------- pièces


@app.post("/api/pieces")
async def create_piece(
    org_id: str = Form(...),
    kind: str = Form(...),
    label: str = Form(...),
    expires_on: str | None = Form(None),
    file: UploadFile | None = File(None),
    user: dict | None = Depends(auth.optional_user),
    _: None = Depends(ratelimit.upload_guard()),
):
    auth.assert_access(user, org_id=org_id)
    _require_org(org_id)

    kind = kind.strip()
    if kind not in PIECE_KINDS:
        abort("type_inconnu", f"type de pièce inconnu : {kind}", 400)
    label = label.strip()
    if not label:
        abort("libelle_vide", "l'intitulé de la pièce est vide", 400)
    if len(label) > 200:
        abort("libelle_trop_long", "l'intitulé dépasse 200 caractères", 400)
    expires = (expires_on or "").strip() or None
    if expires:
        try:
            date.fromisoformat(expires)
        except ValueError:
            abort("date_invalide", "la date de validité doit être au format AAAA-MM-JJ", 400)

    pid = nid("pc")
    path = mime = taille = pages = ocr_lang = None
    texte = ""
    if file is not None and file.filename:
        saved, taille, mime, _ext = await save_document(file, pid)
        path = str(saved)
        # lecture locale seulement : pypdf pour un PDF, tesseract pour une photo
        try:
            if mime == "application/pdf":
                texte, pages, _ocr = await run_in_threadpool(
                    extract.extract, str(saved), settings.max_pages, settings.max_chars)
            else:
                pages = 1
                texte, ocr_lang = await run_in_threadpool(ocr.image_text, str(saved))
        except extract.PdfTooLong:
            uploads.remove(path)
            abort("document_trop_long", f"pièce de plus de {settings.max_pages} pages", 413)
        except Exception as exc:
            log.warning(json.dumps({"lecture_piece": pid, "echec": str(exc)[:200]}, ensure_ascii=False))
    with connect() as conn:
        conn.execute(
            "INSERT INTO pieces(id,org_id,kind,label,file_path,expires_on,verified,created_at)"
            " VALUES (?,?,?,?,?,?,0,?)",
            (pid, org_id, kind, label, path, expires, today()),
        )
    document = None
    if path:
        document = ingest.register(
            org_id=org_id, kind=("photo" if mime != "application/pdf" else "piece"),
            filename=file.filename, mime=mime, size_bytes=taille, pages=pages,
            text=texte, piece_id=pid, text_path=path, ocr_lang=ocr_lang)
    return {"id": pid, "kind": kind, "label": label, "expires_on": expires, "document": document}


@app.get("/api/pieces")
def list_pieces(org_id: str, user: dict | None = Depends(auth.optional_user)):
    auth.assert_access(user, org_id=org_id)
    with connect() as conn:
        return rows(conn.execute(
            "SELECT id, org_id, kind, label, expires_on, verified, created_at"
            " FROM pieces WHERE org_id=? ORDER BY created_at DESC",
            (org_id,),
        ))


@app.delete("/api/pieces/{piece_id}")
def delete_piece(piece_id: str, user: dict | None = Depends(auth.optional_user)):
    auth.assert_access(user, piece_id=piece_id)
    with connect() as conn:
        found = rows(conn.execute("SELECT file_path FROM pieces WHERE id=?", (piece_id,)))
        if not found:
            abort("introuvable", "pièce inconnue", 404)
        # une pièce retirée ne peut plus justifier une exigence : le verdict est recalculé
        conn.execute("DELETE FROM matches WHERE piece_id=?", (piece_id,))
        conn.execute("DELETE FROM pieces WHERE id=?", (piece_id,))
    uploads.remove(found[0]["file_path"])
    ingest.forget(piece_id=piece_id)
    return {"deleted": piece_id}


# ------------------------------------------------------------------------ DAO


@app.post("/api/tenders")
async def create_tender(
    org_id: str = Form(...),
    file: UploadFile = File(...),
    user: dict | None = Depends(auth.optional_user),
    _: None = Depends(ratelimit.upload_guard()),
):
    auth.assert_access(user, org_id=org_id)
    _require_org(org_id)

    tid = nid("td")
    path, _size = await save_pdf(file, tid)
    try:
        text, pages, used_ocr = await run_in_threadpool(
            extract.extract, str(path), settings.max_pages, settings.max_chars
        )
    except extract.PdfTooLong as exc:  # plafond vérifié avant d'extraire la première page
        uploads.remove(str(path))
        abort("document_trop_long", f"document de {exc.pages} pages (max {exc.max_pages})", 413)
    except Exception as exc:  # PDF illisible, chiffré, tronqué
        uploads.remove(str(path))
        log.warning(json.dumps({"lecture_pdf": tid, "echec": str(exc)[:300]}, ensure_ascii=False))
        abort("lecture_impossible", "ce PDF n'a pas pu être lu", 422)

    text = text[: settings.max_chars]
    text_path = UPLOAD_DIR / f"{tid}.txt"
    text_path.write_text(text, encoding="utf-8")
    with connect() as conn:
        conn.execute(
            "INSERT INTO tenders(id,org_id,title,buyer,deadline,file_path,text_path,page_count,created_at)"
            " VALUES (?,?,?,?,?,?,?,?,?)",
            (tid, org_id, None, None, None, str(path), str(text_path), pages, today()),
        )
    document = ingest.register(
        org_id=org_id, kind="dao", filename=file.filename, mime="application/pdf",
        size_bytes=_size, pages=pages, text=text, tender_id=tid, text_path=str(text_path))
    return {"id": tid, "page_count": pages, "chars": len(text), "ocr": used_ocr,
            "document": document}


@app.get("/api/tenders/{tender_id}")
def get_tender(tender_id: str, user: dict | None = Depends(auth.optional_user)):
    auth.assert_access(user, tender_id=tender_id)
    tender = _require_tender(tender_id)
    tender.pop("text_path", None)
    tender.pop("file_path", None)
    return tender


SYSTEM_EXTRACT = """Tu lis un dossier d'appel d'offres (DAO) et tu en extrais les exigences.
Règles strictes :
- n'invente rien : si une exigence n'est pas écrite, elle n'existe pas ;
- pour chaque exigence, donne la page et l'extrait exact du document ;
- distingue les pièces administratives (kind=piece) des critères de notation (kind=critere, avec weight si indiqué) ;
- si la grille de notation est absente, renvoie grid=[] ;
- réponds uniquement en JSON conforme au schéma demandé."""


@app.post("/api/tenders/{tender_id}/requirements")
def extract_requirements(
    tender_id: str,
    request: Request,
    user: dict | None = Depends(auth.optional_user),
    _: None = Depends(ratelimit.ai_guard()),
):
    auth.assert_access(user, tender_id=tender_id)
    tender = _require_tender(tender_id)
    text_path = tender["text_path"]
    if not text_path or not Path(text_path).is_file():
        abort("texte_insuffisant", "le texte du DAO n'est plus disponible ; redépose le document", 409)
    text = Path(text_path).read_text(encoding="utf-8")
    if len(text) < 500:
        abort("texte_insuffisant", "le PDF ne contient pas de texte exploitable (scan ?)", 400)

    user_prompt = (
        "Extrait du DAO (les pages sont balisées par '--- PAGE n ---') :\n\n"
        + text[:60000]
        + "\n\nRends un seul objet JSON, sans commentaire, exactement de cette forme :\n"
        '{"title": "objet du marché", "buyer": "acheteur", "deadline": "AAAA-MM-JJ",\n'
        ' "requirements": [{"label": "pièce exigée", "kind": "piece", "mandatory": true,\n'
        '                   "weight": null, "page": 3, "excerpt": "phrase du document"}],\n'
        ' "grid": [{"label": "critère", "kind": "critere", "mandatory": true,\n'
        '           "weight": 40, "page": 4, "excerpt": "phrase du document"}]}\n'
        "Le texte de chaque exigence va dans \"label\" (la clé \"name\" est refusée) ; "
        '"page" est un entier, celui du balisage — pas de page inventée.'
    )
    try:
        obj, meta = ai.chat_json(SYSTEM_EXTRACT, user_prompt, ai.MODEL_EXTRACT)
        parsed, lecture = normalize_extract(obj, tender["page_count"])
    except ai.AIError as exc:
        _ai_failure(exc, "extraction", tender_id, getattr(request.state, "request_id", None))
    except Exception as exc:  # schéma non conforme : le contenu du modèle reste au journal
        log.warning(json.dumps({"appel_ia": "extraction", "reponse_non_conforme": str(exc)[:500]},
                               ensure_ascii=False))
        audit.log_ai_call({}, task="extraction", tender_id=tender_id,
                          request_id=getattr(request.state, "request_id", None), ok=False)
        abort("extraction_invalide", "la réponse du modèle n'a pas pu être exploitée", 502)

    items, doublons = dedupe([r for r in parsed.requirements + parsed.grid if r.label.strip()])
    lecture["doublons"] = doublons
    created = []
    with connect() as conn:
        # relancer l'extraction remplace la grille : pas d'empilement de doublons
        conn.execute(
            "DELETE FROM matches WHERE requirement_id IN (SELECT id FROM requirements WHERE tender_id=?)",
            (tender_id,),
        )
        conn.execute("DELETE FROM requirements WHERE tender_id=?", (tender_id,))
        conn.execute(
            "UPDATE tenders SET title=?, buyer=?, deadline=? WHERE id=?",
            (parsed.title, parsed.buyer, parsed.deadline, tender_id),
        )
        for req in items:
            rid = nid("rq")
            conn.execute(
                "INSERT INTO requirements(id,tender_id,label,kind,mandatory,weight,page,excerpt,confidence,corrected,created_at)"
                " VALUES (?,?,?,?,?,?,?,?,?,0,?)",
                (rid, tender_id, req.label.strip(), req.kind, int(req.mandatory), req.weight,
                 req.page, req.excerpt, req.confidence, today()),
            )
            created.append(rid)
    audit.log_ai_call(meta, task="extraction", tender_id=tender_id,
                      request_id=getattr(request.state, "request_id", None))
    return {
        "count": len(created),
        "meta": meta,
        "title": parsed.title,
        "buyer": parsed.buyer,
        "deadline": parsed.deadline,
        "lecture": lecture,
        "replaced": True,
    }


@app.get("/api/tenders/{tender_id}/requirements")
def list_requirements(tender_id: str, user: dict | None = Depends(auth.optional_user)):
    auth.assert_access(user, tender_id=tender_id)
    with connect() as conn:
        return rows(conn.execute(
            "SELECT * FROM requirements WHERE tender_id=? ORDER BY kind, page", (tender_id,)))


@app.patch("/api/requirements/{requirement_id}")
def patch_requirement(
    requirement_id: str,
    payload: RequirementPatch,
    user: dict | None = Depends(auth.optional_user),
):
    auth.assert_access(user, requirement_id=requirement_id)
    envoyes = payload.model_dump(exclude_unset=True)
    # un null explicite n'est accepté que pour les colonnes qui l'autorisent
    nullables = {"excerpt", "weight", "page"}
    fields = {k: v for k, v in envoyes.items() if v is not None or k in nullables}
    if not fields:
        abort("rien_a_modifier", "aucun champ reconnu", 400)
    if "label" in fields and not str(fields["label"]).strip():
        abort("libelle_vide", "l'intitulé est vide", 400)
    sets = ", ".join(f"{k}=?" for k in fields)
    with connect() as conn:
        cur = conn.execute(
            f"UPDATE requirements SET {sets}, corrected=1 WHERE id=?",
            (*fields.values(), requirement_id),
        )
        if cur.rowcount == 0:
            abort("introuvable", "exigence inconnue", 404)
    return {"updated": requirement_id, "fields": sorted(fields)}


# -------------------------------------------------------------- rapprochement

SYSTEM_MATCH = """Tu rapproches des exigences de dossier avec les pièces disponibles d'une entreprise.
Pour chaque exigence, indique l'identifiant de la pièce qui y répond, ou null.
Tu ne décides jamais du statut (valide/perimé) : le logiciel s'en charge.
Réponds en JSON : {"matches":[{"requirement_id":"...","piece_id":"...|null","reason":"..."}]}"""


def compute_status(piece: dict | None) -> tuple[str, str]:
    if piece is None:
        return "manquant", "aucune pièce correspondante"
    exp = piece.get("expires_on")
    if not exp:
        return "a_verifier", "date de validité non déclarée"
    if exp < date.today().isoformat():
        return "perime", f"expirée le {exp}"
    return "valide", f"valable jusqu'au {exp}"


@app.post("/api/tenders/{tender_id}/match")
def match_requirements(
    tender_id: str,
    request: Request,
    user: dict | None = Depends(auth.optional_user),
    _: None = Depends(ratelimit.ai_guard()),
):
    auth.assert_access(user, tender_id=tender_id)
    tender = _require_tender(tender_id)
    with connect() as conn:
        reqs = rows(conn.execute(
            "SELECT id,label,kind FROM requirements WHERE tender_id=?", (tender_id,)))
        pieces = rows(conn.execute(
            "SELECT id,label,kind,expires_on FROM pieces WHERE org_id=?", (tender["org_id"],)))
    if not reqs:
        abort("aucune_exigence", "lance d'abord l'extraction", 409)

    prompt = json.dumps({"requirements": reqs, "pieces": pieces}, ensure_ascii=False)
    try:
        obj, meta = ai.chat_json(SYSTEM_MATCH, prompt, ai.MODEL_MATCH)
    except ai.AIError as exc:
        _ai_failure(exc, "rapprochement", tender_id, getattr(request.state, "request_id", None))

    # le modèle ne peut viser qu'une exigence de ce dossier et une pièce de cette entreprise
    valid_rids = {r["id"] for r in reqs}
    by_id = {p["id"]: p for p in pieces}
    pairs: dict[str, dict] = {}
    for pair in obj.get("matches", []) if isinstance(obj.get("matches"), list) else []:
        if not isinstance(pair, dict):
            continue
        rid = pair.get("requirement_id")
        if rid in valid_rids and rid not in pairs:
            pairs[rid] = pair

    with connect() as conn:
        conn.execute(
            "DELETE FROM matches WHERE requirement_id IN (SELECT id FROM requirements WHERE tender_id=?)",
            (tender_id,),
        )
        for rid, pair in pairs.items():
            piece = by_id.get(pair.get("piece_id") or "")
            status, reason = compute_status(piece)
            conn.execute(
                "INSERT INTO matches(id,requirement_id,piece_id,status,reason,created_at) VALUES (?,?,?,?,?,?)",
                (nid("mt"), rid, piece["id"] if piece else None, status, reason, today()),
            )
    audit.log_ai_call(meta, task="rapprochement", tender_id=tender_id,
                      request_id=getattr(request.state, "request_id", None))
    return {"matched": len(pairs), "meta": meta}


@app.get("/api/tenders/{tender_id}/readiness")
def readiness(tender_id: str, user: dict | None = Depends(auth.optional_user)):
    """Verdict calculé par `state.readiness` : la même règle que celle lue par l'agent."""
    auth.assert_access(user, tender_id=tender_id)
    return state.readiness(tender_id)


# -------------------------------------------------------------------- rédaction

SYSTEM_DRAFT = """Tu rédiges une section de mémoire technique pour une PME qui répond à un appel d'offres.
Contraintes :
- n'utilise que les références et informations fournies ; si une information manque, écris "(à compléter)" ;
- pas de superlatifs, pas de promesses non vérifiables ;
- structure claire, français professionnel ;
- termine par : "Proposition à relire et à adapter avant signature."."""


@app.post("/api/tenders/{tender_id}/draft")
def draft_section(
    tender_id: str,
    payload: DraftIn,
    request: Request,
    user: dict | None = Depends(auth.optional_user),
    _: None = Depends(ratelimit.ai_guard()),
):
    auth.assert_access(user, tender_id=tender_id)
    with connect() as conn:
        found = rows(conn.execute(
            "SELECT t.*, o.name AS org_name FROM tenders t JOIN organizations o ON o.id=t.org_id WHERE t.id=?",
            (tender_id,),
        ))
        if not found:
            abort("introuvable", "DAO inconnu", 404)
        tender = found[0]
        # les pièces ne partent jamais au modèle : intitulé, type et date seulement
        refs = rows(conn.execute(
            "SELECT label, kind, expires_on FROM pieces WHERE org_id=? AND kind IN ('reference','bilan')",
            (tender["org_id"],),
        ))
        grid = rows(conn.execute(
            "SELECT label, weight FROM requirements WHERE tender_id=? AND kind='critere'", (tender_id,)))
    if len(refs) < 2:
        abort("references_insuffisantes",
              "au moins deux références sont nécessaires pour rédiger", 409)

    prompt = (
        f"Entreprise : {tender['org_name']}\n"
        f"Marché : {tender['title'] or '(titre non extrait)'}\n"
        f"Acheteur : {tender['buyer'] or '(non extrait)'}\n"
        f"Grille de notation : {json.dumps(grid, ensure_ascii=False)}\n"
        f"Références disponibles : {json.dumps(refs, ensure_ascii=False)}\n"
        f"Section demandée : {payload.section} (600 à 900 mots)"
    )
    try:
        content, meta = ai.chat_text(SYSTEM_DRAFT, prompt, ai.MODEL_DRAFT)
    except ai.AIError as exc:
        _ai_failure(exc, "redaction", tender_id, getattr(request.state, "request_id", None))

    did = nid("dr")
    with connect() as conn:
        conn.execute(
            "INSERT INTO drafts(id,tender_id,section,content,model,tokens_in,tokens_out,created_at)"
            " VALUES (?,?,?,?,?,?,?,?)",
            (did, tender_id, payload.section, content, meta["model"],
             meta["tokens_in"], meta["tokens_out"], today()),
        )
    audit.log_ai_call(meta, task="redaction", tender_id=tender_id,
                      request_id=getattr(request.state, "request_id", None))
    return {"id": did, "section": payload.section, "content": content, "meta": meta}


@app.get("/api/tenders/{tender_id}/drafts")
def list_drafts(tender_id: str, user: dict | None = Depends(auth.optional_user)):
    auth.assert_access(user, tender_id=tender_id)
    with connect() as conn:
        return rows(conn.execute(
            "SELECT id, section, content, model, created_at FROM drafts WHERE tender_id=? ORDER BY created_at DESC",
            (tender_id,),
        ))


@app.get("/api/tenders/{tender_id}/cost")
def tender_ai_cost(tender_id: str, user: dict | None = Depends(auth.optional_user)):
    """Coût cumulé du dossier, recalculé depuis les appels journalisés."""
    auth.assert_access(user, tender_id=tender_id)
    _require_tender(tender_id)
    return audit.tender_cost(tender_id)


# ------------------------------------------------- documents, recherche, agent


@app.get("/api/documents")
def list_documents(org_id: str, tender_id: str | None = None,
                   user: dict | None = Depends(auth.optional_user)):
    """Ce qui est indexé pour cette entreprise, et ce que l'OCR local sait faire."""
    auth.assert_access(user, org_id=org_id)
    if tender_id:
        auth.assert_access(user, tender_id=tender_id)
    return {
        "documents": ingest.list_documents(org_id, tender_id),
        "index": rag.stats(org_id),
        "ocr": ocr.available(),
    }


@app.post("/api/tenders/{tender_id}/index")
async def reindex_tender(tender_id: str, user: dict | None = Depends(auth.optional_user)):
    """Réindexer un DAO déjà déposé, sans redéposer le PDF."""
    auth.assert_access(user, tender_id=tender_id)
    tender = _require_tender(tender_id)
    text_path = tender["text_path"]
    if not text_path or not Path(text_path).is_file():
        abort("texte_insuffisant", "le texte du DAO n'est pas disponible ; redépose le document", 409)
    texte = await run_in_threadpool(lambda: Path(text_path).read_text(encoding="utf-8"))
    return ingest.register(
        org_id=tender["org_id"], kind="dao", filename=Path(text_path).name, mime="text/plain",
        size_bytes=None, pages=tender["page_count"], text=texte,
        tender_id=tender_id, text_path=text_path)


@app.post("/api/search")
def search_documents(payload: SearchIn, user: dict | None = Depends(auth.optional_user)):
    """Recherche locale (BM25) : ce que l'agent voit quand il répond."""
    auth.assert_access(user, org_id=payload.org_id)
    if payload.tender_id:
        auth.assert_access(user, tender_id=payload.tender_id)
    return {
        "query": payload.query,
        "results": rag.search(payload.org_id, payload.query, k=payload.k,
                              tender_id=payload.tender_id),
        "index": rag.stats(payload.org_id),
    }


@app.get("/api/agent/identity")
def agent_identity():
    """Qui est l'assistant, ce qu'il sait faire, ce qu'il refuse de faire."""
    return agent.identity()


@app.post("/api/agent/chat")
def agent_chat(payload: ChatIn, request: Request,
               user: dict | None = Depends(auth.optional_user),
               _: None = Depends(ratelimit.ai_guard())):
    """Réponse ancrée : faits calculés par le code, extraits du DAO, page citée."""
    auth.assert_access(user, org_id=payload.org_id)
    if payload.tender_id:
        auth.assert_access(user, tender_id=payload.tender_id)
    if not ai.configured():
        abort("ia_indisponible", AI_DOWN, 502)
    try:
        reponse = agent.answer(payload.org_id, payload.message, payload.tender_id,
                               getattr(request.state, "request_id", None))
    except ai.AIError as exc:
        _ai_failure(exc, "agent", payload.tender_id, getattr(request.state, "request_id", None))
    audit.log_ai_call(reponse["meta"], task="agent", tender_id=payload.tender_id,
                      request_id=getattr(request.state, "request_id", None))
    return reponse


@app.get("/api/agent/history")
def agent_history(org_id: str, tender_id: str | None = None,
                  user: dict | None = Depends(auth.optional_user)):
    auth.assert_access(user, org_id=org_id)
    return {"messages": agent.history(org_id, tender_id)}


@app.api_route(
    "/api/{chemin:path}",
    methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    include_in_schema=False,
)
def api_route_inconnue(chemin: str):
    """Sans cela, la route inconnue tombe dans le montage statique et répond du HTML."""
    abort("introuvable", f"route inconnue : /api/{chemin}", 404)


# ------------------------------------------------------------- front statique

_static = Path(__file__).parent / "static"
if _static.exists():
    app.mount("/", StaticFiles(directory=_static, html=True), name="static")
