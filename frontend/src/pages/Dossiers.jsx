import React, { useEffect, useRef, useState } from "react";
import * as api from "../api.js";
import { AppChip, Icon, PageHead, TINTS } from "../components/Brand.jsx";
import Mascot from "../components/Mascot.jsx";
import { Badge, FileDrop } from "../components/Ui.jsx";
import { dateFr, daysLeft, deadlineLabel } from "../format.js";
import { navigate } from "../router.js";

const STAGES = ["Dossier déposé", "Exigences relevées", "Méthodologie rédigée"];
const stageOf = (t) => (t.drafts > 0 ? 3 : t.requirements > 0 ? 2 : 1);

export default function Dossiers({ org, tenders, busy, run, openNew }) {
  const [file, setFile] = useState(null);
  const [adding, setAdding] = useState(openNew);
  const fileRef = useRef(null);
  const formRef = useRef(null);

  useEffect(() => {
    if (openNew) {
      setAdding(true);
      setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 100);
    }
  }, [openNew]);

  const upload = async (e) => {
    e.preventDefault();
    if (!file) return;
    let created = null;
    const ok = await run("dépôt du dossier", async () => {
      created = await api.uploadTender({ org_id: org.id, file });
    });
    if (ok && created) navigate(`/app/dossiers/${created.id}`);
  };

  const list = tenders || [];
  const showForm = adding || (tenders && tenders.length === 0);

  return (
    <>
      <PageHead
        kicker="Mes dossiers"
        title="Vos appels d'offres."
        sub="Chaque dossier auquel vous répondez, du plus récent au plus ancien."
        tip={
          list.length
            ? "Ouvrez un dossier pour voir ses exigences, vérifier vos documents et me poser vos questions."
            : "Déposez le PDF de l'appel d'offres : je le lis page par page et je relève chaque exigence."
        }
        mood={list.length ? "happy" : "think"}
        actions={
          list.length > 0 && !adding ? (
            <button type="button" onClick={() => setAdding(true)}>
              <Icon name="plus" size={16} /> Nouveau dossier
            </button>
          ) : null
        }
      />

      {showForm && (
        <section className="panel newdoc" ref={formRef} aria-labelledby="nouveau-titre">
          <header className="panel-head">
            <h2 id="nouveau-titre">
              <AppChip tint={TINTS.dossier} icon="upload" size={32} /> Nouveau dossier
            </h2>
            {adding && list.length > 0 && (
              <button type="button" className="ghost small" onClick={() => setAdding(false)}>
                Annuler
              </button>
            )}
          </header>
          <p className="panel-lede">Déposez le PDF publié par l'acheteur. Comptez moins d'une minute pour 80 pages.</p>
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
                Déposer le dossier <Icon name="arrow" size={16} />
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
      ) : list.length === 0 ? (
        <div className="empty-big">
          <Mascot size={140} mood="think" />
          <h3>Aucun dossier pour l'instant.</h3>
          <p>Votre premier appel d'offres apparaîtra ici, avec sa date limite et son avancement.</p>
        </div>
      ) : (
        <ul className="tenders">
          {list.map((t) => {
            const days = t.deadline ? daysLeft(t.deadline) : null;
            const stage = stageOf(t);
            return (
              <li key={t.id}>
                <a className="tender-card" href={`#/app/dossiers/${t.id}`}>
                  <AppChip tint={TINTS.dossier} icon="folder" size={44} />
                  <div className="tender-main">
                    <strong>{t.title || "Appel d'offres sans titre"}</strong>
                    <span className="meta">
                      {t.buyer || <span className="src-missing">acheteur non extrait</span>}
                      <span aria-hidden="true">·</span>
                      {t.page_count} pages
                      <span aria-hidden="true">·</span>
                      déposé le {dateFr(t.created_at)}
                    </span>
                    <span className="tender-steps" aria-label={`Avancement : ${STAGES[stage - 1]}`}>
                      {STAGES.map((label, i) => (
                        <span key={label} className={i < stage ? "on" : ""}>
                          {label}
                        </span>
                      ))}
                    </span>
                  </div>
                  <div className="tender-side">
                    <small>Date limite</small>
                    {t.deadline ? (
                      <>
                        <b>{dateFr(t.deadline)}</b>
                        <Badge status={days !== null && days < 0 ? "perime" : "a_verifier"}>{deadlineLabel(t.deadline)}</Badge>
                      </>
                    ) : (
                      <span className="src-missing">non extrait</span>
                    )}
                  </div>
                  <span className="tender-go" aria-hidden="true">
                    <Icon name="arrow" size={18} />
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
