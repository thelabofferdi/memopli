import React from "react";
import { AppChip, Icon, PliSays, Ring, TINTS } from "../components/Brand.jsx";
import Halftone from "../components/Halftone.jsx";
import Mascot from "../components/Mascot.jsx";
import { Badge } from "../components/Ui.jsx";
import { dateFr, daysLeft, deadlineLabel, kindLabel, pieceStatus } from "../format.js";
import { navigate } from "../router.js";

// Accueil de l'espace client : où j'en suis, quoi faire ensuite, ce qui presse.
// Tout est calculé ici à partir des données du serveur (le code calcule).

const NIGHT = ["#111633", "#1a2160", "#232f9c", "#2b3ae0", "#a9b2ff"];

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Bonjour" : h < 18 ? "Bon après-midi" : "Bonsoir";
}

export function checklist(org, pieces, tenders) {
  const kinds = new Set(pieces.map((p) => p.kind));
  const refs = pieces.filter((p) => p.kind === "reference" || p.kind === "bilan").length;
  const profile = [org.ifu, org.rccm, org.sector, org.headcount].filter((v) => v !== null && v !== undefined && v !== "").length;
  return [
    { id: "compte", label: "Créer votre compte", done: true, to: "/app/compte", tint: TINTS.entreprise, icon: "user" },
    {
      id: "entreprise",
      label: "Compléter votre entreprise",
      hint: `${profile} champ${profile > 1 ? "s" : ""} sur 4 renseigné${profile > 1 ? "s" : ""}`,
      done: profile === 4,
      to: "/app/entreprise",
      tint: TINTS.entreprise,
      icon: "building",
      tip: "Votre numéro fiscal et votre registre du commerce sont demandés dans presque tous les dossiers.",
    },
    {
      id: "attestations",
      label: "Ajouter vos attestations",
      hint: "fiscale, CNSS et registre du commerce",
      done: kinds.has("attestation_fiscale") && kinds.has("cnss") && kinds.has("rccm"),
      to: "/app/documents",
      tint: TINTS.documents,
      icon: "files",
      tip: "Ajoutez vos attestations avec leur date de fin : je vous préviens avant qu'elles n'expirent.",
    },
    {
      id: "references",
      label: "Ajouter deux références de chantiers",
      hint: `${refs} sur 2`,
      done: refs >= 2,
      to: "/app/documents",
      tint: TINTS.documents,
      icon: "files",
      tip: "Il me faut au moins deux références pour rédiger une méthodologie qui vous ressemble.",
    },
    {
      id: "dossier",
      label: "Déposer un appel d'offres",
      done: tenders.length > 0,
      to: "/app/dossiers?nouveau=1",
      tint: TINTS.dossier,
      icon: "upload",
      tip: "Déposez le PDF publié par l'acheteur : je le lis page par page.",
    },
    {
      id: "exigences",
      label: "Relever les exigences",
      done: tenders.some((t) => t.requirements > 0),
      to: tenders[0] ? `/app/dossiers/${tenders[0].id}` : "/app/dossiers",
      tint: TINTS.exigences,
      icon: "list",
      tip: "Ouvrez votre dossier et lancez « Relever les exigences » : chacune sortira avec sa page.",
    },
    {
      id: "redaction",
      label: "Rédiger une méthodologie",
      done: tenders.some((t) => t.drafts > 0),
      to: tenders[0] ? `/app/dossiers/${tenders[0].id}` : "/app/dossiers",
      tint: TINTS.redaction,
      icon: "pen",
      tip: "Dernière étape : je rédige la méthodologie avec vos chantiers. Vous relisez, vous signez.",
    },
  ];
}

export default function Home({ org, pieces, tenders, user }) {
  const steps = checklist(org, pieces, tenders || []);
  const done = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);

  const upcoming = (tenders || [])
    .filter((t) => t.deadline && daysLeft(t.deadline) !== null && daysLeft(t.deadline) >= 0)
    .sort((a, b) => a.deadline.localeCompare(b.deadline));
  const nextDeadline = upcoming[0];

  const watch = pieces
    .map((p) => ({ p, status: pieceStatus(p), days: p.expires_on ? daysLeft(p.expires_on) : null }))
    .filter((x) => x.status !== "valide" || (x.days !== null && x.days <= 45))
    .sort((a, b) => (a.days ?? -999) - (b.days ?? -999));

  const expired = pieces.filter((p) => pieceStatus(p) === "perime").length;
  const valid = pieces.filter((p) => pieceStatus(p) === "valide").length;
  const firstName = (user?.email || "").split("@")[0].split(/[._-]/)[0];

  let summary = "Déposez votre premier appel d'offres : je m'occupe du reste avec vous.";
  if (tenders?.length) {
    summary = `${tenders.length} dossier${tenders.length > 1 ? "s" : ""} en cours`;
    if (nextDeadline) summary += ` · prochaine date limite ${deadlineLabel(nextDeadline.deadline)}`;
    if (expired) summary += ` · ${expired} document${expired > 1 ? "s" : ""} expiré${expired > 1 ? "s" : ""}`;
  }

  return (
    <>
      {/* bienvenue */}
      <section className="home-hero">
        <Halftone colors={NIGHT} cell={5} shape="right" bias={0.05} speed={0.6} className="home-hero-dots" />
        <div className="home-hero-text">
          <p className="ph-kicker light">{org.name}</p>
          <h1>
            {greeting()}
            {firstName ? <span className="cap"> {firstName}</span> : null}.
          </h1>
          <p>{summary}</p>
          <div className="home-hero-cta">
            <button type="button" className="btn-brand-lg" onClick={() => navigate("/app/dossiers?nouveau=1")}>
              <Icon name="plus" size={16} /> Nouveau dossier
            </button>
            <button type="button" className="btn-glass" onClick={() => navigate("/app/documents")}>
              Mes documents
            </button>
          </div>
        </div>
        <span className="home-hero-pli" aria-hidden="true">
          <Mascot size={170} mood={expired ? "worried" : "happy"} />
        </span>
      </section>

      {/* bien démarrer */}
      {next && (
        <section className="panel start">
          <div className="start-head">
            <Ring value={done / steps.length} label={`${done}/${steps.length}`} />
            <div>
              <p className="ph-kicker">Bien démarrer</p>
              <h2>Encore {steps.length - done} étape{steps.length - done > 1 ? "s" : ""} avant votre premier dossier complet.</h2>
            </div>
          </div>
          <ol className="start-list">
            {steps.map((s) => (
              <li key={s.id} className={s.done ? "done" : s === next ? "next" : ""}>
                <span className="start-check" aria-hidden="true">
                  {s.done ? <Icon name="check" size={14} /> : <AppChip tint={s.tint} icon={s.icon} size={24} />}
                </span>
                <span className="start-text">
                  <strong>{s.label}</strong>
                  {s.hint && !s.done && <small>{s.hint}</small>}
                </span>
                {!s.done && (
                  <a className={s === next ? "start-go primary" : "start-go"} href={`#${s.to}`}>
                    {s === next ? "Commencer" : "Ouvrir"} <Icon name="arrow" size={14} />
                  </a>
                )}
              </li>
            ))}
          </ol>
          {next.tip && <PliSays mood="happy">{next.tip}</PliSays>}
        </section>
      )}

      {/* chiffres */}
      <ul className="home-kpis">
        <li>
          <span className="kpi-ico" style={{ "--tint": TINTS.dossier }}>
            <Icon name="folder" size={18} />
          </span>
          <b>{tenders ? tenders.length : "–"}</b>
          <span>dossier{tenders && tenders.length > 1 ? "s" : ""}</span>
        </li>
        <li>
          <span className="kpi-ico" style={{ "--tint": TINTS.documents }}>
            <Icon name="files" size={18} />
          </span>
          <b>
            {valid}
            <small>/{pieces.length}</small>
          </b>
          <span>documents valides</span>
        </li>
        <li className={nextDeadline ? "" : "muted"}>
          <span className="kpi-ico" style={{ "--tint": TINTS.exigences }}>
            <Icon name="clock" size={18} />
          </span>
          <b>{nextDeadline ? `${daysLeft(nextDeadline.deadline)} j` : "—"}</b>
          <span>avant la prochaine date limite</span>
        </li>
      </ul>

      <div className="home-cols">
        {/* échéances */}
        <section className="panel">
          <header className="panel-head">
            <h2>Prochaines dates limites</h2>
          </header>
          {upcoming.length === 0 ? (
            <div className="empty-pli">
              <Mascot size={72} animated={false} mood="think" />
              <p>Aucune date limite à venir. Elles apparaîtront ici dès qu'un dossier sera lu.</p>
            </div>
          ) : (
            <ul className="due">
              {upcoming.slice(0, 4).map((t) => {
                const d = daysLeft(t.deadline);
                return (
                  <li key={t.id}>
                    <a href={`#/app/dossiers/${t.id}`}>
                      <span className={d <= 7 ? "due-day hot" : "due-day"}>
                        <b>{d}</b>
                        <small>jour{d > 1 ? "s" : ""}</small>
                      </span>
                      <span className="due-text">
                        <strong>{t.title || "Appel d'offres sans titre"}</strong>
                        <small>{dateFr(t.deadline)} · {t.buyer || "acheteur non extrait"}</small>
                      </span>
                      <Icon name="arrow" size={16} />
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* documents à surveiller */}
        <section className="panel">
          <header className="panel-head">
            <h2>Documents à surveiller</h2>
            <a className="ghost small" href="#/app/documents">
              Gérer
            </a>
          </header>
          {watch.length === 0 ? (
            <div className="empty-pli">
              <Mascot size={72} animated={false} />
              <p>{pieces.length ? "Tous vos documents sont valides. Rien ne presse." : "Ajoutez vos premiers documents : je surveillerai leurs dates."}</p>
            </div>
          ) : (
            <ul className="watch">
              {watch.slice(0, 5).map(({ p, status, days }) => (
                <li key={p.id}>
                  <span className={`dot ${status}`} aria-hidden="true" />
                  <span className="watch-text">
                    <strong>{p.label}</strong>
                    <small>
                      {kindLabel(p.kind)} ·{" "}
                      {status === "perime"
                        ? `expiré depuis le ${dateFr(p.expires_on)}`
                        : status === "a_verifier"
                          ? "aucune date de fin"
                          : `expire dans ${days} j`}
                    </small>
                  </span>
                  <Badge status={status === "valide" ? "a_verifier" : status}>
                    {status === "valide" ? "bientôt" : status === "perime" ? "expiré" : "à vérifier"}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* dossiers récents */}
      {tenders && tenders.length > 0 && (
        <section className="panel">
          <header className="panel-head">
            <h2>Dossiers récents</h2>
            <a className="ghost small" href="#/app/dossiers">
              Tous les dossiers
            </a>
          </header>
          <ul className="recent">
            {tenders.slice(0, 3).map((t) => {
              const step = t.drafts > 0 ? 3 : t.requirements > 0 ? 2 : 1;
              return (
                <li key={t.id}>
                  <a className="recent-main" href={`#/app/dossiers/${t.id}`}>
                    <AppChip tint={TINTS.dossier} icon="folder" size={36} />
                    <span className="recent-text">
                      <strong>{t.title || "Appel d'offres sans titre"}</strong>
                      <small>{t.buyer || "acheteur non extrait"} · {t.page_count} pages</small>
                    </span>
                    <span className="bars" aria-label={`Avancement ${step} sur 3`}>
                      {[1, 2, 3].map((n) => (
                        <i key={n} className={n <= step ? "on" : ""} />
                      ))}
                    </span>
                  </a>
                  <a className="recent-pli" href={`#/app/dossiers/${t.id}?pli=1`}>
                    <Mascot size={22} animated={false} /> Demander à Pli
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}
