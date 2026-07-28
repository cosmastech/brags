-- Brag warehouse initial schema.
-- Field names mirror skills/brag-capture/RECORD_SCHEMA.md so the skill docs,
-- the API, and the database all speak the same language. Lifecycle state
-- (inbox/active/archived/merged) replaces movement between JSONL directories.

CREATE TABLE brags (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  source TEXT NOT NULL,
  source_url TEXT,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  project TEXT,
  role TEXT,
  impact TEXT,
  tags TEXT NOT NULL DEFAULT '[]',   -- JSON array of strings
  people TEXT NOT NULL DEFAULT '[]', -- JSON array of strings
  visibility TEXT NOT NULL CHECK (visibility IN ('private', 'work_internal', 'public')),
  public_safe INTEGER NOT NULL DEFAULT 0 CHECK (public_safe IN (0, 1)),
  confidence TEXT NOT NULL DEFAULT 'medium' CHECK (confidence IN ('low', 'medium', 'high')),
  needs_review INTEGER NOT NULL DEFAULT 0 CHECK (needs_review IN (0, 1)),
  notes TEXT,
  state TEXT NOT NULL DEFAULT 'inbox' CHECK (state IN ('inbox', 'active', 'archived', 'merged')),
  archive_reason TEXT,
  merged_into TEXT REFERENCES brags (id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_brags_state ON brags (state);
CREATE INDEX idx_brags_date ON brags (date);
CREATE INDEX idx_brags_project ON brags (project);
CREATE INDEX idx_brags_source ON brags (source);

CREATE TABLE evidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brag_id TEXT NOT NULL REFERENCES brags (id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  url TEXT,
  title TEXT,
  visibility TEXT,
  note TEXT
);
CREATE INDEX idx_evidence_brag ON evidence (brag_id);

CREATE TABLE behavioral_evidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brag_id TEXT NOT NULL REFERENCES brags (id) ON DELETE CASCADE,
  signal TEXT NOT NULL,
  supports TEXT NOT NULL DEFAULT '[]', -- JSON array of dimensions
  basis TEXT NOT NULL,
  confidence TEXT NOT NULL CHECK (confidence IN ('low', 'medium', 'high')),
  created_at TEXT NOT NULL
);
CREATE INDEX idx_behavioral_evidence_brag ON behavioral_evidence (brag_id);

CREATE TABLE stories (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready')),
  behaviors TEXT NOT NULL DEFAULT '[]', -- JSON array of signals
  body_md TEXT NOT NULL DEFAULT '',     -- CARL markdown (frontmatter fields live in columns)
  last_reviewed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE story_brags (
  story_id TEXT NOT NULL REFERENCES stories (id) ON DELETE CASCADE,
  brag_id TEXT NOT NULL REFERENCES brags (id),
  PRIMARY KEY (story_id, brag_id)
);

CREATE TABLE story_dimensions (
  story_id TEXT NOT NULL REFERENCES stories (id) ON DELETE CASCADE,
  dimension TEXT NOT NULL CHECK (dimension IN (
    'scope', 'ownership', 'ambiguity', 'perseverance',
    'conflict-resolution', 'growth', 'communication', 'leadership'
  )),
  PRIMARY KEY (story_id, dimension)
);

CREATE TABLE review_decisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brag_id TEXT NOT NULL REFERENCES brags (id),
  decision TEXT NOT NULL CHECK (decision IN ('keep', 'drop', 'merge', 'promote', 'story', 'unarchive')),
  reason TEXT,
  actor TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_review_decisions_brag ON review_decisions (brag_id);
CREATE INDEX idx_review_decisions_created ON review_decisions (created_at);

-- Full-text search over the fields a human or agent would plausibly search.
-- Triggers keep the index in sync on every write path, including imports and merges.
CREATE VIRTUAL TABLE brags_fts USING fts5 (id UNINDEXED, title, summary, role, impact);

CREATE TRIGGER brags_fts_insert AFTER INSERT ON brags BEGIN
  INSERT INTO brags_fts (id, title, summary, role, impact)
  VALUES (new.id, new.title, new.summary, coalesce(new.role, ''), coalesce(new.impact, ''));
END;

CREATE TRIGGER brags_fts_delete AFTER DELETE ON brags BEGIN
  DELETE FROM brags_fts WHERE id = old.id;
END;

CREATE TRIGGER brags_fts_update AFTER UPDATE ON brags BEGIN
  DELETE FROM brags_fts WHERE id = old.id;
  INSERT INTO brags_fts (id, title, summary, role, impact)
  VALUES (new.id, new.title, new.summary, coalesce(new.role, ''), coalesce(new.impact, ''));
END;
