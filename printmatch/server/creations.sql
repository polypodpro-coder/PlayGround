-- Run after server/schema.sql with migration credentials; never at HTTP startup.
-- User-exported STL bytes only. No image, provider API credential or asset URL is stored.
CREATE TABLE IF NOT EXISTS creations (
  id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES app_users(id),
  title text NOT NULL CHECK(length(title) BETWEEN 1 AND 120),
  file_name text NOT NULL CHECK(file_name ~ '^[a-z0-9-]+[.]stl$'),
  source text NOT NULL CHECK(source='meshy'),
  source_units text NOT NULL CHECK(source_units IN ('mm','cm','in')),
  notes text NOT NULL DEFAULT '' CHECK(length(notes)<=2000),
  model_bytes bytea NOT NULL CHECK(octet_length(model_bytes) BETWEEN 1 AND 10485760),
  sha256 text NOT NULL CHECK(sha256 ~ '^[a-f0-9]{64}$'),
  byte_length integer NOT NULL CHECK(byte_length=octet_length(model_bytes)),
  triangle_count integer NOT NULL CHECK(triangle_count BETWEEN 1 AND 150000),
  consent_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS creations_owner_date ON creations(owner_id,created_at DESC);
CREATE OR REPLACE FUNCTION protect_creation_source() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.id,NEW.owner_id,NEW.file_name,NEW.source,NEW.source_units,NEW.model_bytes,
      NEW.sha256,NEW.byte_length,NEW.triangle_count,NEW.consent_at,NEW.created_at)
     IS DISTINCT FROM
     (OLD.id,OLD.owner_id,OLD.file_name,OLD.source,OLD.source_units,OLD.model_bytes,
      OLD.sha256,OLD.byte_length,OLD.triangle_count,OLD.consent_at,OLD.created_at) THEN
    RAISE EXCEPTION 'Imported model source, units, ownership and acceptance are immutable';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS creation_source_immutable ON creations;
CREATE TRIGGER creation_source_immutable BEFORE UPDATE ON creations FOR EACH ROW EXECUTE FUNCTION protect_creation_source();

CREATE TABLE IF NOT EXISTS creation_shares (
  id uuid PRIMARY KEY, creation_id uuid NOT NULL REFERENCES creations(id),
  seller_id uuid NOT NULL REFERENCES sellers(id), notes text NOT NULL DEFAULT '' CHECK(length(notes)<=2000),
  -- Review intent only: this never rewrites or silently rescales the source STL.
  target_height_mm double precision CHECK(target_height_mm>0 AND target_height_mm<=2000),
  consent_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz, request_version integer NOT NULL DEFAULT 1 CHECK(request_version>0),
  UNIQUE(creation_id,seller_id)
);
CREATE INDEX IF NOT EXISTS creation_shares_seller ON creation_shares(seller_id,created_at DESC) WHERE revoked_at IS NULL;
CREATE TABLE IF NOT EXISTS creation_offers (
  share_id uuid NOT NULL REFERENCES creation_shares(id), request_version integer NOT NULL CHECK(request_version>0),
  author_id uuid NOT NULL REFERENCES app_users(id),
  production_cents integer NOT NULL CHECK(production_cents BETWEEN 1 AND 10000000),
  fulfillment_cents integer NOT NULL CHECK(fulfillment_cents BETWEEN 0 AND 100000),
  lead_days integer NOT NULL CHECK(lead_days BETWEEN 1 AND 90),
  notes text NOT NULL DEFAULT '' CHECK(length(notes)<=2000),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(share_id,request_version)
);
-- Offers are private and nonbinding. They do not enter the payment quotes/orders
-- tables and cannot enable payment, manufacturing or messaging on their own.

