// Client de l'API MemoPli. Une seule règle : toute erreur remonte sous la
// forme {code, message, status}, pour que l'interface puisse toujours dire
// pourquoi elle échoue au lieu d'afficher « Error ».

export class ApiError extends Error {
  constructor(code, message, status) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

// ---------------------------------------------------------------- session
// Jeton opaque du serveur (mpl_…), gardé dans le navigateur et envoyé en
// « Authorization: Bearer ». Un 401 sur une requête authentifiée signifie que la
// session a expiré ou a été révoquée : on l'oublie et on prévient l'interface.

const TOKEN_KEY = "memopli.token";
export const SESSION_EXPIRED = "memopli:session-expired";

export const session = {
  get token() {
    return localStorage.getItem(TOKEN_KEY);
  },
  set(token) {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  },
};

async function call(path, options = {}) {
  const token = session.token;
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(path, { ...options, headers });
  } catch {
    throw new ApiError(
      "api_injoignable",
      "Le service ne répond pas. Vérifiez votre connexion, puis réessayez.",
      0,
    );
  }
  const type = res.headers.get("content-type") || "";
  const body = type.includes("application/json") ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    const err = (body && body.error) || {};
    if (res.status === 401 && token && !path.startsWith("/api/auth/login")) {
      session.set(null);
      window.dispatchEvent(new Event(SESSION_EXPIRED));
    }
    throw new ApiError(err.code || `http_${res.status}`, err.message || res.statusText, res.status);
  }
  return body;
}

const json = (method, body) => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const multipart = (fields, method = "POST") => {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value === null || value === undefined || value === "") continue;
    form.append(key, value);
  }
  return { method, body: form };
};

// ------------------------------------------------------------------ santé

export const health = () => call("/health");

// --------------------------------------------------------------- comptes

export const signup = (fields) => call("/api/auth/signup", json("POST", fields));

export const login = (fields) => call("/api/auth/login", json("POST", fields));

export const logout = () => call("/api/auth/logout", { method: "POST" });

export const me = () => call("/api/auth/me");

// ------------------------------------------------------------ entreprise

export const createOrg = (fields) => call("/api/orgs", json("POST", fields));

export const getOrg = (id) => call(`/api/orgs/${encodeURIComponent(id)}`);

export const updateOrg = (id, fields) =>
  call(`/api/orgs/${encodeURIComponent(id)}`, json("PATCH", fields));

export const listTenders = (orgId) => call(`/api/orgs/${encodeURIComponent(orgId)}/tenders`);

// ---------------------------------------------------------------- pièces

export const listPieces = (orgId) =>
  call(`/api/pieces?org_id=${encodeURIComponent(orgId)}`);

export const addPiece = (fields) => call("/api/pieces", multipart(fields));

export const delPiece = (id) =>
  call(`/api/pieces/${encodeURIComponent(id)}`, { method: "DELETE" });

// ------------------------------------------------------------------- DAO

export const uploadTender = (fields) => call("/api/tenders", multipart(fields));

export const getTender = (id) => call(`/api/tenders/${encodeURIComponent(id)}`);

// ------------------------------------------------------------- exigences

export const extractReq = (id) =>
  call(`/api/tenders/${encodeURIComponent(id)}/requirements`, { method: "POST" });

export const listReq = (id) =>
  call(`/api/tenders/${encodeURIComponent(id)}/requirements`);

export const patchReq = (id, fields) =>
  call(`/api/requirements/${encodeURIComponent(id)}`, json("PATCH", fields));

// -------------------------------------------------------- rapprochement

export const matchReq = (id) =>
  call(`/api/tenders/${encodeURIComponent(id)}/match`, { method: "POST" });

export const readiness = (id) =>
  call(`/api/tenders/${encodeURIComponent(id)}/readiness`);

// -------------------------------------------------------------- rédaction

export const draft = (id, section = "methodologie") =>
  call(`/api/tenders/${encodeURIComponent(id)}/draft`, json("POST", { section }));

export const listDrafts = (id) =>
  call(`/api/tenders/${encodeURIComponent(id)}/drafts`);

// ------------------------------------------------------------------ coût

export const tenderCost = (id) => call(`/api/tenders/${encodeURIComponent(id)}/cost`);

// ------------------------------------------------- recherche et assistant

export const documents = (orgId, tenderId) =>
  call(
    `/api/documents?org_id=${encodeURIComponent(orgId)}${tenderId ? `&tender_id=${encodeURIComponent(tenderId)}` : ""}`,
  );

export const indexTender = (id) =>
  call(`/api/tenders/${encodeURIComponent(id)}/index`, { method: "POST" });

export const search = (fields) => call("/api/search", json("POST", fields));

export const agentIdentity = () => call("/api/agent/identity");

export const agentChat = (fields) => call("/api/agent/chat", json("POST", fields));

export const agentHistory = (orgId, tenderId) =>
  call(
    `/api/agent/history?org_id=${encodeURIComponent(orgId)}${tenderId ? `&tender_id=${encodeURIComponent(tenderId)}` : ""}`,
  );
