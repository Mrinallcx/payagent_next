-- Supabase Schema for PayAgent Payment Hub
-- Run this in Supabase SQL Editor

-- ============ AGENTS ============
CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  api_key_id TEXT UNIQUE NOT NULL,
  api_secret_encrypted TEXT NOT NULL,
  webhook_secret_hash TEXT NOT NULL,
  wallet_address TEXT,
  chain TEXT DEFAULT 'sepolia',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'pending_verification')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  total_payments_sent INTEGER DEFAULT 0,
  total_payments_received INTEGER DEFAULT 0,
  total_fees_paid NUMERIC DEFAULT 0,
  -- Security: API key expiry
  api_key_expires_at TIMESTAMPTZ,
  -- X (Twitter) verification
  verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  x_username TEXT,
  x_verified_at TIMESTAMPTZ,
  verification_challenge TEXT,
  -- IP tracking
  registered_ip TEXT,
  last_known_ip TEXT,
  ip_change_count INTEGER DEFAULT 0,
  -- Soft delete
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_agents_api_key_id ON agents(api_key_id);
CREATE INDEX IF NOT EXISTS idx_agents_username ON agents(username);
CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status);

-- ============ PAYMENT REQUESTS ============
CREATE TABLE IF NOT EXISTS payment_requests (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  amount TEXT NOT NULL,
  receiver TEXT NOT NULL,
  payer TEXT,
  description TEXT,
  network TEXT NOT NULL DEFAULT 'sepolia',
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PAID', 'EXPIRED', 'CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  tx_hash TEXT,
  paid_at TIMESTAMPTZ,
  creator_wallet TEXT,
  creator_agent_id TEXT REFERENCES agents(id),
  payer_agent_id TEXT REFERENCES agents(id),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON payment_requests(status);
CREATE INDEX IF NOT EXISTS idx_payment_requests_receiver ON payment_requests(receiver);
CREATE INDEX IF NOT EXISTS idx_payment_requests_created_at ON payment_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_requests_creator_wallet ON payment_requests(creator_wallet);
CREATE INDEX IF NOT EXISTS idx_payment_requests_creator_agent ON payment_requests(creator_agent_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_payer_agent ON payment_requests(payer_agent_id);

-- ============ FEE CONFIG (single row) ============
CREATE TABLE IF NOT EXISTS fee_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  lcx_fee_amount NUMERIC NOT NULL DEFAULT 4.00,
  lcx_platform_share NUMERIC NOT NULL DEFAULT 2.00,
  lcx_creator_reward NUMERIC NOT NULL DEFAULT 2.00,
  lcx_contract_address TEXT NOT NULL,
  treasury_wallet TEXT NOT NULL,
  price_cache_ttl_sec INTEGER DEFAULT 300,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============ FEE TRANSACTIONS ============
CREATE TABLE IF NOT EXISTS fee_transactions (
  id TEXT PRIMARY KEY,
  payment_request_id TEXT REFERENCES payment_requests(id),
  payer_agent_id TEXT REFERENCES agents(id),
  creator_agent_id TEXT REFERENCES agents(id),
  payer_wallet TEXT,
  creator_wallet TEXT,
  fee_token TEXT NOT NULL,
  fee_total NUMERIC NOT NULL,
  platform_share NUMERIC NOT NULL,
  creator_reward NUMERIC NOT NULL,
  lcx_price_usd NUMERIC,
  payment_amount NUMERIC,
  payment_token TEXT DEFAULT 'USDC',
  treasury_wallet TEXT,
  platform_fee_tx_hash TEXT,
  creator_reward_tx_hash TEXT,
  payment_tx_hash TEXT,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COLLECTED', 'FAILED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fee_transactions_payment ON fee_transactions(payment_request_id);
CREATE INDEX IF NOT EXISTS idx_fee_transactions_payer ON fee_transactions(payer_agent_id);
CREATE INDEX IF NOT EXISTS idx_fee_transactions_status ON fee_transactions(status);
CREATE INDEX IF NOT EXISTS idx_fee_transactions_creator_wallet ON fee_transactions(creator_wallet);
CREATE INDEX IF NOT EXISTS idx_fee_transactions_payer_wallet ON fee_transactions(payer_wallet);
CREATE INDEX IF NOT EXISTS idx_fee_transactions_creator_agent ON fee_transactions(creator_agent_id);

-- ============ WEBHOOKS ============
CREATE TABLE IF NOT EXISTS webhooks (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  url TEXT NOT NULL,
  secret TEXT NOT NULL,
  events TEXT[] DEFAULT ARRAY['payment.paid', 'payment.created'],
  active BOOLEAN DEFAULT true,
  failure_count INTEGER DEFAULT 0,
  last_failure_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_agent ON webhooks(agent_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhooks(active);

-- ============ CONVERSATIONS (AI chat memory) ============
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  role TEXT NOT NULL CHECK (role IN ('system', 'user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_agent ON conversations(agent_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created ON conversations(agent_id, created_at DESC);

-- ============ TRIGGERS ============
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_payment_requests_updated_at ON payment_requests;
CREATE TRIGGER update_payment_requests_updated_at
  BEFORE UPDATE ON payment_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============ HELPER FUNCTIONS ============
-- Increment agent payment counter
CREATE OR REPLACE FUNCTION increment_agent_counter(agent_id_param TEXT, counter_name TEXT)
RETURNS VOID AS $$
BEGIN
  IF counter_name = 'total_payments_sent' THEN
    UPDATE agents SET total_payments_sent = total_payments_sent + 1 WHERE id = agent_id_param;
  ELSIF counter_name = 'total_payments_received' THEN
    UPDATE agents SET total_payments_received = total_payments_received + 1 WHERE id = agent_id_param;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Increment agent fee total
CREATE OR REPLACE FUNCTION increment_agent_fee(agent_id_param TEXT, fee_amount NUMERIC)
RETURNS VOID AS $$
BEGIN
  UPDATE agents SET total_fees_paid = total_fees_paid + fee_amount WHERE id = agent_id_param;
END;
$$ LANGUAGE plpgsql;

-- ============ API LOGS (audit trail + IP tracking) ============
CREATE TABLE IF NOT EXISTS api_logs (
  id TEXT PRIMARY KEY,
  agent_id TEXT REFERENCES agents(id),
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  status_code INTEGER,
  response_time_ms INTEGER,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_logs_agent ON api_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_api_logs_created ON api_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_logs_ip ON api_logs(ip_address);

-- ============ IP HISTORY (per-agent IP tracking for anomaly detection) ============
CREATE TABLE IF NOT EXISTS ip_history (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id),
  ip_address TEXT NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  request_count INTEGER DEFAULT 1,
  is_vpn BOOLEAN DEFAULT false,
  UNIQUE(agent_id, ip_address)
);

CREATE INDEX IF NOT EXISTS idx_ip_history_agent ON ip_history(agent_id);

-- ============ AUTH NONCES (wallet-based login for dashboard) ============
CREATE TABLE IF NOT EXISTS auth_nonces (
  wallet_address TEXT PRIMARY KEY,
  nonce TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

-- Insert default fee config (run once)
INSERT INTO fee_config (id, lcx_fee_amount, lcx_platform_share, lcx_creator_reward, lcx_contract_address, treasury_wallet, price_cache_ttl_sec)
VALUES (
  'default',
  4.00,
  2.00,
  2.00,
  '0x98d99c88D31C27C5a591Fe7F023F9DB0B37E4B3b',  -- LCX token contract (Sepolia)
  '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',    -- Platform treasury wallet
  300
) ON CONFLICT (id) DO NOTHING;
