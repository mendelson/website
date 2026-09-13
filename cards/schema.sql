-- Scan log for printed-card redirects (Cloudflare D1).
--
-- Apply with:
--   npx wrangler d1 execute card-scans --remote --file=./cards/schema.sql
--
-- One row per scan, written fire-and-forget from functions/_middleware.js via
-- context.waitUntil() so it never sits in front of the 302.

CREATE TABLE IF NOT EXISTS scans (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id   TEXT    NOT NULL,           -- lowercased id from the printed URL
  ts_utc     TEXT    NOT NULL,           -- ISO-8601 UTC, e.g. 2026-09-20T14:03:11.204Z
  invalid    INTEGER NOT NULL DEFAULT 0, -- 1 = id is not in cards/batches.json
  user_agent TEXT,
  ip_hash    TEXT,                       -- SHA-256(IP_SALT|ip), 32 hex chars; NULL when IP_SALT is unset
  referrer   TEXT,
  country    TEXT                        -- Cloudflare CF-IPCountry, 2 letters
);

-- The one query this table exists to answer: scans per batch over time.
CREATE INDEX IF NOT EXISTS idx_scans_batch_ts ON scans (batch_id, ts_utc);

-- Surfacing mis-printed cards cheaply.
CREATE INDEX IF NOT EXISTS idx_scans_invalid ON scans (invalid, ts_utc);
