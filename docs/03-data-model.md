# Modèle de données (MVP, SQLite)

```sql
CREATE TABLE organizations (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  ifu         TEXT,
  rccm        TEXT,
  sector      TEXT,
  headcount   INTEGER,
  created_at  TEXT NOT NULL
);

CREATE TABLE pieces (
  id          TEXT PRIMARY KEY,
  org_id      TEXT NOT NULL REFERENCES organizations(id),
  kind        TEXT NOT NULL,          -- attestation_fiscale | cnss | rccm | reference | bilan | autre
  label       TEXT NOT NULL,
  file_path   TEXT,
  expires_on  TEXT,                   -- ISO 8601, NULL = non déclarée
  verified    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL
);

CREATE TABLE tenders (                -- le DAO déposé
  id          TEXT PRIMARY KEY,
  org_id      TEXT NOT NULL REFERENCES organizations(id),
  title       TEXT,
  buyer       TEXT,
  deadline    TEXT,                   -- AAAA-MM-JJ : date de référence du verdict
  file_path   TEXT,
  text_path   TEXT,                   -- texte extrait
  page_count  INTEGER,
  source      TEXT,                   -- pdf | ocr : d'où vient le texte
  created_at  TEXT NOT NULL
);

CREATE TABLE requirements (
  id          TEXT PRIMARY KEY,
  tender_id   TEXT NOT NULL REFERENCES tenders(id),
  label       TEXT NOT NULL,
  kind        TEXT NOT NULL,          -- piece | critere
  mandatory   INTEGER NOT NULL DEFAULT 1,
  weight      REAL,                   -- pour les critères de notation
  page        INTEGER,                -- page source
  excerpt     TEXT,                   -- extrait justificatif
  confidence  REAL,
  corrected   INTEGER NOT NULL DEFAULT 0,
  to_check    INTEGER NOT NULL DEFAULT 0,  -- page ou extrait non confirmé par le code
  created_at  TEXT NOT NULL
);

CREATE TABLE matches (
  id            TEXT PRIMARY KEY,
  requirement_id TEXT NOT NULL REFERENCES requirements(id),
  piece_id      TEXT REFERENCES pieces(id),
  -- historique du rapprochement : le verdict est recalculé à la lecture (app/state.py)
  status        TEXT NOT NULL,        -- valide | perime | manquant | a_verifier
  reason        TEXT,                 -- dont la raison d'un refus de type, réaffichée au verdict
  created_at    TEXT NOT NULL
);

CREATE TABLE drafts (
  id          TEXT PRIMARY KEY,
  tender_id   TEXT NOT NULL REFERENCES tenders(id),
  section     TEXT NOT NULL,
  content     TEXT NOT NULL,
  model       TEXT,
  tokens_in   INTEGER,
  tokens_out  INTEGER,
  created_at  TEXT NOT NULL
);
```

## Règles de statut (calculées en code)

La date de référence est la plus tardive entre aujourd'hui et `tenders.deadline` : le bailleur
juge la pièce le jour du dépôt (`app/state.py: reference_date`). `matches.status` n'est qu'un
historique ; `state.readiness` recalcule le statut à chaque lecture.

| Situation | `status` |
|---|---|
| pièce liée, valable à la date de référence | `valide` |
| pièce liée, date expirée avant la date de référence | `perime` |
| pièce liée, pas de date déclarée ou date illisible | `a_verifier` |
| aucune pièce liée | `manquant` |

Le dossier est `prêt` si aucune exigence `mandatory` n'est `manquant` ou `perime`.

Colonnes ajoutées après coup : `organizations.user_id`, `tenders.source`,
`requirements.to_check`. `init_db()` les crée sur une base existante (`db._ensure_column`),
sans migration manuelle.
