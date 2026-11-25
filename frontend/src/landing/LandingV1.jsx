import React, { useEffect, useRef, useState } from "react";
import { Mark, Wordmark } from "../components/brand/Logo.jsx";
import Mascot from "../components/brand/Mascot.jsx";
import AnimatedCounter from "../components/ui/animated-counter.tsx";

// Page publique, destinée aux clients. Elle ne parle que de leur problème :
// pas de modèle, pas de coût d'API, pas de jargon. Chaque chiffre a sa source
// (docs/08-sources.md) ; chaque promesse est tenue par le produit actuel.

// À confirmer avant mise en ligne : adresse de contact réelle.
export const CONTACT_EMAIL = "contact@memopli.com";

// Langage : nos clients n'emploient pas tous les mêmes mots (Bénin, Sénégal,
// Côte d'Ivoire, ONG, bailleurs…). Règle de la page : le mot le plus simple,
// et une définition au survol pour les rares termes impossibles à éviter.
export const GLOSSARY = {
  dao: {
    name: "Dossier d'appel d'offres (DAO)",
    def: "Le dossier publié par l'acheteur : ce qu'il veut acheter, les documents à fournir, la façon dont les offres seront notées et la date limite.",
  },
  memoire: {
    name: "Mémoire technique",
    def: "La partie de votre offre où vous expliquez comment vous ferez le travail : méthode, équipe, matériel, planning. On dit aussi offre technique ou note méthodologique.",
  },
  acheteur: {
    name: "Acheteur",
    def: "L'organisme qui lance l'appel d'offres et choisit l'entreprise : ministère, mairie, établissement public, projet financé par un bailleur de fonds, ONG…",
  },
  criteres: {
    name: "Critères de notation",
    def: "La grille qui dit comment l'acheteur note les offres, avec le poids de chaque critère — par exemple : méthodologie, 30 % de la note.",
  },
  ifu: {
    name: "IFU",
    def: "Le numéro fiscal de l'entreprise au Bénin. Ailleurs : NIF, NINEA, numéro de contribuable.",
  },
  rccm: {
    name: "RCCM",
    def: "L'immatriculation de l'entreprise au registre du commerce. En France : l'extrait Kbis.",
  },
};

export function Term({ k, children }) {
  const t = GLOSSARY[k];
  const id = `term-${k}`;
  return (
    <span className="term" tabIndex={0} aria-describedby={id}>
      {children}
      <span className="term-tip" role="tooltip" id={id}>
        <b>{t.name}</b>
        {t.def}
      </span>
    </span>
  );
}

const FIGURES = [
  {
    to: 800,
    prefix: "≈ ",
    suffix: " Md",
    text: "de FCFA d'achats publics chaque année au Bénin.",
    src: "ADPME Bénin",
  },
  {
    to: 20,
    suffix: " %",
    text: "de ces achats sont réservés aux petites et moyennes entreprises. L'objectif : 30 à 35 %.",
    src: "ARMP, novembre 2026",
  },
  {
    to: 85,
    suffix: " %",
    text: "des contestations déposées par les entreprises sont rejetées, faute de bien connaître les règles et de dossiers solides.",
    src: "ARMP, novembre 2026",
  },
];

const PAINS = [
  {
    title: "Tout est à refaire",
    text: "Chaque dossier repart d'une page blanche : les documents sont éparpillés, le texte de l'an dernier ne correspond plus.",
  },
  {
    title: "Une date suffit à tout perdre",
    text: "Une attestation expirée depuis une semaine, et le dossier est écarté — même si votre offre était la meilleure.",
  },
  {
    title: "Le mémoire prend des jours",
    text: (
      <>
        40 à 80 pages à écrire en suivant les <Term k="criteres">critères de notation</Term>, souvent seul, en
        plus du travail habituel.
      </>
    ),
  },
];

const JOBS = [
  {
    when: "Quand un appel d'offres paraît,",
    want: "vous voyez tout de suite ce qu'il demande et si votre dossier tient la route.",
  },
  {
    when: "Quand vous décidez de répondre,",
    want: "votre mémoire technique suit déjà les critères de l'acheteur.",
  },
  {
    when: "Avant de déposer,",
    want: "vous savez qu'aucun document ne manque et qu'aucune date n'est dépassée.",
  },
];

const STEPS = [
  {
    title: "Votre entreprise",
    text: "Nom, numéro fiscal, registre du commerce, secteur, effectif. Une seule fois, repris dans chaque dossier.",
  },
  {
    title: "Vos documents",
    text: "Attestations, registre, références de chantiers, bilans — chacun avec sa date de fin de validité. MemoPli surveille les échéances.",
  },
  {
    title: "Le dossier d'appel d'offres",
    text: "Déposez le fichier PDF publié par l'acheteur. MemoPli le lit en entier, page par page.",
  },
  {
    title: "Ce que demande l'acheteur",
    text: "Documents à fournir et critères de notation, chacun avec la page où il figure. Une ligne vous semble fausse ? Vous la corrigez.",
  },
  {
    title: "Le verdict et le mémoire",
    text: "« Prêt » ou « Pas prêt », avec ce qui bloque. Puis la partie méthodologie de votre mémoire technique, écrite avec vos chantiers.",
  },
];

const PROMISES = [
  {
    icon: "page",
    title: "Chaque exigence avec sa page",
    text: "Vous vérifiez d'un coup d'œil dans le document d'origine. Rien n'est affirmé sans preuve.",
  },
  {
    icon: "none",
    title: "Rien d'inventé",
    text: "Si le dossier ne dit rien, MemoPli l'indique. S'il manque une information pour le mémoire, il écrit « à compléter ».",
  },
  {
    icon: "lock",
    title: "Vos documents restent les vôtres",
    text: "Vos attestations, bilans et références ne sont jamais transmis à un service extérieur.",
  },
  {
    icon: "stop",
    title: "Un document expiré bloque le dépôt",
    text: "Il compte comme un document manquant. Vous le savez avant l'acheteur, pas après.",
  },
];

const RIVALS = [
  { name: "Le cahier et la mémoire", limit: "Aucun suivi des dates, rien n'est gardé d'un dossier à l'autre, les mêmes erreurs reviennent." },
  { name: "Le fichier Word du dossier précédent", limit: "Ancien nom du marché, paragraphes dépassés, documents expirés." },
  { name: "Un outil de rédaction généraliste", limit: "Il ne connaît ni l'appel d'offres, ni vos documents, ni vos dates." },
  { name: "Un cabinet qui monte le dossier pour vous", limit: "300 000 à 500 000 FCFA par dossier, des délais, et vous en dépendez." },
];

const EDGE = [
  { title: "Il part de l'appel d'offres", text: "Il lit le dossier de l'acheteur et en tire ce qui est attendu de vous." },
  { title: "Il écrit avec vos chantiers", text: "Vos références réelles, pas un texte passe-partout." },
  { title: "Il bloque le dépôt", text: "Tant qu'un document manque ou qu'une date est dépassée." },
  { title: "Il se souvient", text: "Vos documents et vos références servent au dossier suivant." },
];

// Les mêmes choses portent des noms différents selon le pays et l'organisme.
export const EQUIV = [
  { ours: "Dossier d'appel d'offres", also: ["DAO", "DCE", "cahier des charges", "dossier de consultation", "termes de référence (TDR)"] },
  { ours: "Acheteur", also: ["autorité contractante", "maître d'ouvrage", "bailleur", "donneur d'ordre"] },
  { ours: "Mémoire technique", also: ["offre technique", "proposition technique", "note méthodologique"] },
  { ours: "Critères de notation", also: ["grille d'évaluation", "critères d'attribution", "barème"] },
  { ours: "Documents administratifs", also: ["pièces administratives", "justificatifs", "attestations"] },
  { ours: "Attestation fiscale", also: ["quitus fiscal", "attestation de régularité fiscale", "certificat de non-redevance"] },
  { ours: "Registre du commerce", also: ["RCCM", "extrait Kbis", "immatriculation"] },
];

const FAQ = [
  {
    q: "Mes documents sont-ils en sécurité ?",
    a: "Vos documents restent dans votre espace MemoPli. Pour savoir quel document répond à quelle demande, seuls son nom, son type et sa date sont utilisés — jamais le document lui-même.",
  },
  {
    q: "Et si MemoPli lit mal une exigence ?",
    a: "Chaque exigence indique la page du dossier d'où elle vient : vous vérifiez en un instant et vous corrigez. C'est votre correction qui compte. Si le dossier ne précise rien, MemoPli écrit « non extrait » au lieu de deviner.",
  },
  {
    q: "Le texte rédigé est-il prêt à signer ?",
    a: "C'est une base de travail, à relire et à adapter. Elle s'appuie uniquement sur vos références ; quand une information manque, elle le signale. Il faut au moins deux références de chantiers dans vos documents.",
  },
  {
    q: "Mon dossier d'appel d'offres est scanné.",
    a: "MemoPli lit les PDF dont on peut sélectionner le texte. Si le fichier n'est qu'une image, l'écran vous le dit plutôt que de vous donner une liste incomplète.",
  },
  {
    q: "Les noms des documents changent selon les pays. Est-ce un problème ?",
    a: "Non. Une attestation fiscale peut s'appeler quitus fiscal, un mémoire technique offre technique : vous nommez vos documents avec vos propres mots, et vous vérifiez chaque rapprochement proposé.",
  },
  {
    q: "Faut-il installer quelque chose ?",
    a: "Non. MemoPli s'utilise dans le navigateur, sur ordinateur comme sur tablette.",
  },
  {
    q: "Pour quels secteurs ?",
    a: "MemoPli est pensé d'abord pour les entreprises du bâtiment et des travaux publics, puis pour toute entreprise qui répond à des appels d'offres : fournitures, services, conseil, ONG.",
  },
];

const reduceMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function useInView(options = { threshold: 0.25 }) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), options);
    io.observe(node);
    return () => io.disconnect();
  }, []);
  return [ref, inView];
}

// Apparition au défilement : un seul observateur pour tous les [data-reveal].
export function useReveal() {
  useEffect(() => {
    const nodes = document.querySelectorAll("[data-reveal]");
    if (reduceMotion()) {
      nodes.forEach((n) => n.classList.add("is-in"));
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }),
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );
    nodes.forEach((n) => io.observe(n));
    return () => io.disconnect();
  }, []);
}

const fmt = (n, decimals = 0) =>
  n.toLocaleString("fr-FR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

// Compteur à roulettes (Rare UI · AnimatedCounter) : part de 0 et roule
// jusqu'à la valeur quand le chiffre entre dans l'écran.
export function CountUp({ to, decimals = 0, prefix = "", suffix = "" }) {
  const [ref, inView] = useInView({ threshold: 0.6 });
  const [value, setValue] = useState(reduceMotion() ? to : 0);
  useEffect(() => {
    if (inView) setValue(to);
  }, [inView, to]);
  return (
    <b ref={ref} className="fig-num rui">
      <AnimatedCounter
        value={value}
        decimals={decimals}
        duration={1.2}
        separator={"\u202f"}
        decimalSeparator=","
        prefix={prefix ? prefix.replace(/ /g, "\u00a0") : undefined}
        suffix={suffix ? suffix.replace(/ /g, "\u00a0") : undefined}
      />
    </b>
  );
}

// ------------------------------------------------------- démonstration hero

// Le scénario de la démo (docs/06-demo.md), joué en boucle : extraction avec
// pages → « Pas prêt » (CNSS périmée) → remplacement → « Prêt » → rédaction.
const DEMO_ROWS = [
  { label: "Attestation de régularité fiscale", page: 12 },
  { label: "Attestation CNSS", page: 14 },
  { label: "Registre du commerce (RCCM)", page: 12 },
  { label: "Méthodologie et organisation · 30 %", page: 41, grid: true },
];

const PHASES = ["Lecture", "Contrôle", "Mise à jour", "Rédaction"];

function HeroDemo() {
  const [phase, setPhase] = useState(0);
  const [rows, setRows] = useState(reduceMotion() ? DEMO_ROWS.length : 0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (reduceMotion()) {
      setPhase(3);
      return undefined;
    }
    if (paused) return undefined;
    if (phase === 0 && rows < DEMO_ROWS.length) {
      const t = setTimeout(() => setRows((r) => r + 1), 520);
      return () => clearTimeout(t);
    }
    const t = setTimeout(
      () => {
        if (phase === 3) {
          setRows(0);
          setPhase(0);
        } else setPhase((p) => p + 1);
      },
      phase === 3 ? 4200 : 2400,
    );
    return () => clearTimeout(t);
  }, [phase, rows, paused]);

  const cnss = phase === 0 ? null : phase === 1 ? "perime" : "valide";
  const status = (i) => {
    if (DEMO_ROWS[i].grid) return "grid";
    if (i === 1) return cnss;
    return phase === 0 ? null : "valide";
  };
  const statusLabel = { valide: "valide", perime: "expirée" };
  const ready = phase >= 2;

  return (
    <div
      className="demo"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-label="Démonstration animée du parcours MemoPli"
      role="img"
    >
      <div className="demo-bar">
        <span className="demo-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="demo-title">Appel d'offres · Travaux de voirie</span>
      </div>

      <ol className="demo-phases" aria-hidden="true">
        {PHASES.map((p, i) => (
          <li key={p} className={i === phase ? "on" : i < phase ? "done" : ""}>
            {p}
          </li>
        ))}
      </ol>

      <div className="demo-body">
        {phase < 3 ? (
          <ul className="demo-rows">
            {DEMO_ROWS.map((row, i) => {
              const s = status(i);
              return (
                <li key={row.label} className={i < rows ? "in" : ""}>
                  <span className={`demo-dot ${s || "pending"}`} />
                  <span className="demo-label">{row.label}</span>
                  <span className="demo-page">p. {row.page}</span>
                  {s && s !== "grid" && <span className={`demo-badge ${s}`}>{statusLabel[s]}</span>}
                  {s === "grid" && <span className="demo-badge grid">critère</span>}
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="demo-draft">
            <div className="demo-draft-head">
              <strong>Méthodologie et organisation</strong>
              <span className="demo-badge todo">à relire</span>
            </div>
            {["Compréhension du besoin", "Organisation du chantier", "Moyens humains et matériels", "Planning"].map(
              (h, i) => (
                <div className="demo-para" key={h} style={{ "--i": i }}>
                  <em>{h}</em>
                  <span className="demo-line" />
                  <span className="demo-line short" />
                </div>
              ),
            )}
          </div>
        )}
      </div>

      <div className={`demo-verdict ${phase === 0 ? "wait" : ready ? "ok" : "ko"}`}>
        <span>
          {phase === 0 ? "Lecture du dossier…" : ready ? "Prêt à déposer" : "Pas prêt · 1 blocage"}
        </span>
        <small>
          {phase === 0
            ? "chaque exigence avec sa page"
            : ready
              ? "aucun document manquant ni expiré"
              : "Attestation CNSS expirée"}
        </small>
      </div>
    </div>
  );
}

// ------------------------------------------------------- parcours interactif

function StepPreview({ i }) {
  if (i === 0)
    return (
      <div className="pv pv-form">
        {[
          ["Nom de l'entreprise", "Votre entreprise SARL"],
          ["Numéro fiscal", "13 chiffres", "ifu", "IFU"],
          ["Registre du commerce", "RB/COT/…", "rccm", "RCCM"],
          ["Secteur", "Bâtiment, travaux publics"],
          ["Effectif", "10 à 50"],
        ].map(([k, v, term, abbr]) => (
          <div className="pv-field" key={k}>
            <span>
              {k}
              {term && (
                <>
                  {" "}(<Term k={term}>{abbr}</Term>)
                </>
              )}
            </span>
            <i>{v}</i>
          </div>
        ))}
      </div>
    );
  if (i === 1)
    return (
      <ul className="pv pv-list">
        <li><span className="demo-dot valide" />Attestation fiscale<small>jusqu'au 30/06</small><b className="demo-badge valide">valide</b></li>
        <li><span className="demo-dot perime" />Attestation CNSS<small>expirée</small><b className="demo-badge perime">expirée</b></li>
        <li><span className="demo-dot a_verifier" />Bilan 2025<small>sans date</small><b className="demo-badge todo">à vérifier</b></li>
        <li><span className="demo-dot valide" />Référence · chantier<small>année, montant</small><b className="demo-badge valide">valide</b></li>
      </ul>
    );
  if (i === 2)
    return (
      <div className="pv pv-upload">
        <div className="pv-drop">
          <b>Appel-offres.pdf</b>
          <span>Glissez le PDF ici</span>
        </div>
        <div className="pv-pages" aria-hidden="true">
          {Array.from({ length: 24 }, (_, k) => (
            <i key={k} style={{ "--k": k }} />
          ))}
        </div>
        <small>Lecture du document · 80 pages</small>
      </div>
    );
  if (i === 3)
    return (
      <ul className="pv pv-list">
        <li><span className="demo-page">p. 12</span>Attestation de régularité fiscale<b className="demo-badge grid">document</b></li>
        <li><span className="demo-page">p. 14</span>Attestation CNSS<b className="demo-badge grid">document</b></li>
        <li><span className="demo-page">p. 41</span>Méthodologie et organisation<b className="demo-badge grid">30 %</b></li>
        <li><span className="demo-page warn">—</span>Délai d'exécution<b className="demo-badge todo">non extrait</b></li>
      </ul>
    );
  return (
    <div className="pv pv-prod">
      <div className="demo-verdict ko static">
        <span>Pas prêt · 1 blocage</span>
        <small>Attestation CNSS expirée</small>
      </div>
      <div className="pv-arrow" aria-hidden="true">↓ on remplace le document</div>
      <div className="demo-verdict ok static">
        <span>Prêt à déposer</span>
        <small>section méthodologie rédigée · à relire</small>
      </div>
    </div>
  );
}

function Journey() {
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);
  const [ref, inView] = useInView({ threshold: 0.4 });

  useEffect(() => {
    if (!auto || !inView || reduceMotion()) return undefined;
    const t = setTimeout(() => setActive((a) => (a + 1) % STEPS.length), 4200);
    return () => clearTimeout(t);
  }, [active, auto, inView]);

  return (
    <div className="journey" ref={ref}>
      <ol className="journey-list" role="tablist" aria-label="Les cinq étapes">
        {STEPS.map((s, i) => (
          <li key={s.title}>
            <button
              type="button"
              role="tab"
              aria-selected={i === active}
              className={i === active ? "journey-step on" : "journey-step"}
              onClick={() => {
                setActive(i);
                setAuto(false);
              }}
            >
              <span className="journey-num">{String(i + 1).padStart(2, "0")}</span>
              <span className="journey-text">
                <strong>{s.title}</strong>
                <span>{s.text}</span>
              </span>
              {i === active && auto && inView && <span className="journey-progress" key={active} />}
            </button>
          </li>
        ))}
      </ol>
      <div className="journey-panel" role="tabpanel" key={active}>
        <div className="journey-panel-head">
          <span>Étape {active + 1} sur 5</span>
          <strong>{STEPS[active].title}</strong>
        </div>
        <StepPreview i={active} />
      </div>
    </div>
  );
}

// --------------------------------------------------- verdict interactif

export function VerdictToggle({ onChange }) {
  const [replaced, setReplaced] = useState(false);
  useEffect(() => {
    onChange?.(replaced);
  }, [replaced, onChange]);
  const pieces = [
    { label: "Attestation de régularité fiscale", page: 12, ok: true },
    { label: "Attestation CNSS", page: 14, ok: replaced },
    { label: "Registre du commerce (RCCM)", page: 12, ok: true },
  ];
  return (
    <div className="vt">
      <ul className="vt-list">
        {pieces.map((p) => (
          <li key={p.label} className={p.ok ? "" : "bad"}>
            <span className={`demo-dot ${p.ok ? "valide" : "perime"}`} />
            <span className="vt-label">{p.label}</span>
            <span className="demo-page">p. {p.page}</span>
            <b className={`demo-badge ${p.ok ? "valide" : "perime"}`}>{p.ok ? "valide" : "expirée"}</b>
          </li>
        ))}
      </ul>
      <div className={`vt-verdict ${replaced ? "ok" : "ko"}`} aria-live="polite">
        <strong>{replaced ? "Prêt à déposer" : "Pas prêt"}</strong>
        <span>{replaced ? "Aucun blocage. Le bouton se libère." : "1 blocage : Attestation CNSS expirée."}</span>
      </div>
      <div className="vt-actions">
        <button type="button" className="btn btn-light" onClick={() => setReplaced((r) => !r)}>
          {replaced ? "Revenir au document expiré" : "Remplacer l'attestation CNSS"}
        </button>
        <button type="button" className="btn btn-submit" disabled={!replaced}>
          Prêt à déposer
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- page

// ---------------------------------------------------------------- page

const NAV = [
  ["probleme", "Le problème"],
  ["parcours", "Comment ça marche"],
  ["garanties", "Garanties"],
  ["tarif", "Tarif"],
  ["faq", "Questions"],
];

function SectionHead({ kicker, title, children, center = false, wide = false }) {
  const cls = ["sh", center && "sh-center", wide && "sh-wide"].filter(Boolean).join(" ");
  return (
    <header className={cls} data-reveal>
      <p className="kicker">{kicker}</p>
      <h2>{title}</h2>
      {children && <p className="lede">{children}</p>}
    </header>
  );
}

function PromiseIcon({ kind }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
      {kind === "page" && (
        <>
          <path {...common} d="M6 3h8l4 4v14H6z" />
          <path {...common} d="M14 3v4h4M9 12h6M9 16h4" />
        </>
      )}
      {kind === "none" && (
        <>
          <circle {...common} cx="12" cy="12" r="8.5" />
          <path {...common} d="M8.5 12h7" />
        </>
      )}
      {kind === "lock" && (
        <>
          <rect {...common} x="5" y="10.5" width="14" height="10" rx="2" />
          <path {...common} d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
        </>
      )}
      {kind === "stop" && (
        <>
          <path {...common} d="M12 3.5 4.5 6.5v5c0 4.4 3.1 8 7.5 9 4.4-1 7.5-4.6 7.5-9v-5z" />
          <path {...common} d="m9 12 2.2 2.2L15.5 10" />
        </>
      )}
    </svg>
  );
}

export default function LandingV1() {
  const [scrolled, setScrolled] = useState(false);
  const [current, setCurrent] = useState("");
  const [menu, setMenu] = useState(false);
  useReveal();

  useEffect(() => {
    if (!menu) return undefined;
    const onKey = (e) => e.key === "Escape" && setMenu(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menu]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setCurrent(e.target.id)),
      { rootMargin: "-45% 0px -50% 0px" },
    );
    NAV.forEach(([id]) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });
    return () => {
      window.removeEventListener("scroll", onScroll);
      io.disconnect();
    };
  }, []);

  // Les ancres internes ne doivent pas changer la route (#/ vs #/app).
  const go = (id) => (e) => {
    e.preventDefault();
    setMenu(false);
    document.getElementById(id)?.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth" });
  };
  const year = new Date().getFullYear();

  return (
    <div className="lp">
      <a className="skip" href="#probleme" onClick={go("probleme")}>
        Aller au contenu
      </a>

      <nav className={["nav", scrolled && "scrolled", menu && "open"].filter(Boolean).join(" ")}>
        <div className="wrap nav-in">
          <a className="nav-brand" href="#/" aria-label="MemoPli, accueil">
            <Mark size={30} />
            <Wordmark />
          </a>
          <div className="nav-links">
            {NAV.map(([id, label]) => (
              <a key={id} href={`#${id}`} onClick={go(id)} className={current === id ? "on" : ""}>
                {label}
              </a>
            ))}
          </div>
          <div className="nav-actions">
            <a className="nav-demo" href="#/connexion">
              Se connecter
            </a>
            <a className="btn btn-brand btn-sm" href="#/inscription">
              Commencer
            </a>
            <button
              type="button"
              className="nav-burger"
              aria-label={menu ? "Fermer le menu" : "Ouvrir le menu"}
              aria-expanded={menu}
              aria-controls="nav-menu"
              onClick={() => setMenu((m) => !m)}
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>
        <div className="nav-menu" id="nav-menu" hidden={!menu}>
          <div className="wrap">
            {NAV.map(([id, label]) => (
              <a key={id} href={`#${id}`} onClick={go(id)}>
                {label}
                <span aria-hidden="true">→</span>
              </a>
            ))}
            <a className="btn btn-brand btn-lg btn-block" href="#/inscription">
              Commencer un dossier
            </a>
            <a className="btn btn-ghost btn-lg btn-block" href="#/connexion">
              Se connecter
            </a>
          </div>
        </div>
      </nav>

      {/* ------------------------------------------------------------ hero */}
      <header className="hero">
        <div className="wrap hero-in">
          <div className="hero-text">
            <p className="pill" data-reveal>
              <span className="pill-tag">Nouveau</span> Pour les PME qui répondent aux appels d'offres
            </p>
            <h1 data-reveal>
              Ne repartez plus de <span className="hl">zéro</span> à chaque appel d'offres.
            </h1>
            <p className="hero-lede" data-reveal>
              Déposez le <Term k="dao">dossier d'appel d'offres</Term>. MemoPli relève tout ce que
              demande l'<Term k="acheteur">acheteur</Term>, page par page, vérifie que vos documents sont
              à jour et rédige la méthodologie de votre <Term k="memoire">mémoire technique</Term> avec
              vos chantiers réels. Vous relisez, vous signez.
            </p>
            <div className="hero-actions" data-reveal>
              <a className="btn btn-brand btn-lg" href="#/inscription">
                Commencer un dossier <span className="arrow" aria-hidden="true">→</span>
              </a>
              <a className="btn btn-ghost btn-lg" href="#parcours" onClick={go("parcours")}>
                Comment ça marche
              </a>
            </div>
            <ul className="hero-ticks" data-reveal>
              <li>Chaque exigence avec sa page</li>
              <li>Aucun document expiré ne passe</li>
              <li>Rien à installer</li>
            </ul>
          </div>

          <div className="hero-art" data-reveal>
            <HeroDemo />
            <div className="hero-pli" aria-hidden="true">
              <Mascot size={168} />
            </div>
          </div>
        </div>
      </header>

      {/* --------------------------------------------------------- problème */}
      <section className="sec" id="probleme">
        <div className="wrap">
          <SectionHead
            kicker="Le problème"
            wide
            title={
              <>
                <span className="line">Vérifier une liste prend dix minutes.</span>
                <span className="line muted">Écrire le mémoire prend dix jours.</span>
              </>
            }
          >
            Le plus dur n'est pas de cocher les documents. C'est d'écrire, pour chaque appel d'offres,
            un <Term k="memoire">mémoire technique</Term> solide qui suit les critères de l'acheteur.
          </SectionHead>

          <ul className="pains">
            {PAINS.map((p, i) => (
              <li key={p.title} data-reveal style={{ "--d": i }}>
                <strong>{p.title}</strong>
                <p>{p.text}</p>
              </li>
            ))}
          </ul>

          <div className="market" data-reveal>
            <p className="market-title">Un marché qui s'ouvre aux PME — à condition d'avoir un dossier irréprochable.</p>
            <ul className="figs">
              {FIGURES.map((f) => (
                <li className="fig" key={f.text}>
                  <CountUp to={f.to} decimals={f.decimals} prefix={f.prefix} suffix={f.suffix} />
                  <span>{f.text}</span>
                  <small>{f.src}</small>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- pour qui */}
      <section className="sec sec-tint" id="pour-qui">
        <div className="wrap persona">
          <div data-reveal>
            <p className="kicker">Pour qui</p>
            <h2>Pour celle ou celui qui monte les dossiers, souvent seul.</h2>
            <p className="lede">
              Responsable administratif, assistante de direction, dirigeant de PME : deux à quatre
              candidatures par mois, Word et Excel pour seuls outils, et pas de temps à perdre sur un
              dossier perdu d'avance.
            </p>
          </div>

          <ol className="jobs">
            {JOBS.map((j, i) => (
              <li key={j.when} data-reveal style={{ "--d": i }}>
                <span className="jobs-n">{String(i + 1).padStart(2, "0")}</span>
                <p>
                  <b>{j.when}</b> {j.want}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* -------------------------------------------------------- parcours */}
      <section className="sec" id="parcours">
        <div className="wrap">
          <SectionHead kicker="Comment ça marche" title="Cinq étapes, dans l'ordre. Rien de plus.">
            Pas de tableau de bord à apprendre : chaque étape s'ouvre quand la précédente est faite.
          </SectionHead>
          <div data-reveal>
            <Journey />
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- verdict */}
      <section className="sec sec-brand" id="verdict">
        <div className="wrap verdict-in">
          <div className="verdict-text" data-reveal>
            <p className="kicker">Avant de déposer</p>
            <h2>Le bouton reste gris tant qu'un document manque.</h2>
            <p className="lede">
              Un document expiré compte comme un document manquant. « Prêt à déposer » ne s'active que
              lorsque tous les documents demandés sont valides. Essayez.
            </p>
          </div>
          <div data-reveal>
            <VerdictToggle />
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- garanties */}
      <section className="sec" id="garanties">
        <div className="wrap">
          <SectionHead kicker="Nos garanties" title="Un outil qui ne vous fait courir aucun risque.">
            Un dossier d'appel d'offres engage votre entreprise. MemoPli ne remplit jamais un vide à
            votre place.
          </SectionHead>

          <ul className="promises">
            {PROMISES.map((p, i) => (
              <li key={p.title} data-reveal style={{ "--d": i }}>
                <span className="promise-ico">
                  <PromiseIcon kind={p.icon} />
                </span>
                <strong>{p.title}</strong>
                <p>{p.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ------------------------------------------------------ comparatif */}
      <section className="sec sec-tint" id="comparatif">
        <div className="wrap cmp-in">
          <SectionHead kicker="Pourquoi MemoPli" title="Ce que vos outils actuels ne font pas.">
            Chaque solution d'aujourd'hui laisse un trou dans le dossier.
          </SectionHead>

          <div className="cmp" data-reveal>
            {RIVALS.map((r) => (
              <div className="cmp-row" key={r.name}>
                <strong>{r.name}</strong>
                <span>{r.limit}</span>
              </div>
            ))}
          </div>

          <ul className="edge">
            {EDGE.map((e, i) => (
              <li key={e.title} data-reveal style={{ "--d": i }}>
                <span className="edge-n">{String(i + 1).padStart(2, "0")}</span>
                <strong>{e.title}</strong>
                <p>{e.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ----------------------------------------------------------- tarif */}
      <section className="sec" id="tarif">
        <div className="wrap">
          <SectionHead kicker="Tarif" title="Vous payez un dossier. Pas un logiciel." center>
            Pas d'abonnement obligatoire, rien à installer : le prix suit le dossier que vous préparez.
          </SectionHead>

          <div className="price" data-reveal>
            <div className="price-card price-main">
              <p className="price-name">Par dossier</p>
              <p className="price-amount">
                25 000 – 50 000 <small>FCFA</small>
              </p>
              <p className="price-sub">Selon la taille du mémoire.</p>
              <ul className="price-list">
                <li>Tout ce que demande l'acheteur, page par page</li>
                <li>Le contrôle de vos documents et le verdict « Prêt / Pas prêt »</li>
                <li>La méthodologie rédigée avec vos chantiers</li>
                <li>Un accompagnement sur votre premier dossier</li>
                <li>Une assistance sur WhatsApp</li>
              </ul>
              <a className="btn btn-brand btn-lg btn-block" href="#/inscription">
                Commencer un dossier
              </a>
            </div>
            <div className="price-card">
              <p className="price-name">Abonnement</p>
              <p className="price-amount price-amount-sm">3 dossiers / mois</p>
              <p className="price-sub">Pour les entreprises qui répondent chaque semaine. Tarif sur demande.</p>
              <ul className="price-list">
                <li>Tout ce que comprend l'offre par dossier</li>
                <li>Vos documents suivis en continu</li>
              </ul>
              <a className="btn btn-ghost btn-lg btn-block" href={`mailto:${CONTACT_EMAIL}?subject=Abonnement%20MemoPli`}>
                Nous contacter
              </a>
            </div>
          </div>
          <p className="price-foot" data-reveal>
            À titre de comparaison, un cabinet qui monte le dossier pour vous facture 300 000 à 500 000 FCFA.
          </p>
        </div>
      </section>

      {/* ---------------------------------------------------------- lexique */}
      <section className="sec" id="lexique">
        <div className="wrap lex-in">
          <SectionHead kicker="Même chose, autres noms" title="Chacun ses mots. Le dossier reste le même.">
            D'un pays ou d'un organisme à l'autre, les mêmes documents changent de nom. Voici les
            équivalences les plus courantes — et les mots que nous employons sur cette page.
          </SectionHead>
          <dl className="lex" data-reveal>
            {EQUIV.map((e) => (
              <div className="lex-row" key={e.ours}>
                <dt>{e.ours}</dt>
                <dd>
                  {e.also.map((a) => (
                    <span key={a}>{a}</span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* -------------------------------------------------------------- faq */}
      <section className="sec sec-tint" id="faq">
        <div className="wrap faq-in">
          <SectionHead kicker="Questions" title="Ce qu'on nous demande le plus.">
            Une autre question ?{" "}
            <a className="link" href={`mailto:${CONTACT_EMAIL}`}>
              Écrivez-nous
            </a>
            .
          </SectionHead>
          <div className="faq" data-reveal>
            {FAQ.map((f, i) => (
              <details key={f.q} open={i === 0}>
                <summary>
                  {f.q}
                  <span className="faq-ico" aria-hidden="true" />
                </summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- CTA final */}
      <section className="cta">
        <div className="wrap cta-in" data-reveal>
          <div className="cta-pli" aria-hidden="true">
            <Mascot size={200} />
          </div>
          <div>
            <h2>Votre prochain appel d'offres, sans repartir de zéro.</h2>
            <p>Déposez le dossier, voyez ce qui est demandé, sachez si vous êtes prêt — avant d'y passer trois jours.</p>
            <div className="cta-actions">
              <a className="btn btn-light btn-lg" href="#/inscription">
                Commencer un dossier <span className="arrow" aria-hidden="true">→</span>
              </a>
              <a className="btn btn-outline-light btn-lg" href={`mailto:${CONTACT_EMAIL}?subject=D%C3%A9monstration%20MemoPli`}>
                Demander une démonstration
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- pied */}
      <footer className="foot">
        <div className="wrap">
          <div className="foot-top">
            <div className="foot-brand">
              <a className="nav-brand" href="#/" aria-label="MemoPli, accueil">
                <Mark size={30} />
                <Wordmark />
              </a>
              <p>Le poste de travail des appels d'offres pour les PME du Bénin.</p>
            </div>

            <nav className="foot-col" aria-label="Produit">
              <p className="foot-h">Produit</p>
              <a href="#parcours" onClick={go("parcours")}>Comment ça marche</a>
              <a href="#garanties" onClick={go("garanties")}>Garanties</a>
              <a href="#tarif" onClick={go("tarif")}>Tarif</a>
              <a href="#faq" onClick={go("faq")}>Questions fréquentes</a>
            </nav>

            <nav className="foot-col" aria-label="Commencer">
              <p className="foot-h">Commencer</p>
              <a href="#/inscription">Créer un compte</a>
              <a href="#/connexion">Se connecter</a>
              <a href={`mailto:${CONTACT_EMAIL}?subject=D%C3%A9monstration%20MemoPli`}>Demander une démonstration</a>
              <a href={`mailto:${CONTACT_EMAIL}?subject=Abonnement%20MemoPli`}>Offre abonnement</a>
            </nav>

            <div className="foot-col">
              <p className="foot-h">Contact</p>
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
              <span>Cotonou, Bénin</span>
              <span>Assistance sur WhatsApp pour nos clients</span>
            </div>
          </div>

          <div className="foot-bottom">
            <span>© {year} MemoPli. Tous droits réservés.</span>
            <span className="foot-src">
              Chiffres : ADPME Bénin ; Autorité de régulation des marchés publics (ARMP), novembre 2026.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
