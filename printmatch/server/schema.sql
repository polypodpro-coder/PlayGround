-- Explicit migration; never run automatically when starting the HTTP server.
CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY, auth_subject text NOT NULL UNIQUE,
  name text NOT NULL, email text NOT NULL, email_verified boolean NOT NULL DEFAULT false,
  blocked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS auth_sessions (
  session_key text PRIMARY KEY, encrypted_payload text NOT NULL, expires_at timestamptz NOT NULL
);
-- Retain logout tombstones until every pre-logout session could have expired.
ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS revoked_at timestamptz;
CREATE INDEX IF NOT EXISTS auth_sessions_expiry ON auth_sessions(expires_at);
CREATE TABLE IF NOT EXISTS sellers (
  id uuid PRIMARY KEY, legal_name text NOT NULL CHECK (length(legal_name) BETWEEN 1 AND 200),
  stripe_account_id text NOT NULL UNIQUE CHECK (stripe_account_id ~ '^acct_[A-Za-z0-9]+$'),
  country text NOT NULL CHECK (country = 'US'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'suspended'))
);
CREATE TABLE IF NOT EXISTS seller_members (
  seller_id uuid NOT NULL REFERENCES sellers(id), user_id uuid NOT NULL REFERENCES app_users(id),
  role text NOT NULL CHECK (role IN ('owner', 'operator')), PRIMARY KEY (seller_id, user_id)
);
-- Accepted quote creation is deliberately not a public endpoint. It requires a
-- separately reviewed quote/acceptance workflow; no sample fixtures are inserted.
CREATE TABLE IF NOT EXISTS quotes (
  id uuid PRIMARY KEY, buyer_id uuid NOT NULL REFERENCES app_users(id),
  seller_id uuid NOT NULL REFERENCES sellers(id), version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('draft', 'accepted', 'withdrawn')),
  expires_at timestamptz NOT NULL, accepted_at timestamptz,
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  CHECK (status <> 'accepted' OR accepted_at IS NOT NULL)
);
CREATE OR REPLACE FUNCTION protect_accepted_quote() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.accepted_at IS NOT NULL AND (NEW.buyer_id, NEW.seller_id, NEW.version, NEW.expires_at, NEW.accepted_at, NEW.data)
      IS DISTINCT FROM (OLD.buyer_id, OLD.seller_id, OLD.version, OLD.expires_at, OLD.accepted_at, OLD.data) THEN
    RAISE EXCEPTION 'Accepted quote revisions are immutable';
  END IF;
  IF OLD.accepted_at IS NOT NULL AND OLD.status <> 'accepted' AND NEW.status = 'accepted' THEN
    RAISE EXCEPTION 'A withdrawn accepted quote requires a new revision record';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS accepted_quote_immutable ON quotes;
CREATE TRIGGER accepted_quote_immutable BEFORE UPDATE ON quotes FOR EACH ROW EXECUTE FUNCTION protect_accepted_quote();
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY, quote_id uuid NOT NULL UNIQUE REFERENCES quotes(id),
  buyer_id uuid NOT NULL REFERENCES app_users(id), seller_id uuid NOT NULL REFERENCES sellers(id),
  seller_account_id text NOT NULL, quote_version integer NOT NULL,
  snapshot jsonb NOT NULL, total_cents integer NOT NULL CHECK (total_cents > 0 AND total_cents <= 10000000),
  currency text NOT NULL CHECK (currency = 'usd'), provider_key text NOT NULL UNIQUE,
  checkout_session_id text UNIQUE, checkout_expires_at timestamptz NOT NULL,
  payment_intent_id text, payment_state text NOT NULL DEFAULT 'pending'
    CHECK (payment_state IN ('pending', 'paid', 'expired', 'failed', 'review')),
  fulfillment_state text NOT NULL DEFAULT 'not_started'
    CHECK (fulfillment_state IN ('not_started', 'accepted', 'printing', 'shipped', 'delivered', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(), paid_at timestamptz,
  CHECK (fulfillment_state IN ('not_started', 'cancelled') OR payment_state = 'paid')
);
CREATE INDEX IF NOT EXISTS orders_buyer ON orders(buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_seller ON orders(seller_id, created_at DESC);
CREATE TABLE IF NOT EXISTS stripe_events (
  event_id text PRIMARY KEY, connected_account_id text NOT NULL,
  event_type text NOT NULL, received_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  action text NOT NULL, actor_id uuid, order_id uuid, provider_event_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION protect_order_financials() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.quote_id, NEW.buyer_id, NEW.seller_id, NEW.seller_account_id, NEW.quote_version,
      NEW.snapshot, NEW.total_cents, NEW.currency, NEW.provider_key, NEW.checkout_expires_at, NEW.created_at)
     IS DISTINCT FROM
     (OLD.quote_id, OLD.buyer_id, OLD.seller_id, OLD.seller_account_id, OLD.quote_version,
      OLD.snapshot, OLD.total_cents, OLD.currency, OLD.provider_key, OLD.checkout_expires_at, OLD.created_at) THEN
    RAISE EXCEPTION 'Order financial and acceptance snapshots are immutable';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS order_financials_immutable ON orders;
CREATE TRIGGER order_financials_immutable BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION protect_order_financials();

