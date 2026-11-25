import React, { useEffect, useRef, useState } from "react";
import { dateFr, daysLeft, pieceStatus } from "../lib/format.js";
import NotificationBell from "./ui/notification-bell.tsx";

// Cloche d'alertes (Rare UI) : documents expirés, sans date ou qui expirent
// dans 30 jours, et dates limites de dépôt à 7 jours ou moins. Tout est
// calculé ici à partir des données du serveur.

export function computeAlerts(pieces = [], tenders = []) {
  const out = [];
  for (const p of pieces) {
    const st = pieceStatus(p);
    const d = p.expires_on ? daysLeft(p.expires_on) : null;
    if (st === "perime") out.push({ key: p.id, level: "ko", title: p.label, text: `expiré depuis le ${dateFr(p.expires_on)}`, to: "/app/documents" });
    else if (st === "a_verifier") out.push({ key: p.id, level: "warn", title: p.label, text: "aucune date de fin de validité", to: "/app/documents" });
    else if (d !== null && d <= 30) out.push({ key: p.id, level: "warn", title: p.label, text: `expire dans ${d} j`, to: "/app/documents" });
  }
  for (const t of tenders || []) {
    const d = t.deadline ? daysLeft(t.deadline) : null;
    if (d !== null && d >= 0 && d <= 7)
      out.push({ key: t.id, level: "warn", title: t.title || "Appel d'offres", text: `date limite dans ${d} j`, to: `/app/dossiers/${t.id}` });
  }
  return out.sort((a, b) => (a.level === "ko" ? -1 : 0) - (b.level === "ko" ? -1 : 0));
}

export default function Alerts({ pieces, tenders, size = 40, align = "left" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const alerts = computeAlerts(pieces, tenders);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (e.type === "keydown" ? e.key === "Escape" : !ref.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div className={`alerts alerts-${align}`} ref={ref}>
      <span className="rui">
        <NotificationBell count={alerts.length} size={size} color="red" onClick={() => setOpen((o) => !o)} aria-expanded={open} />
      </span>
      {open && (
        <div className="alerts-pop" role="dialog" aria-label="Alertes">
          <p className="alerts-head">
            {alerts.length ? `${alerts.length} alerte${alerts.length > 1 ? "s" : ""}` : "Aucune alerte"}
          </p>
          {alerts.length === 0 ? (
            <p className="alerts-empty">Tous vos documents sont à jour et aucune date limite n'approche.</p>
          ) : (
            <ul>
              {alerts.map((a) => (
                <li key={a.key}>
                  <a href={`#${a.to}`} onClick={() => setOpen(false)}>
                    <span className={`dot ${a.level === "ko" ? "perime" : "a_verifier"}`} aria-hidden="true" />
                    <span>
                      <strong>{a.title}</strong>
                      <small>{a.text}</small>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
