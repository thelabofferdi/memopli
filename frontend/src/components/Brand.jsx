import React from "react";
import Mascot from "./Mascot.jsx";

// Briques visuelles partagées par la landing et l'espace client :
// icônes au trait, pastilles d'étape teintées, et Pli qui parle.

export function Icon({ name, size = 16 }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      {name === "building" && <path {...p} d="M5 20.5V6l7-2.5v17M12 8.5h7v12M3 20.5h18" />}
      {name === "files" && <path {...p} d="M8 3.5h7l4 4v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2zM15 3.5v4h4" />}
      {name === "upload" && <path {...p} d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 15v3.5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V15" />}
      {name === "list" && <path {...p} d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />}
      {name === "pen" && <path {...p} d="M4 20l4.5-1L19 8.5a2.1 2.1 0 0 0-3-3L5.5 16 4 20zM14.5 7l3 3" />}
      {name === "arrow" && <path {...p} d="M5 12h14M13 6l6 6-6 6" />}
      {name === "chat" && <path {...p} d="M5 18.5V6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8.5z" />}
      {name === "shield" && <path {...p} d="M12 3.5 5 6.5v5c0 4.2 3 7.7 7 8.8 4-1.1 7-4.6 7-8.8v-5z" />}
      {name === "lock" && <path {...p} d="M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3" />}
      {name === "menu" && <path {...p} d="M4 7h16M4 12h16M4 17h16" />}
      {name === "close" && <path {...p} d="M6 6l12 12M18 6 6 18" />}
      {name === "folder" && <path {...p} d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />}
      {name === "search" && <path {...p} d="M11 17.5a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM16 16l4.5 4.5" />}
      {name === "user" && <path {...p} d="M12 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM5 20c1-3.6 3.7-5.5 7-5.5s6 1.9 7 5.5" />}
      {name === "check" && <path {...p} d="m5 12.5 4.5 4.5L19 7.5" />}
      {name === "clock" && <path {...p} d="M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17zM12 7.5V12l3 2" />}
      {name === "alert" && <path {...p} d="M12 4 2.8 19.5h18.4zM12 10v4.5M12 17v.01" />}
      {name === "plus" && <path {...p} d="M12 5v14M5 12h14" />}
      {name === "home" && <path {...p} d="M4 11 12 4l8 7v8.5a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" />}
    </svg>
  );
}

/** Pastille d'étape teintée (teintes de marque : jamais une couleur de statut). */
export function AppChip({ tint = "#2b3ae0", icon, size = 28 }) {
  return (
    <span className="v2-chip" style={{ "--tint": tint, width: size, height: size }}>
      <Icon name={icon} size={Math.round(size * 0.55)} />
    </span>
  );
}

/** Pli qui parle : avatar + bulle. */
export function PliSays({ children, mood = "happy", size = 56, dark = false, className = "" }) {
  return (
    <div className={["v2-says", dark && "dark", className].filter(Boolean).join(" ")}>
      <span className="v2-says-av" style={{ width: size, height: size }}>
        <Mascot size={size * 0.78} animated={false} mood={mood} />
      </span>
      <p>{children}</p>
    </div>
  );
}

export const TINTS = {
  entreprise: "#2b3ae0",
  documents: "#4338ca",
  dossier: "#6d28d9",
  exigences: "#0e6fa8",
  redaction: "#0b1020",
};

/** En-tête de page de l'espace client : surtitre, titre, conseil de Pli, actions. */
export function PageHead({ kicker, title, sub, tip, mood = "happy", actions }) {
  return (
    <header className="ph">
      <div className="ph-main">
        {kicker && <p className="ph-kicker">{kicker}</p>}
        <h1>{title}</h1>
        {sub && <p className="ph-sub">{sub}</p>}
      </div>
      {actions && <div className="ph-actions">{actions}</div>}
      {tip && (
        <PliSays mood={mood} size={48} className="ph-tip">
          {tip}
        </PliSays>
      )}
    </header>
  );
}

/** Anneau de progression (0 à 1). */
export function Ring({ value = 0, size = 72, stroke = 8, label }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <span className="ring" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--brand-soft)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--brand)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 0.8s var(--ease)" }}
        />
      </svg>
      <b>{label ?? `${Math.round(v * 100)} %`}</b>
    </span>
  );
}
