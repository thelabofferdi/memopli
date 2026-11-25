import React, { useEffect, useState } from "react";
import * as api from "../api.js";
import { Empty } from "../components/Ui.jsx";
import { errorText, number } from "../format.js";

// Recherche locale dans tout ce que l'entreprise a déposé : dossiers d'appel
// d'offres et documents. Aucun appel à l'IA : la recherche tourne sur le serveur.

const KIND = { dao: "Appel d'offres", piece: "Document" };

function highlight(text, query) {
  const words = query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 2)
    .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!words.length) return text;
  const re = new RegExp(`(${words.join("|")})`, "giu");
  return text.split(re).map((part, i) => (i % 2 ? <mark key={i}>{part}</mark> : part));
}

export default function Search({ org, tenders }) {
  // #/app/recherche?q=… lance la recherche à l'arrivée (lien partageable)
  const initial = new URLSearchParams(window.location.hash.split("?")[1] || "").get("q") || "";
  const [query, setQuery] = useState(initial);
  const [scope, setScope] = useState("");
  const [results, setResults] = useState(null);
  const [stats, setStats] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .documents(org.id)
      .then((d) => setStats(d.index))
      .catch(() => setStats(null));
  }, [org.id]);

  useEffect(() => {
    if (initial) run(null, initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (e, q = query) => {
    e?.preventDefault();
    if (q.trim().length < 2) return;
    setBusy(true);
    setError("");
    try {
      const res = await api.search({ org_id: org.id, query: q.trim(), tender_id: scope || null, k: 12 });
      setResults(res.results);
      setStats(res.index);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const titleOf = (id) => tenders.find((t) => t.id === id)?.title || "Appel d'offres sans titre";

  return (
    <>
      <header className="page-head">
        <h1>Rechercher</h1>
        <p>
          Retrouvez un mot, une exigence ou un montant dans vos appels d'offres et vos documents. La
          recherche se fait sur nos serveurs, sans intelligence artificielle.
        </p>
      </header>

      <form className="search" onSubmit={run} role="search">
        <span className="search-ico" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="20" height="20">
            <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path d="m16 16 4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ex. garantie de soumission, délai d'exécution, chiffre d'affaires…"
          aria-label="Rechercher"
          maxLength={300}
          autoFocus
        />
        <select value={scope} onChange={(e) => setScope(e.target.value)} aria-label="Où chercher">
          <option value="">Tout</option>
          {tenders.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title || "Appel d'offres sans titre"}
            </option>
          ))}
        </select>
        <button type="submit" disabled={busy || query.trim().length < 2}>
          {busy ? "Recherche…" : "Rechercher"}
        </button>
      </form>

      {stats && (
        <p className="note">
          {number(stats.documents)} document{stats.documents > 1 ? "s" : ""} lu{stats.documents > 1 ? "s" : ""} ·{" "}
          {number(stats.morceaux)} passage{stats.morceaux > 1 ? "s" : ""} consultable{stats.morceaux > 1 ? "s" : ""}
        </p>
      )}

      {error && (
        <p className="callout warn" role="alert">
          {error}
        </p>
      )}

      {results === null ? null : results.length === 0 ? (
        <Empty>Aucun passage ne correspond. Essayez un autre mot, ou un mot plus court.</Empty>
      ) : (
        <ul className="results">
          {results.map((r, i) => (
            <li key={`${r.document_id}-${r.page}-${i}`} className="result">
              <div className="result-head">
                <span className={`kind kind-${r.kind}`}>{KIND[r.kind] || r.kind}</span>
                {r.page ? <span className="src">p. {r.page}</span> : <span className="src-missing">page non extraite</span>}
                {r.tender_id && (
                  <a href={`#/app/dossiers/${r.tender_id}`} className="result-link">
                    {titleOf(r.tender_id)} →
                  </a>
                )}
                {r.piece_id && (
                  <a href="#/app/documents" className="result-link">
                    Mes documents →
                  </a>
                )}
              </div>
              <p>{highlight(r.extrait, query)}…</p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
