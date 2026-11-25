import React, { useEffect, useRef, useState } from "react";
import * as api from "../api.js";
import { errorText } from "../format.js";
import Mascot from "./Mascot.jsx";

// « Demander à Pli » : l'assistant du dossier. Il ne lit que le dossier d'appel
// d'offres (règle 4 : vos documents ne partent jamais au modèle) et cite la page
// de chaque réponse. Les citations [p.N] deviennent des pastilles cliquables qui
// montrent le passage d'origine.

const SUGGESTIONS = [
  "Quelle est la date limite de dépôt ?",
  "Qu'est-ce qui bloque mon dépôt ?",
  "Quelle garantie de soumission est demandée ?",
  "Quels sont les critères de notation ?",
];

/** Découpe le texte en morceaux et transforme [p.3] / [p. 3] en pastilles. */
function renderAnswer(text, citations, onCite, activePage) {
  const parts = String(text || "").split(/(\[p\.\s*\d+\])/g);
  return parts.map((part, i) => {
    const m = part.match(/^\[p\.\s*(\d+)\]$/);
    if (!m) return <React.Fragment key={i}>{part}</React.Fragment>;
    const page = Number(m[1]);
    const known = citations.some((c) => Number(c.page) === page);
    return (
      <button
        key={i}
        type="button"
        className={["cite", activePage === page && "on", !known && "cite-unknown"].filter(Boolean).join(" ")}
        onClick={() => onCite(page)}
        title={known ? "Voir le passage" : "Page citée sans passage associé"}
      >
        p. {page}
      </button>
    );
  });
}

function Answer({ msg }) {
  const [page, setPage] = useState(null);
  const citations = msg.citations || [];
  const shown = page === null ? [] : citations.filter((c) => Number(c.page) === page);

  return (
    <div className="msg msg-pli">
      <div className="msg-body">{renderAnswer(msg.content, citations, (p) => setPage(page === p ? null : p), page)}</div>
      {shown.length > 0 && (
        <div className="msg-sources">
          {shown.map((c, i) => (
            <blockquote key={`${c.document_id}-${i}`}>
              <b>Page {c.page}</b>
              {c.extrait}…
            </blockquote>
          ))}
        </div>
      )}
      {citations.length > 0 && page === null && (
        <details className="msg-all">
          <summary>
            {citations.length} passage{citations.length > 1 ? "s" : ""} lu{citations.length > 1 ? "s" : ""} pour répondre
          </summary>
          {citations.map((c, i) => (
            <blockquote key={`${c.document_id}-${i}`}>
              <b>Page {c.page ?? "?"}</b>
              {c.extrait}…
            </blockquote>
          ))}
        </details>
      )}
      {msg.sent !== undefined && (
        <p className="msg-meta">
          {msg.sent === 0 ? "Aucun de vos documents n'a été envoyé." : `${msg.sent} document(s) envoyé(s).`}
        </p>
      )}
    </div>
  );
}

export default function Pli({ orgId, tenderId, open, onClose }) {
  const [identity, setIdentity] = useState(null);
  const [messages, setMessages] = useState([]);
  const [indexed, setIndexed] = useState(null); // null = inconnu
  const [text, setText] = useState("");
  const [thinking, setThinking] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    Promise.all([
      api.agentIdentity().catch(() => null),
      api.agentHistory(orgId, tenderId).catch(() => ({ messages: [] })),
      api.documents(orgId, tenderId).catch(() => null),
    ]).then(([id, hist, docs]) => {
      if (!alive) return;
      setIdentity(id);
      setMessages(hist.messages || []);
      if (docs) setIndexed(docs.documents.some((d) => d.kind === "dao" && d.tender_id === tenderId && d.chunks > 0));
    });
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    setTimeout(() => inputRef.current?.focus(), 200);
    return () => {
      alive = false;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, orgId, tenderId, onClose]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  const ask = async (question) => {
    const q = question.trim();
    if (!q || thinking) return;
    setText("");
    setError("");
    setMessages((m) => [...m, { role: "user", content: q }]);
    setThinking(true);
    try {
      const res = await api.agentChat({ org_id: orgId, tender_id: tenderId, message: q });
      setMessages((m) => [
        ...m,
        { role: "assistant", content: res.answer, citations: res.citations, sent: res.contexte?.pieces_envoyees },
      ]);
    } catch (e) {
      setError(errorText(e));
      setMessages((m) => m.slice(0, -1));
      setText(q);
    } finally {
      setThinking(false);
    }
  };

  const reindex = async () => {
    setIndexing(true);
    setError("");
    try {
      await api.indexTender(tenderId);
      setIndexed(true);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setIndexing(false);
    }
  };

  const unavailable = identity && identity.configure === false;

  return (
    <div className={open ? "pli-drawer open" : "pli-drawer"} aria-hidden={!open}>
      <button type="button" className="pli-scrim" tabIndex={-1} aria-label="Fermer" onClick={onClose} />
      <aside className="pli-panel" role="dialog" aria-modal="true" aria-labelledby="pli-title">
        <header className="pli-head">
          <span className="pli-av" aria-hidden="true">
            <Mascot size={44} animated={false} />
          </span>
          <div>
            <h2 id="pli-title">Demander à Pli</h2>
            <p>{identity?.role || "assistant du dossier d'appel d'offres"}</p>
          </div>
          <button type="button" className="ghost small" onClick={onClose}>
            Fermer
          </button>
        </header>

        <div className="pli-list" ref={listRef}>
          <div className="msg msg-pli">
            <div className="msg-body">
              {identity?.accueil ||
                "Je lis le dossier avec vous. Demandez-moi une exigence, une date, un document qui bloque."}
            </div>
          </div>

          {indexed === false && (
            <div className="pli-note">
              <p>Ce dossier n'est pas encore prêt pour Pli : il doit d'abord être préparé pour la recherche.</p>
              <button type="button" onClick={reindex} disabled={indexing}>
                {indexing ? "Préparation…" : "Préparer le dossier pour Pli"}
              </button>
            </div>
          )}

          {messages.map((m, i) =>
            m.role === "user" ? (
              <div className="msg msg-me" key={m.id || i}>
                <div className="msg-body">{m.content}</div>
              </div>
            ) : (
              <Answer key={m.id || i} msg={m} />
            ),
          )}

          {thinking && (
            <div className="msg msg-pli">
              <div className="msg-body typing" aria-label="Pli rédige sa réponse">
                <i />
                <i />
                <i />
              </div>
            </div>
          )}

          {messages.length === 0 && !thinking && (
            <div className="pli-suggest">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" className="chip-btn" onClick={() => ask(s)} disabled={unavailable}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {error && (
          <p className="pli-error" role="alert">
            {error}
          </p>
        )}

        <form
          className="pli-form"
          onSubmit={(e) => {
            e.preventDefault();
            ask(text);
          }}
        >
          <textarea
            ref={inputRef}
            rows={1}
            value={text}
            maxLength={2000}
            placeholder={unavailable ? "Pli est indisponible pour le moment" : "Posez votre question sur ce dossier…"}
            disabled={unavailable}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask(text);
              }
            }}
          />
          <button type="submit" disabled={!text.trim() || thinking || unavailable} aria-label="Envoyer">
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </form>
        <p className="pli-foot">Pli ne lit que le dossier d'appel d'offres. Vos documents ne lui sont jamais envoyés.</p>
      </aside>
    </div>
  );
}
