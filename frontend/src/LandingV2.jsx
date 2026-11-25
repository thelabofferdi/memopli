import React, { useCallback, useEffect, useState } from "react";
import Halftone from "./components/Halftone.jsx";
import { Mark, Wordmark } from "./components/Logo.jsx";
import Mascot from "./components/Mascot.jsx";
import { AppChip, Icon, PliSays } from "./components/Brand.jsx";
import { CONTACT_EMAIL, CountUp, EQUIV, Term, VerdictToggle, useReveal } from "./Landing.jsx";

// Landing v2 — la structure de « mesa » (LN, licence MIT) fondue dans
// l'identité MemoPli : crème et encre, outremer pour l'action, ombres
// décalées, Bricolage Grotesque 800, Pli à chaque étape. Vert / rouge / ambre
// ne servent qu'aux statuts. Aucun témoignage inventé.

const STEPS = [
  {
    id: "entreprise",
    icon: "building",
    tint: "#2b3ae0",
    title: "Votre entreprise",
    sub: "une fois pour toutes",
    head: ["Votre entreprise", "saisie une seule fois."],
    tip: "Saisissez-la une fois : je la reprends dans chacun de vos dossiers.",
    mood: "happy",
  },
  {
    id: "documents",
    icon: "files",
    tint: "#4338ca",
    title: "Vos documents",
    sub: "chaque date surveillée",
    head: ["Vos documents", "toujours à jour."],
    tip: "Sans date de fin de validité, je marque un document « à vérifier » — jamais « valide ».",
    mood: "think",
  },
  {
    id: "dossier",
    icon: "upload",
    tint: "#6d28d9",
    title: "L'appel d'offres",
    sub: "lu page par page",
    head: ["L'appel d'offres", "lu page par page."],
    tip: "Je lis tout le PDF, page par page. C'est ce qui me permet de citer mes sources.",
    mood: "think",
  },
  {
    id: "exigences",
    icon: "list",
    tint: "#0e6fa8",
    title: "Les exigences",
    sub: "chacune avec sa page",
    head: ["Les exigences", "chacune avec sa page."],
    tip: "Une ligne vous semble fausse ? Corrigez-la : votre correction compte plus que ma lecture.",
    mood: "happy",
  },
  {
    id: "redaction",
    icon: "pen",
    tint: "#0b1020",
    title: "Le verdict et le mémoire",
    sub: "prêt à relire",
    head: ["Le mémoire", "écrit avec vos chantiers."],
    tip: "Je n'écris qu'avec vos chantiers. Ce qui manque, je le marque « à compléter ».",
    mood: "happy",
  },
];

const DOTS = {
  blue: ["#eceeff", "#c9cfff", "#a9b2ff", "#6270f0", "#2b3ae0"],
  violet: ["#efeaff", "#d6c8ff", "#b49cff", "#7c5cf0", "#4338ca"],
  sky: ["#e7f3fb", "#c2e1f4", "#8cc4e8", "#3d93cc", "#0e6fa8"],
  ink: ["#e9e8ef", "#cfcedb", "#a3a2b6", "#5d5d78", "#0b1020"],
  night: ["#111633", "#1a2160", "#232f9c", "#2b3ae0", "#a9b2ff"],
  cream: ["#efece4", "#e2ddd0", "#cbc4b2", "#a9a08b", "#7f7765"],
};

const TIMELINE = [
  { step: "Étape 1", tint: "blue", title: "Le dossier est lu", text: "Le PDF de l'acheteur est lu en entier, page par page.", big: "84", small: "pages lues" },
  { step: "Étape 2", tint: "violet", title: "Les exigences sortent", text: "Documents demandés et critères de notation, avec leur page.", big: "12", small: "exigences relevées" },
  { step: "Étape 3", tint: "sky", title: "Vos documents sont vérifiés", text: "Chaque attestation est comparée à sa date de fin de validité.", chips: ["fiscale", "CNSS", "RCCM", "bilan", "réf."] },
  { step: "Étape 4", tint: "ink", title: "Le verdict tombe", text: "Un document expiré ? Le dépôt est bloqué, avant que l'acheteur ne le voie.", verdict: true },
  { step: "Étape 5", tint: "violet", title: "La méthodologie s'écrit", text: "Avec vos chantiers réels. Ce qui manque est marqué « à compléter ».", draft: true },
  { step: "À tout moment", tint: "blue", title: "Pli répond", text: "Une question sur le dossier ? Pli répond et cite la page.", pli: true },
];

const FIGURES = [
  { to: 800, prefix: "≈ ", suffix: " Md", text: "de FCFA d'achats publics chaque année au Bénin.", src: "ADPME Bénin" },
  { to: 20, suffix: " %", text: "de ces achats réservés aux PME. L'objectif : 30 à 35 %.", src: "ARMP, novembre 2026" },
  { to: 85, suffix: " %", text: "des contestations rejetées, faute de dossiers solides.", src: "ARMP, novembre 2026" },
];

const SITUATIONS = [
  {
    who: "Quand un appel d'offres paraît",
    short: "Un appel d'offres paraît",
    text: "Vous voyez tout de suite ce qu'il demande, et si votre dossier tient la route — avant d'y passer trois jours.",
    mood: "think",
  },
  {
    who: "Quand vous décidez de répondre",
    short: "Vous décidez de répondre",
    text: "Votre mémoire technique suit déjà les critères de l'acheteur. Vous ne repartez plus d'une page blanche.",
    mood: "happy",
  },
  {
    who: "Avant de déposer",
    short: "Avant de déposer",
    text: "Vous savez qu'aucun document ne manque et qu'aucune date n'est dépassée. Pas d'élimination pour une broutille.",
    mood: "happy",
  },
];

const PROMISES = [
  { n: "01", tag: "Exigences", tint: "#2b3ae0", icon: "list", title: "Chaque exigence avec sa page", text: "Vous vérifiez d'un coup d'œil dans le document d'origine. Rien n'est affirmé sans preuve." },
  { n: "02", tag: "Rédaction", tint: "#6d28d9", icon: "pen", title: "Rien d'inventé", text: "Si le dossier ne dit rien, MemoPli l'indique. S'il manque une information, il écrit « à compléter »." },
  { n: "03", tag: "Confidentialité", tint: "#0e6fa8", icon: "lock", title: "Vos documents restent les vôtres", text: "Vos attestations, bilans et références ne sont jamais transmis à un service extérieur." },
  { n: "04", tag: "Dépôt", tint: "#0b1020", icon: "shield", title: "Un document expiré bloque le dépôt", text: "Il compte comme un document manquant. Vous le savez avant l'acheteur, pas après." },
];

const FAQ = [
  { q: "Mes documents sont-ils en sécurité ?", a: "Vos documents restent dans votre espace MemoPli. Pour savoir quel document répond à quelle demande, seuls son nom, son type et sa date sont utilisés — jamais le document lui-même." },
  { q: "Et si MemoPli lit mal une exigence ?", a: "Chaque exigence indique la page du dossier d'où elle vient : vous vérifiez et vous corrigez. C'est votre correction qui compte. Si le dossier ne précise rien, MemoPli écrit « non extrait » au lieu de deviner." },
  { q: "Le texte rédigé est-il prêt à signer ?", a: "C'est une base de travail, à relire et à adapter. Elle s'appuie uniquement sur vos références ; il faut au moins deux références de chantiers dans vos documents." },
  { q: "Mon dossier d'appel d'offres est scanné.", a: "MemoPli lit les PDF dont on peut sélectionner le texte. Si le fichier n'est qu'une image, l'écran vous le dit plutôt que de vous donner une liste incomplète." },
  { q: "Faut-il installer quelque chose ?", a: "Non. MemoPli s'utilise dans le navigateur, sur ordinateur comme sur tablette." },
];

const NAV = [
  ["parcours", "Le parcours"],
  ["dossier", "Un dossier"],
  ["verdict", "Avant de déposer"],
  ["tarif", "Tarif"],
  ["questions", "Questions"],
];

/** Pastille d'une étape du parcours. */
function StepChip({ step, size = 28 }) {
  return <AppChip tint={step.tint} icon={step.icon} size={size} />;
}

// ------------------------------------------------------- maquette du hero

const BOARD = [
  { code: "p. 12", label: "Attestation fiscale", status: "valide" },
  { code: "p. 12", label: "Attestation CNSS", status: "expire" },
  { code: "p. 13", label: "Registre du commerce", status: "valide" },
  { code: "p. 3", label: "Garantie de soumission · 2 %", status: "manquant" },
  { code: "p. 15", label: "Trois références", status: "valide" },
  { code: "p. 16", label: "Bilans 2024–2025", status: "valide" },
  { code: "p. 7", label: "Méthodologie · 40 %", status: "critere" },
  { code: "p. 7", label: "Prix · 35 %", status: "critere" },
  { code: "p. 8", label: "Moyens humains · 15 %", status: "critere" },
  { code: "—", label: "Délai d'exécution", status: "non" },
];

const STATUS = { valide: "valide", expire: "expiré", manquant: "manquant", critere: "critère", non: "non extrait" };

function Board() {
  const [live, setLive] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const id = setInterval(() => setLive((n) => (n + 1) % BOARD.length), 1400);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="v2-board" role="img" aria-label="Exemple : les exigences d'un appel d'offres, chacune avec sa page et son statut">
      <div className="v2-board-head">
        <div>
          <strong>Voirie urbaine · Akpakpa</strong>
          <small>Exemple de dossier · Mairie de Cotonou</small>
        </div>
        <div className="v2-board-kpis">
          <span>
            <b>10</b> exigences
          </span>
          <span>
            <b>2</b> blocages
          </span>
          <span className="v2-live">exemple</span>
        </div>
      </div>
      <ul className="v2-board-grid">
        {BOARD.map((r, i) => (
          <li key={r.label} className={`v2-tile s-${r.status}${i === live ? " pulse" : ""}`}>
            <span className="v2-mono">{r.code}</span>
            <strong>{r.label}</strong>
            <em>{STATUS[r.status]}</em>
          </li>
        ))}
      </ul>
    </div>
  );
}

// -------------------------------------------------- démo du parcours (menu)

function StepView({ id }) {
  if (id === "entreprise")
    return (
      <div className="v2-view v2-form">
        {[
          ["Nom de l'entreprise", "Entreprise Adjovi BTP"],
          ["Numéro fiscal (IFU)", "3202400001234"],
          ["Registre du commerce", "RB/COT/24 B 1204"],
          ["Secteur", "Bâtiment, travaux publics"],
        ].map(([k, v]) => (
          <div key={k}>
            <small>{k}</small>
            <span>{v}</span>
          </div>
        ))}
      </div>
    );
  if (id === "documents")
    return (
      <ul className="v2-view v2-rows">
        {[
          ["Attestation fiscale 2026", "valable jusqu'au 31 mars 2027", "valide"],
          ["Attestation CNSS", "expirée depuis le 30 septembre", "expire"],
          ["Extrait RCCM", "aucune date de fin", "verif"],
          ["Bilan 2025", "valable jusqu'au 30 juin 2027", "valide"],
        ].map(([t, s, st]) => (
          <li key={t}>
            <span className={`v2-dot d-${st}`} />
            <div>
              <strong>{t}</strong>
              <small>{s}</small>
            </div>
            <em className={`v2-badge b-${st}`}>{st === "valide" ? "valide" : st === "expire" ? "expiré" : "à vérifier"}</em>
          </li>
        ))}
      </ul>
    );
  if (id === "dossier")
    return (
      <div className="v2-view v2-upload">
        <div className="v2-drop">
          <Icon name="upload" size={22} />
          <strong>Appel-offres-voirie.pdf</strong>
          <small>84 pages · lecture en cours</small>
        </div>
        <div className="v2-pages" aria-hidden="true">
          {Array.from({ length: 36 }, (_, k) => (
            <i key={k} style={{ "--k": k }} />
          ))}
        </div>
      </div>
    );
  if (id === "exigences")
    return (
      <ul className="v2-view v2-rows">
        {[
          ["p. 12", "Attestation fiscale de moins de trois mois", "document"],
          ["p. 3", "Garantie de soumission de 2 %", "document"],
          ["p. 7", "Note méthodologique", "40 %"],
          ["—", "Délai d'exécution", "non extrait"],
        ].map(([p, t, tag]) => (
          <li key={t}>
            <span className={p === "—" ? "v2-page warn" : "v2-page"}>{p}</span>
            <div>
              <strong>{t}</strong>
            </div>
            <em className={tag === "non extrait" ? "v2-badge b-verif" : "v2-badge b-brand"}>{tag}</em>
          </li>
        ))}
      </ul>
    );
  return (
    <div className="v2-view v2-final">
      <div className="v2-verdict ok">
        <strong>Prêt à déposer</strong>
        <small>aucun document manquant ni expiré</small>
      </div>
      <div className="v2-paper">
        <b>Méthodologie et organisation</b>
        <span />
        <span />
        <span className="short" />
        <span />
        <i>à relire avant signature</i>
      </div>
    </div>
  );
}

function Journey() {
  const [active, setActive] = useState(0);
  const step = STEPS[active];
  return (
    <>
      <div className="v2-wrap v2-sec-head v2-split" data-reveal>
        <div>
          <p className="v2-kicker">Le parcours · cinq étapes</p>
          <h2 className="v2-journey-title" key={step.id}>
            <StepChip step={step} size={44} /> {step.head[0]} <span className="v2-fade">{step.head[1]}</span>
          </h2>
        </div>
        <p className="v2-aside">Choisissez une étape. Chacune s'ouvre quand la précédente est faite.</p>
      </div>
      <div className="v2-band">
        <Halftone colors={DOTS.blue} cell={6} dot="round" shape="field" bias={-0.12} speed={0.6} className="v2-band-dots" />
        <div className="v2-wrap">
          <div className="v2-app" data-reveal>
            <ol className="v2-app-menu">
              {STEPS.map((s, i) => (
                <li key={s.id}>
                  <button type="button" className={i === active ? "on" : ""} onClick={() => setActive(i)} aria-pressed={i === active}>
                    <StepChip step={s} />
                    <span>
                      <strong>{s.title}</strong>
                      <small>{s.sub}</small>
                    </span>
                    <em className="v2-mono">{String(i + 1).padStart(2, "0")}</em>
                  </button>
                </li>
              ))}
            </ol>
            <div className="v2-app-main">
              <div className="v2-app-bar">
                <span className="on">{step.title}</span>
                <span>Étape {active + 1} sur 5</span>
              </div>
              <div className="v2-app-body" key={step.id}>
                <StepView id={step.id} />
                <PliSays mood={step.mood}>{step.tip}</PliSays>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ------------------------------------------------------------ frise

function TimelineVisual({ item }) {
  return (
    <div className="v2-tl-visual">
      <Halftone colors={DOTS[item.tint]} cell={5} dot="round" shape="edges" seed={item.title.length} speed={0.5} className="v2-tl-dots" />
      <span className="v2-time v2-mono">{item.step}</span>
      {item.big && (
        <div className="v2-tl-card">
          <b>{item.big}</b>
          <small>{item.small}</small>
        </div>
      )}
      {item.chips && (
        <div className="v2-tl-avatars">
          {item.chips.map((c, i) => (
            <span key={c} className={i === 1 ? "bad" : ""}>
              {c}
            </span>
          ))}
        </div>
      )}
      {item.verdict && (
        <div className="v2-tl-verdict">
          <span className="ko">Pas prêt</span>
          <Icon name="arrow" size={14} />
          <span className="ok">Prêt</span>
        </div>
      )}
      {item.draft && (
        <div className="v2-tl-draft">
          <span />
          <span />
          <span className="short" />
          <i>à compléter</i>
        </div>
      )}
      {item.pli && (
        <>
          <span className="v2-tl-mascot">
            <Mascot size={92} animated={false} />
          </span>
          <div className="v2-tl-pli">
            « 25 000 000 FCFA <span className="v2-cite">p. 3</span> »
          </div>
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------- page

export default function LandingV2() {
  const [situation, setSituation] = useState(0);
  const [scrolled, setScrolled] = useState(false);
  const [menu, setMenu] = useState(false);
  const [current, setCurrent] = useState("");
  const [ready, setReady] = useState(false);
  const onVerdict = useCallback((r) => setReady(r), []);
  useReveal();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
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

  const go = (id) => (e) => {
    e.preventDefault();
    setMenu(false);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(id)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <div className="v2">
      <nav className={["v2-nav", scrolled && "scrolled", menu && "open"].filter(Boolean).join(" ")}>
        <div className="v2-nav-pill">
          <a className="v2-brand" href="#/" aria-label="MemoPli">
            <Mark size={28} />
            <Wordmark />
          </a>
          {NAV.map(([id, label]) => (
            <a key={id} href={`#${id}`} onClick={go(id)} className={current === id ? "v2-nav-link on" : "v2-nav-link"}>
              {label}
            </a>
          ))}
        </div>
        <div className="v2-nav-right">
          <a href="#/connexion" className="v2-nav-link v2-nav-login">
            Se connecter
          </a>
          <a href="#/inscription" className="v2-btn v2-btn-brand">
            Commencer
          </a>
          <button type="button" className="v2-burger" aria-label={menu ? "Fermer le menu" : "Ouvrir le menu"} aria-expanded={menu} onClick={() => setMenu((m) => !m)}>
            <Icon name={menu ? "close" : "menu"} size={20} />
          </button>
        </div>
        {menu && (
          <div className="v2-menu">
            {NAV.map(([id, label]) => (
              <a key={id} href={`#${id}`} onClick={go(id)}>
                {label} <Icon name="arrow" size={16} />
              </a>
            ))}
            <a href="#/connexion">
              Se connecter <Icon name="arrow" size={16} />
            </a>
            <a href="#/inscription" className="v2-btn v2-btn-brand v2-btn-block">
              Commencer un dossier
            </a>
          </div>
        )}
      </nav>

      {/* ----------------------------------------------------------- hero */}
      <header className="v2-hero">
        <Halftone colors={DOTS.night} cell={5} shape="right" bias={0.08} speed={0.8} className="v2-hero-dots" />
        <div className="v2-hero-in">
          <p className="v2-badge-pill" data-reveal>
            <span className="v2-spark" /> Nouveau <span className="v2-sep">Pour les PME qui répondent aux appels d'offres</span>
          </p>
          <h1 data-reveal>
            Ne repartez plus de <span className="hl v2-hl">zéro</span> <span className="v2-grad">à chaque appel d'offres.</span>
          </h1>
          <p className="v2-lede" data-reveal>
            MemoPli lit le <Term k="dao">dossier d'appel d'offres</Term>, relève tout ce que demande l'
            <Term k="acheteur">acheteur</Term> avec sa page, vérifie vos documents et rédige la méthodologie de
            votre <Term k="memoire">mémoire technique</Term> avec vos chantiers. Vous relisez, vous signez.
          </p>
          <div className="v2-hero-cta" data-reveal>
            <a href="#/inscription" className="v2-btn v2-btn-brand v2-btn-lg">
              Commencer un dossier <Icon name="arrow" size={16} />
            </a>
            <div className="v2-proof">
              <small>À partir de</small>
              <b>25 000 FCFA</b>
              <span>par dossier · rien à installer</span>
            </div>
          </div>
          <div className="v2-chips" data-reveal>
            {STEPS.map((s) => (
              <StepChip key={s.id} step={s} size={30} />
            ))}
            <span className="v2-chips-label">cinq étapes, un seul parcours</span>
          </div>
        </div>
        <div className="v2-hero-board" data-reveal>
          <span className="v2-hero-pli" aria-hidden="true">
            <Mascot size={150} />
          </span>
          <Board />
        </div>
      </header>

      <main className="v2-main">
        {/* ------------------------------------------------------ parcours */}
        <section id="parcours" className="v2-sec v2-sec-flush">
          <Journey />
        </section>

        {/* -------------------------------------------------------- frise */}
        <section id="dossier" className="v2-sec">
          <div className="v2-wrap v2-sec-head v2-split" data-reveal>
            <div>
              <p className="v2-kicker">Un dossier, de bout en bout</p>
              <h2>Un dossier avec MemoPli.</h2>
              <p className="v2-sub">Du PDF de l'acheteur au mémoire à relire. Voici qui fait quoi, étape par étape.</p>
            </div>
            <span className="v2-pill-mono v2-mono">dépôt → mémoire</span>
          </div>
          <ul className="v2-wrap v2-tl">
            {TIMELINE.map((t, i) => (
              <li key={t.title} data-reveal style={{ "--d": i % 3 }}>
                <TimelineVisual item={t} />
                <h3>{t.title}</h3>
                <p>{t.text}</p>
              </li>
            ))}
          </ul>
          <ul className="v2-wrap v2-stats">
            {FIGURES.map((f, i) => (
              <li key={f.src + f.to} data-reveal style={{ "--d": i }}>
                <Halftone colors={DOTS.cream} cell={5} dot="round" shape="right" seed={i + 3} speed={0.4} className="v2-stat-dots" />
                <CountUp to={f.to} prefix={f.prefix} suffix={f.suffix} />
                <span>{f.text}</span>
                <small>{f.src}</small>
              </li>
            ))}
          </ul>
        </section>

        {/* ------------------------------------------------------ pour qui */}
        <section className="v2-sec" id="pour-qui">
          <div className="v2-wrap v2-sec-head" data-reveal>
            <p className="v2-kicker">Pour qui</p>
            <h2>Pour celles et ceux qui montent les dossiers.</h2>
            <p className="v2-sub">Responsables administratifs, assistantes de direction, dirigeants de PME : souvent seuls, toujours pressés.</p>
          </div>
          <div className="v2-wrap v2-who">
            <div className="v2-who-art">
              <Halftone colors={DOTS.violet} cell={6} shape="field" seed={situation + 2} speed={0.6} className="v2-who-dots" />
              <span className="v2-who-mascot">
                <Mascot size={150} mood={SITUATIONS[situation].mood} />
              </span>
            </div>
            <div className="v2-who-text">
              <p className="v2-kicker">Situation {situation + 1} sur 3</p>
              <p className="v2-quote" key={situation}>
                {SITUATIONS[situation].text}
              </p>
              <p className="v2-quote-by">
                <StepChip step={STEPS[situation + 2]} size={22} /> {SITUATIONS[situation].who}
              </p>
              <div className="v2-who-tabs" role="tablist">
                {SITUATIONS.map((s, i) => (
                  <button
                    key={s.who}
                    type="button"
                    role="tab"
                    aria-selected={i === situation}
                    className={i === situation ? "on" : ""}
                    onClick={() => setSituation(i)}
                  >
                    <strong>{s.short}</strong>
                    <small>situation {i + 1}</small>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ verdict (v1) */}
        <section id="verdict" className="v2-brandband">
          <Halftone colors={DOTS.night} cell={6} dot="round" shape="left" speed={0.5} className="v2-brandband-dots" />
          <div className="v2-wrap v2-verdict-in">
            <div data-reveal>
              <p className="v2-kicker v2-kicker-light">Avant de déposer</p>
              <h2>Le bouton reste gris tant qu'un document manque.</h2>
              <p className="v2-sub">
                Un document expiré compte comme un document manquant. « Prêt à déposer » ne s'active que
                lorsque tous les documents demandés sont valides. Essayez.
              </p>
              <PliSays mood={ready ? "happy" : "worried"} dark>
                {ready ? "Tout est en règle. Vous pouvez déposer sereinement." : "L'attestation CNSS a expiré : je bloque le dépôt tant qu'elle n'est pas remplacée."}
              </PliSays>
            </div>
            <div data-reveal>
              <VerdictToggle onChange={onVerdict} />
            </div>
          </div>
        </section>

        {/* ----------------------------------------------------- garanties */}
        <section id="garanties" className="v2-sec">
          <div className="v2-wrap v2-sec-head v2-split" data-reveal>
            <div>
              <p className="v2-kicker">Nos garanties</p>
              <h2>Ce que MemoPli ne fera jamais.</h2>
              <p className="v2-sub">Un dossier d'appel d'offres engage votre entreprise. MemoPli ne remplit jamais un vide à votre place.</p>
            </div>
            <a href="#/inscription" className="v2-link">
              Essayer <Icon name="arrow" size={14} />
            </a>
          </div>
          <ul className="v2-wrap v2-cards">
            {PROMISES.map((p, i) => (
              <li key={p.n} style={{ "--tint": p.tint, "--d": i % 2 }} data-reveal>
                <div className="v2-card-head v2-mono">
                  <span>#{p.n}</span>
                  <span>garantie</span>
                </div>
                <p className="v2-card-tag">
                  <span className="v2-chip v2-chip-sm" style={{ "--tint": p.tint }}>
                    <Icon name={p.icon} size={11} />
                  </span>
                  {p.tag}
                </p>
                <h3>{p.title}</h3>
                <p>{p.text}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ------------------------------------------------------- lexique */}
        <section id="lexique" className="v2-sec">
          <div className="v2-wrap v2-lex">
            <div data-reveal>
              <p className="v2-kicker">Même chose, autres noms</p>
              <h2>Chacun ses mots. Le dossier reste le même.</h2>
              <p className="v2-sub">D'un pays ou d'un organisme à l'autre, les mêmes documents changent de nom. Voici les équivalences les plus courantes.</p>
              <PliSays mood="think">Nommez vos documents avec vos propres mots : vous vérifiez chaque rapprochement que je propose.</PliSays>
            </div>
            <dl className="v2-lex-table" data-reveal>
              {EQUIV.map((e) => (
                <div key={e.ours}>
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

        {/* --------------------------------------------------------- tarif */}
        <section id="tarif" className="v2-sec">
          <div className="v2-wrap v2-sec-head v2-center" data-reveal>
            <p className="v2-kicker">Tarif</p>
            <h2>Vous payez un dossier. Pas un logiciel.</h2>
            <p className="v2-sub">Pas d'abonnement obligatoire, rien à installer : le prix suit le dossier que vous préparez.</p>
          </div>
          <div className="v2-wrap v2-price">
            <div className="v2-price-card main" data-reveal>
              <p className="v2-price-name">Par dossier</p>
              <p className="v2-price-amount">
                25 000 – 50 000 <small>FCFA</small>
              </p>
              <p className="v2-price-sub">Selon la taille du mémoire.</p>
              <ul>
                <li>Tout ce que demande l'acheteur, page par page</li>
                <li>Le contrôle de vos documents et le verdict</li>
                <li>La méthodologie rédigée avec vos chantiers</li>
                <li>Pli pour répondre à vos questions</li>
                <li>Un accompagnement sur votre premier dossier</li>
              </ul>
              <a href="#/inscription" className="v2-btn v2-btn-brand v2-btn-block">
                Commencer un dossier
              </a>
            </div>
            <div className="v2-price-card" data-reveal style={{ "--d": 1 }}>
              <p className="v2-price-name">Abonnement</p>
              <p className="v2-price-amount sm">3 dossiers / mois</p>
              <p className="v2-price-sub">Pour les entreprises qui répondent chaque semaine. Tarif sur demande.</p>
              <ul>
                <li>Tout ce que comprend l'offre par dossier</li>
                <li>Vos documents suivis en continu</li>
              </ul>
              <a href={`mailto:${CONTACT_EMAIL}?subject=Abonnement%20MemoPli`} className="v2-btn v2-btn-ghost v2-btn-block">
                Nous contacter
              </a>
            </div>
          </div>
          <p className="v2-price-foot" data-reveal>
            À titre de comparaison, un cabinet qui monte le dossier pour vous facture 300 000 à 500 000 FCFA.
          </p>
        </section>

        {/* ------------------------------------------------- accompagnement */}
        <section className="v2-dark">
          <div className="v2-wrap v2-dark-in">
            <div data-reveal>
              <p className="v2-kicker v2-kicker-light">Accompagnement</p>
              <h2>On vous accompagne sur le premier dossier.</h2>
              <p className="v2-sub">
                Le premier dépôt est celui qui compte. Nous le préparons avec vous, puis vous êtes
                autonome — avec Pli pour répondre à vos questions.
              </p>
              <ul className="v2-dark-list">
                <li>
                  <span><Icon name="chat" /></span>Une assistance sur WhatsApp
                </li>
                <li>
                  <span><Icon name="shield" /></span>Un accompagnement sur votre premier dossier
                </li>
                <li>
                  <span><Icon name="lock" /></span>Vos documents restent les vôtres
                </li>
              </ul>
              <a href={`mailto:${CONTACT_EMAIL}?subject=D%C3%A9monstration%20MemoPli`} className="v2-btn v2-btn-light">
                Demander une démonstration
              </a>
            </div>
            <div className="v2-chat" data-reveal>
              <Halftone colors={DOTS.night} cell={4} shape="edges" speed={0.6} className="v2-chat-dots" />
              <div className="v2-chat-card">
                <div className="v2-chat-head">
                  <span className="v2-chat-av">
                    <Mascot size={34} animated={false} />
                  </span>
                  <div>
                    <strong>Demander à Pli</strong>
                    <small>
                      <i className="v2-online" /> lit le dossier
                    </small>
                  </div>
                </div>
                <div className="v2-msg me">Quelle garantie de soumission est demandée ?</div>
                <div className="v2-msg pli">
                  2 % du montant estimé <span className="v2-cite">p. 3</span>, soit 25 000 000 FCFA{" "}
                  <span className="v2-cite">p. 3</span>. Dépôt avant le 18 décembre 2026 à 10 h{" "}
                  <span className="v2-cite">p. 1</span>.
                </div>
                <div className="v2-chat-foot">Exemple · aucun de vos documents n'est envoyé</div>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------ FAQ */}
        <section id="questions" className="v2-sec">
          <div className="v2-wrap v2-faq">
            <div data-reveal>
              <p className="v2-kicker">Questions</p>
              <h2>Avant votre prochain dépôt.</h2>
              <PliSays mood="happy">
                Encore un doute ?{" "}
                <a className="v2-underline" href={`mailto:${CONTACT_EMAIL}`}>
                  Écrivez-nous
                </a>
                , ou posez-moi la question dans votre dossier.
              </PliSays>
            </div>
            <div className="v2-acc" data-reveal>
              {FAQ.map((f, i) => (
                <details key={f.q} open={i === 0}>
                  <summary>
                    {f.q}
                    <span aria-hidden="true" />
                  </summary>
                  <p>{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------ CTA final */}
        <section className="v2-sec v2-final-cta">
          <div className="v2-wrap v2-final-in" data-reveal>
            <span className="v2-final-pli" aria-hidden="true">
              <Mascot size={170} />
            </span>
            <h2>
              Le dossier est complet. <span className="v2-grad v2-grad-light">Le dépôt est serein.</span>
            </h2>
            <div className="v2-final-btns">
              <a href="#/inscription" className="v2-btn v2-btn-brand v2-btn-lg">
                Commencer un dossier <Icon name="arrow" size={16} />
              </a>
              <a href="#/connexion" className="v2-btn v2-btn-ghost v2-btn-lg">
                J'ai déjà un compte
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="v2-foot">
        <div className="v2-wrap v2-foot-in">
          <div>
            <a className="v2-brand" href="#/">
              <Mark size={28} />
              <Wordmark />
            </a>
            <p>Le poste de travail des appels d'offres pour les PME du Bénin.</p>
          </div>
          <nav aria-label="Produit">
            <b>Produit</b>
            <a href="#parcours" onClick={go("parcours")}>Le parcours</a>
            <a href="#garanties" onClick={go("garanties")}>Garanties</a>
            <a href="#tarif" onClick={go("tarif")}>Tarif</a>
            <a href="#questions" onClick={go("questions")}>Questions</a>
          </nav>
          <nav aria-label="Commencer">
            <b>Commencer</b>
            <a href="#/inscription">Créer un compte</a>
            <a href="#/connexion">Se connecter</a>
            <a href={`mailto:${CONTACT_EMAIL}?subject=D%C3%A9monstration%20MemoPli`}>Demander une démonstration</a>
          </nav>
          <nav aria-label="Contact">
            <b>Contact</b>
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            <span>Cotonou, Bénin</span>
            <span>Assistance sur WhatsApp</span>
          </nav>
        </div>
        <div className="v2-wrap v2-foot-bottom">
          <span>© {new Date().getFullYear()} MemoPli. Chiffres : ADPME Bénin ; ARMP, novembre 2026.</span>
          <span>Mise en page inspirée de « mesa » par LN, licence MIT.</span>
        </div>
        <div className="v2-giant-wrap">
          <Halftone colors={DOTS.cream} cell={6} shape="text" text="memopli" speed={0.4} className="v2-giant" />
          <span className="v2-giant-pli" aria-hidden="true">
            <Mascot size={140} />
          </span>
        </div>
      </footer>
    </div>
  );
}
