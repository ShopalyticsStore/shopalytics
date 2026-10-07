-- Shopalytics fixture schema.
--
-- Applied by `scripts/db/setup.ts`, which creates the target schema and sets
-- `search_path` before running this file, so nothing here is schema-qualified.
-- Every identifier is supplied by the deterministic fixture generator, so the
-- schema needs no UUID generation extension.

DROP TABLE IF EXISTS utrace_preview_handoff_consumption CASCADE;
DROP TABLE IF EXISTS fixture_manifest CASCADE;
DROP TABLE IF EXISTS saved_views CASCADE;
DROP TABLE IF EXISTS customer_review_topics CASCADE;
DROP TABLE IF EXISTS customer_reviews CASCADE;
DROP TABLE IF EXISTS conversion_daily_metrics CASCADE;
DROP TABLE IF EXISTS conversion_states CASCADE;
DROP TABLE IF EXISTS review_topics CASCADE;
DROP TABLE IF EXISTS demographic_segments CASCADE;
DROP TABLE IF EXISTS traffic_sources CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;

CREATE TABLE accounts (
  id uuid PRIMARY KEY,
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL
);

CREATE TABLE users (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  role text NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE products (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name text NOT NULL
);

CREATE TABLE saved_views (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  filters jsonb NOT NULL,
  date_range_preset text NOT NULL CHECK (date_range_preset IN ('last_7_days', 'last_30_days', 'last_90_days', 'custom')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_saved_views_owner ON saved_views(account_id, user_id);

CREATE TABLE traffic_sources (
  id uuid PRIMARY KEY,
  name text NOT NULL UNIQUE
);

CREATE TABLE demographic_segments (
  id uuid PRIMARY KEY,
  name text NOT NULL UNIQUE
);

CREATE TABLE review_topics (
  id uuid PRIMARY KEY,
  name text NOT NULL UNIQUE
);

-- The terminal funnel state of a session cohort. The dashboard's conversion
-- state filter selects which of these the displayed series counts.
CREATE TABLE conversion_states (
  id uuid PRIMARY KEY,
  key text NOT NULL UNIQUE,
  name text NOT NULL UNIQUE,
  ordinal integer NOT NULL UNIQUE
);

-- One row per (product, channel, segment, conversion state, day). `sessions`
-- counts the sessions that ended in that state; the funnel counters carry the
-- stages that cohort reached, so any slice sums exactly.
CREATE TABLE conversion_daily_metrics (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  traffic_source_id uuid NOT NULL REFERENCES traffic_sources(id) ON DELETE CASCADE,
  demographic_segment_id uuid NOT NULL REFERENCES demographic_segments(id) ON DELETE CASCADE,
  conversion_state_id uuid NOT NULL REFERENCES conversion_states(id) ON DELETE CASCADE,
  date date NOT NULL,
  sessions integer NOT NULL,
  product_views integer NOT NULL,
  add_to_carts integer NOT NULL,
  checkouts integer NOT NULL,
  purchases integer NOT NULL,
  revenue_cents bigint NOT NULL
);

CREATE INDEX idx_cdm_account_date ON conversion_daily_metrics(account_id, date);
CREATE INDEX idx_cdm_product ON conversion_daily_metrics(product_id);
CREATE INDEX idx_cdm_source ON conversion_daily_metrics(traffic_source_id);
CREATE INDEX idx_cdm_segment ON conversion_daily_metrics(demographic_segment_id);
CREATE INDEX idx_cdm_state ON conversion_daily_metrics(conversion_state_id);

-- Reviewer fields hold shape-preserving synthetic personal data.
CREATE TABLE customer_reviews (
  id uuid PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  traffic_source_id uuid NOT NULL REFERENCES traffic_sources(id) ON DELETE CASCADE,
  demographic_segment_id uuid NOT NULL REFERENCES demographic_segments(id) ON DELETE CASCADE,
  date date NOT NULL,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  sentiment text NOT NULL CHECK (sentiment IN ('positive', 'neutral', 'negative')),
  body text NOT NULL,
  reviewer_name text NOT NULL,
  reviewer_email text NOT NULL,
  reviewer_location text NOT NULL
);

CREATE INDEX idx_cr_account_date ON customer_reviews(account_id, date);
CREATE INDEX idx_cr_product ON customer_reviews(product_id);
CREATE INDEX idx_cr_source ON customer_reviews(traffic_source_id);
CREATE INDEX idx_cr_segment ON customer_reviews(demographic_segment_id);
CREATE INDEX idx_cr_sentiment ON customer_reviews(sentiment);

CREATE TABLE customer_review_topics (
  review_id uuid NOT NULL REFERENCES customer_reviews(id) ON DELETE CASCADE,
  topic_id uuid NOT NULL REFERENCES review_topics(id) ON DELETE CASCADE,
  PRIMARY KEY (review_id, topic_id)
);

-- The installed dataset identity. `GET /api/health` reports it so a runtime can
-- prove which approved fixture it holds.
CREATE TABLE fixture_manifest (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  fixture_id text NOT NULL,
  schema_version text NOT NULL,
  content_hash text NOT NULL,
  fixture_clock text NOT NULL,
  environment_template_id text NOT NULL,
  environment_template_revision integer NOT NULL,
  seed_target text NOT NULL,
  document jsonb NOT NULL,
  installed_at timestamptz NOT NULL DEFAULT now()
);

-- One row per consumed preview handoff token. The primary key is what makes a
-- token single-use across processes and restarts.
CREATE TABLE utrace_preview_handoff_consumption (
  token_id uuid PRIMARY KEY,
  subject_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  consumed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX idx_handoff_expires ON utrace_preview_handoff_consumption(expires_at);
