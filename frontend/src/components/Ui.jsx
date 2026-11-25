import React, { forwardRef, useState } from "react";
import { errorText, metaLabel, pageLabel, statusLabel } from "../lib/format.js";

// Le routage passe par le hash (#/app) : une ancre classique (#coffre) ferait
// quitter l'application. On fait donc défiler la page sans toucher à l'URL.
export function scrollToId(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

export function Section({ id, step, title, lede, aside, children }) {
  return (
    <section id={id} className="panel" aria-labelledby={`${id}-title`}>
      <header className="panel-head">
        <h2 id={`${id}-title`}>
          {step && <span className="step">{step}</span>}
          {title}
        </h2>
        {aside && <div className="panel-aside">{aside}</div>}
      </header>
      {lede && <p className="panel-lede">{lede}</p>}
      {children}
    </section>
  );
}

export function Badge({ status, children }) {
  return <span className={`badge badge-${status || "neutre"}`}>{children ?? statusLabel(status)}</span>;
}

export function Source({ page }) {
  const missing = page === null || page === undefined || page === "";
  return <span className={missing ? "src src-missing" : "src"}>{pageLabel(page)}</span>;
}

export function Cost({ meta }) {
  const label = metaLabel(meta);
  return label ? <span className="meta-line">{label}</span> : null;
}

export function ErrorBox({ error, onClose }) {
  if (!error) return null;
  return (
    <div className="alert" role="alert">
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 7.5v5.5M12 16.5v.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <div className="alert-text">
        <span>{errorText(error)}</span>
        {error.code && <code title="Code à communiquer au support">{error.code}</code>}
      </div>
      {onClose && (
        <button type="button" className="ghost small" onClick={onClose}>
          Fermer
        </button>
      )}
    </div>
  );
}

export function Busy({ label }) {
  if (!label) return null;
  return (
    <div className="toast" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>{label.charAt(0).toUpperCase() + label.slice(1)}…</span>
    </div>
  );
}

export function Empty({ children }) {
  return <p className="empty">{children}</p>;
}

/** Zone de dépôt : clic ou glisser-déposer, PDF uniquement. */
export const FileDrop = forwardRef(function FileDrop({ file, onFile, label = "Choisir un PDF", hint }, ref) {
  const [over, setOver] = useState(false);
  const take = (f) => onFile(f && (f.type === "application/pdf" || /\.pdf$/i.test(f.name)) ? f : null);

  return (
    <label
      className={["drop", over && "over", file && "has-file"].filter(Boolean).join(" ")}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        take(e.dataTransfer.files?.[0]);
      }}
    >
      <input
        ref={ref}
        type="file"
        accept="application/pdf"
        className="drop-input"
        onChange={(e) => take(e.target.files?.[0] || null)}
      />
      <span className="drop-ico" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="20" height="20">
          <path d="M6 3h8l4 4v14H6z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M14 3v4h4M12 11v6M9.5 13.5 12 11l2.5 2.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="drop-text">
        <strong>{file ? file.name : label}</strong>
        <small>{file ? `${Math.max(1, Math.round(file.size / 1024))} Ko · cliquez pour changer` : hint || "ou glissez-le ici"}</small>
      </span>
    </label>
  );
});

/** Rail des étapes : ce qui est fait, ce qui reste. */
export function Stepper({ steps }) {
  const current = steps.findIndex((s) => !s.done && !s.locked);
  return (
    <nav className="stepper" aria-label="Étapes du dossier">
      <ol>
        {steps.map((s, i) => {
          const state = s.done ? "done" : i === current ? "current" : s.locked ? "locked" : "todo";
          return (
            <li key={s.id}>
              <button
                type="button"
                className={`stepper-item ${state}`}
                disabled={s.locked}
                aria-current={state === "current" ? "step" : undefined}
                onClick={() => scrollToId(s.id)}
              >
                <span className="stepper-num" aria-hidden="true">
                  {s.done ? (
                    <svg viewBox="0 0 16 16" width="14" height="14">
                      <path d="m3.5 8.5 3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </span>
                <span className="stepper-text">
                  <strong>{s.label}</strong>
                  {s.hint && <small>{s.hint}</small>}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
