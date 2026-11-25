import React, { useCallback, useEffect, useState } from "react";
import * as api from "../api.js";
import Company from "../components/Company.jsx";
import { Mark, Wordmark } from "../components/Logo.jsx";
import { Badge, Busy, ErrorBox } from "../components/Ui.jsx";
import Vault from "../components/Vault.jsx";
import { pieceStatus } from "../format.js";
import { navigate } from "../router.js";
import Account from "./Account.jsx";
import Dossier from "./Dossier.jsx";
import Dossiers from "./Dossiers.jsx";
import Search from "./Search.jsx";

// Espace client : barre latérale (dossiers, documents, entreprise, compte) et
// une page par entrée. Les données partagées (compte, entreprise, documents)
// vivent ici ; chaque dossier charge les siennes.

const NAV = [
  { to: "/app", match: (p) => p === "/app" || p.startsWith("/app/dossiers"), label: "Mes dossiers", icon: "folder" },
  { to: "/app/recherche", match: (p) => p.startsWith("/app/recherche"), label: "Rechercher", icon: "search" },
  { to: "/app/documents", match: (p) => p.startsWith("/app/documents"), label: "Mes documents", icon: "files" },
  { to: "/app/entreprise", match: (p) => p.startsWith("/app/entreprise"), label: "Mon entreprise", icon: "building" },
];

function Icon({ name }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      {name === "folder" && <path {...p} d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" />}
      {name === "files" && (
        <>
          <path {...p} d="M8 3.5h7l4 4v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2z" />
          <path {...p} d="M15 3.5v4h4M9.5 12.5h6M9.5 16h4" />
        </>
      )}
      {name === "building" && (
        <>
          <path {...p} d="M4.5 20.5v-14l7-3v17M11.5 8.5h8v12" />
          <path {...p} d="M3 20.5h18M7.5 9v.01M7.5 12.5v.01M7.5 16v.01M15 12v.01M15 15.5v.01" />
        </>
      )}
      {name === "user" && (
        <>
          <circle {...p} cx="12" cy="8.5" r="3.5" />
          <path {...p} d="M5 20c1-3.6 3.7-5.5 7-5.5s6 1.9 7 5.5" />
        </>
      )}
      {name === "search" && (
        <>
          <circle {...p} cx="11" cy="11" r="6.5" />
          <path {...p} d="m16 16 4.5 4.5" />
        </>
      )}
      {name === "menu" && <path {...p} d="M4 7h16M4 12h16M4 17h16" />}
    </svg>
  );
}

// la recherche a besoin des titres des dossiers pour ses liens et son filtre
function SearchPage({ org }) {
  const [tenders, setTenders] = useState([]);
  useEffect(() => {
    api.listTenders(org.id).then(setTenders).catch(() => setTenders([]));
  }, [org.id]);
  return <Search org={org} tenders={tenders} />;
}

export default function Workspace({ path }) {
  const [user, setUser] = useState(null);
  const [org, setOrg] = useState(null);
  const [pieces, setPieces] = useState([]);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState(null);
  const [menu, setMenu] = useState(false);

  const route = path.split("?")[0];
  const query = new URLSearchParams(path.split("?")[1] || "");

  // ------------------------------------------------------------ amorçage

  useEffect(() => {
    let alive = true;
    api
      .health()
      .then((h) => alive && setHealth(h))
      .catch(() => alive && setHealth({ ok: false }));

    (async () => {
      try {
        const profile = await api.me();
        if (!alive) return;
        setUser(profile.user);
        const first = profile.orgs?.[0];
        if (first) {
          const [full, list] = await Promise.all([api.getOrg(first.id), api.listPieces(first.id)]);
          if (!alive) return;
          setOrg(full);
          setPieces(list);
        }
      } catch (e) {
        if (alive) setError(e);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    const onExpired = () => navigate("/connexion?expiree=1", { replace: true });
    window.addEventListener(api.SESSION_EXPIRED, onExpired);
    return () => {
      alive = false;
      window.removeEventListener(api.SESSION_EXPIRED, onExpired);
    };
  }, []);

  useEffect(() => setMenu(false), [route]);

  // ---------------------------------------------------------- utilitaires

  const run = useCallback(async (label, fn) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
      return true;
    } catch (e) {
      setError(e instanceof api.ApiError ? e : { code: "erreur", message: String(e) });
      return false;
    } finally {
      setBusy("");
    }
  }, []);

  const reloadPieces = useCallback(async () => {
    if (org) setPieces(await api.listPieces(org.id));
  }, [org]);

  // ------------------------------------------------------------ actions

  const saveCompany = (fields) =>
    run("enregistrement de l'entreprise", async () => {
      if (org) setOrg(await api.updateOrg(org.id, fields));
      else {
        const created = await api.createOrg(fields);
        setOrg(await api.getOrg(created.id));
        setPieces([]);
      }
    });

  const addPiece = (fields) =>
    run("ajout du document", async () => {
      await api.addPiece({ org_id: org.id, ...fields });
      await reloadPieces();
    });

  const removePiece = (piece) =>
    run("retrait du document", async () => {
      await api.delPiece(piece.id);
      await reloadPieces();
    });

  const replacePiece = (piece, replacement) =>
    run("remplacement du document", async () => {
      await api.delPiece(piece.id);
      await api.addPiece({
        org_id: org.id,
        kind: piece.kind,
        label: piece.label,
        expires_on: replacement.expires_on,
        file: replacement.file,
      });
      await reloadPieces();
    });

  const signOut = async () => {
    try {
      await api.logout();
    } catch {
      // jeton déjà expiré : on se déconnecte quand même côté navigateur
    }
    api.session.set(null);
    navigate("/connexion", { replace: true });
  };

  // -------------------------------------------------------------- rendu

  const toTreat = pieces.filter((p) => pieceStatus(p) !== "valide").length;
  const apiDown = health && health.ok === false;
  const noKey = health && health.ok && health.ai_key === false;

  let page;
  if (loading) {
    page = (
      <div className="panel skeleton" aria-busy="true">
        <span />
        <span />
        <span />
      </div>
    );
  } else if (!org) {
    page = (
      <>
        <header className="page-head">
          <h1>Bienvenue</h1>
          <p>Commencez par votre entreprise : elle sera reprise dans chacun de vos dossiers.</p>
        </header>
        <Company org={null} busy={busy} onSave={saveCompany} />
      </>
    );
  } else if (route.startsWith("/app/dossiers/")) {
    page = (
      <Dossier
        key={route}
        tenderId={decodeURIComponent(route.slice("/app/dossiers/".length))}
        orgId={org.id}
        pieces={pieces}
        busy={busy}
        run={run}
      />
    );
  } else if (route.startsWith("/app/documents")) {
    page = (
      <>
        <header className="page-head">
          <h1>Mes documents</h1>
          <p>Vos attestations, registres, références et bilans. Ils servent à tous vos dossiers.</p>
        </header>
        <Vault pieces={pieces} busy={busy} onAdd={addPiece} onRemove={removePiece} onReplace={replacePiece} />
      </>
    );
  } else if (route.startsWith("/app/entreprise")) {
    page = (
      <>
        <header className="page-head">
          <h1>Mon entreprise</h1>
          <p>Ces informations sont reprises dans chacun de vos dossiers.</p>
        </header>
        {query.get("bienvenue") && (
          <div className="welcome">
            <strong>Votre compte est créé.</strong> Complétez votre entreprise, puis ajoutez vos
            documents. Vous pourrez ensuite déposer votre premier appel d'offres.
            <div className="welcome-actions">
              <button type="button" onClick={() => navigate("/app/documents")}>
                Ajouter mes documents
              </button>
            </div>
          </div>
        )}
        <Company org={org} busy={busy} onSave={saveCompany} startEditing={Boolean(query.get("bienvenue"))} />
      </>
    );
  } else if (route.startsWith("/app/recherche")) {
    page = <SearchPage org={org} />;
  } else if (route.startsWith("/app/compte")) {
    page = <Account user={user} org={org} onSignOut={signOut} />;
  } else {
    page = <Dossiers org={org} pieces={pieces} busy={busy} run={run} />;
  }

  return (
    <div className={menu ? "ws menu-open" : "ws"}>
      <aside className="side" aria-label="Navigation principale">
        <a className="side-brand" href="#/app">
          <Mark size={30} />
          <Wordmark />
        </a>

        {org && (
          <div className="side-org" title={org.name}>
            <span className="org-av" aria-hidden="true">
              {org.name.trim().charAt(0).toUpperCase()}
            </span>
            <span className="side-org-text">
              <strong>{org.name}</strong>
              <small>{org.sector || "Entreprise"}</small>
            </span>
          </div>
        )}

        <nav className="side-nav">
          {NAV.map((item) => (
            <a
              key={item.to}
              href={`#${item.to}`}
              className={item.match(route) ? "side-link on" : "side-link"}
              aria-current={item.match(route) ? "page" : undefined}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {item.icon === "files" && toTreat > 0 && <span className="side-count">{toTreat}</span>}
            </a>
          ))}
        </nav>

        <div className="side-foot">
          {(apiDown || noKey) && (
            <div className="side-status">
              {apiDown && <Badge status="perime">service indisponible</Badge>}
              {noKey && (
                <Badge status="a_verifier">
                  <span title="Clé RODIUM_API_KEY absente : lecture, vérification et rédaction échoueront.">
                    analyse indisponible
                  </span>
                </Badge>
              )}
            </div>
          )}
          <a
            href="#/app/compte"
            className={route.startsWith("/app/compte") ? "side-user on" : "side-user"}
            aria-current={route.startsWith("/app/compte") ? "page" : undefined}
          >
            <span className="side-user-av" aria-hidden="true">
              <Icon name="user" />
            </span>
            <span className="side-user-text">
              <strong>Mon compte</strong>
              <small>{user?.email || "…"}</small>
            </span>
          </a>
        </div>
      </aside>

      <div className="ws-main">
        <header className="ws-bar">
          <button
            type="button"
            className="ws-burger"
            aria-label={menu ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={menu}
            onClick={() => setMenu((m) => !m)}
          >
            <Icon name="menu" />
          </button>
          <a className="side-brand" href="#/app">
            <Mark size={28} />
            <Wordmark />
          </a>
        </header>
        <button type="button" className="ws-scrim" aria-label="Fermer le menu" tabIndex={-1} onClick={() => setMenu(false)} />

        <main className="ws-content">
          <ErrorBox error={error} onClose={() => setError(null)} />
          {page}
        </main>
      </div>

      <Busy label={busy} />
    </div>
  );
}
