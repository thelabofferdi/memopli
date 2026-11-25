import React, { useEffect, useState } from "react";
import { dateFr, sectionLabel } from "../format.js";
import { Badge, Empty, Section } from "./Ui.jsx";

const SIGNATURE = "Proposition à relire et à adapter avant signature.";

export default function Draft({ drafts, openId, references, busy, onGenerate, onOpen , step }) {
  const [copied, setCopied] = useState(false);
  const open = drafts.find((d) => d.id === openId) || drafts[0] || null;

  useEffect(() => {
    setCopied(false);
  }, [open?.id]);

  const copy = async () => {
    if (!open) return;
    try {
      await navigator.clipboard.writeText(open.content);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const download = () => {
    if (!open) return;
    const blob = new Blob([open.content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `memopli-${open.section}-${String(open.created_at || "").slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const enough = references >= 2;

  return (
    <Section
      id="redaction"
      step={step}
      title="La méthodologie"
      lede="Rédigée à partir de vos références de chantiers uniquement. Quand une information manque, le texte écrit « à compléter » au lieu d'inventer."
      aside={!enough ? <Badge status="a_verifier">références insuffisantes</Badge> : null}
    >
      <div className="cta-row">
        <button type="button" onClick={() => onGenerate("methodologie")} disabled={Boolean(busy) || !enough}>
          {drafts.length ? "Rédiger une nouvelle version" : "Rédiger la méthodologie"}
        </button>
        <span className="note">
          {!enough
            ? `Il faut au moins deux références de chantiers ou bilans dans vos documents — vous en avez ${references}.`
            : `${references} références disponibles. Une trentaine de secondes.`}
        </span>
      </div>

      {drafts.length === 0 ? (
        <Empty>Aucun texte rédigé pour ce dossier.</Empty>
      ) : (
        <>
          {drafts.length > 1 && (
            <div className="tabs" role="tablist" aria-label="Versions rédigées">
              {drafts.map((d, i) => (
                <button
                  key={d.id}
                  type="button"
                  role="tab"
                  aria-selected={open && d.id === open.id}
                  className={open && d.id === open.id ? "tab active" : "tab"}
                  onClick={() => onOpen(d.id)}
                >
                  {sectionLabel(d.section)} · version {drafts.length - i}
                  <span className="meta">{dateFr(d.created_at)}</span>
                </button>
              ))}
            </div>
          )}

          {open && (
            <article className="draft">
              <header className="draft-head">
                <div>
                  <strong>{sectionLabel(open.section)}</strong>
                  <span className="meta" title={open.model || ""}>
                    Rédigée le {dateFr(open.created_at)} · à relire
                  </span>
                </div>
                <div className="draft-actions">
                  <button type="button" className="ghost small" onClick={copy}>
                    {copied ? "Copié ✓" : "Copier"}
                  </button>
                  <button type="button" className="ghost small" onClick={download}>
                    Télécharger
                  </button>
                </div>
              </header>
              <div className="draft-body">{open.content}</div>
              {!open.content.trim().endsWith(SIGNATURE) && <p className="draft-sign">{SIGNATURE}</p>}
            </article>
          )}
        </>
      )}
    </Section>
  );
}
