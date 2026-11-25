import React, { useEffect, useRef, useState } from "react";
import * as api from "../api.js";
import { Badge, Empty, FileDrop } from "../components/Ui.jsx";
import { dateFr, daysLeft, deadlineLabel, pieceStatus } from "../format.js";
import { navigate } from "../router.js";

function progress(t) {
  if (t.drafts > 0) return { label: "Méthodologie rédigée", step: 3 };
  if (t.requirements > 0) return { label: "Exigences relevées", step: 2 };
  return { label: "Dossier déposé", step: 1 };
}

export default function Dossiers({ org, pieces, busy, run }) {
  const [tenders, setTenders] = useState(null);
  const [file, setFile] = useState(null);
  const [adding, setAdding] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    let alive = true;
    api
      .listTenders(org.id)
      .then((list) => alive && setTenders(list))
      .catch(() => alive && setTenders([]));
    return () => {
      alive = false;
    };
  }, [org.id]);

  const upload = async (e) => {
    e.preventDefault();
    if (!file) return;
    let created = null;
    const ok = await run("dépôt du dossier", async () => {
      created = await api.uploadTender({ org_id: org.id, file });
    });
    if (ok && created) navigate(`/app/dossiers/${created.id}`);
  };

  const expired = pieces.filter((p) => pieceStatus(p) === "perime").length;
  const undated = pieces.filter((p) => pieceStatus(p) === "a_verifier").length;
  const references = pieces.filter((p) => p.kind === "reference" || p.kind === "bilan").length;
  const showForm = adding || (tenders && tenders.length === 0);

  return (
    <>
      <header className="page-head page-head-row">
        <div>
          <h1>Mes dossiers</h1>
          <p>Chaque appel d'offres auquel vous répondez, du plus récent au plus ancien.</p>
        </div>
        {tenders && tenders.length > 0 && !adding && (
          <button type="button" onClick={() => setAdding(true)}>
            + Nouveau dossier
          </button>
        )}
      </header>

      <ul className="kpis">
        <li>
          <b>{tenders ? tenders.length : "–"}</b>
          <span>dossier{tenders && tenders.length > 1 ? "s" : ""}</span>
        </li>
        <li>
          <b>{pieces.length}</b>
          <span>document{pieces.length > 1 ? "s" : ""}</span>
        </li>
        <li className={expired ? "kpi-ko" : ""}>
          <b>{expired}</b>
          <span>expiré{expired > 1 ? "s" : ""}</span>
        </li>
        <li className={undated ? "kpi-warn" : ""}>
          <b>{undated}</b>
          <span>sans date</span>
        </li>
      </ul>

      {(expired > 0 || references < 2) && (
        <p className="callout warn">
          {expired > 0 && `${expired} document${expired > 1 ? "s" : ""} expiré${expired > 1 ? "s" : ""} : il${expired > 1 ? "s" : ""} bloquera${expired > 1 ? "ont" : ""} vos dépôts. `}
          {references < 2 && `Ajoutez au moins deux références de chantiers pour pouvoir rédiger la méthodologie. `}
          <a href="#/app/documents">Gérer mes documents →</a>
        </p>
      )}

      {showForm && (
        <section className="panel" aria-labelledby="nouveau-titre">
          <header className="panel-head">
            <h2 id="nouveau-titre">Nouveau dossier</h2>
            {adding && (
              <button type="button" className="ghost small" onClick={() => setAdding(false)}>
                Annuler
              </button>
            )}
          </header>
          <p className="panel-lede">
            Déposez le PDF de l'appel d'offres publié par l'acheteur. MemoPli le lira page par page.
          </p>
          <form className="form" onSubmit={upload}>
            <div className="field field-wide">
              <FileDrop
                ref={fileRef}
                file={file}
                onFile={setFile}
                label="Choisir le dossier d'appel d'offres"
                hint="PDF dont le texte est sélectionnable — ou glissez-le ici"
              />
            </div>
            <div className="form-actions">
              <button type="submit" disabled={Boolean(busy) || !file}>
                Déposer le dossier
              </button>
            </div>
          </form>
        </section>
      )}

      {tenders === null ? (
        <div className="panel skeleton" aria-busy="true">
          <span />
          <span />
        </div>
      ) : tenders.length === 0 ? (
        <Empty>Aucun dossier pour l'instant. Déposez votre premier appel d'offres ci-dessus.</Empty>
      ) : (
        <ul className="tenders">
          {tenders.map((t) => {
            const days = t.deadline ? daysLeft(t.deadline) : null;
            const p = progress(t);
            return (
              <li key={t.id}>
                <a className="tender-card" href={`#/app/dossiers/${t.id}`}>
                  <div className="tender-main">
                    <strong>{t.title || "Appel d'offres sans titre"}</strong>
                    <span className="meta">
                      {t.buyer || <span className="src-missing">acheteur non extrait</span>}
                      <span aria-hidden="true">·</span>
                      {t.page_count} pages
                      <span aria-hidden="true">·</span>
                      déposé le {dateFr(t.created_at)}
                    </span>
                  </div>
                  <div className="tender-side">
                    {t.deadline ? (
                      <span className="tender-deadline">
                        <small>Date limite</small>
                        {dateFr(t.deadline)}
                        <Badge status={days !== null && days < 0 ? "perime" : "a_verifier"}>
                          {deadlineLabel(t.deadline)}
                        </Badge>
                      </span>
                    ) : (
                      <span className="tender-deadline">
                        <small>Date limite</small>
                        <span className="src-missing">non extrait</span>
                      </span>
                    )}
                    <span className="tender-progress" aria-label={`Avancement : ${p.label}`}>
                      <span className="bars" aria-hidden="true">
                        {[1, 2, 3].map((n) => (
                          <i key={n} className={n <= p.step ? "on" : ""} />
                        ))}
                      </span>
                      {p.label}
                    </span>
                  </div>
                  <span className="tender-go" aria-hidden="true">
                    →
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
