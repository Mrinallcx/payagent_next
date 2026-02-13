-- ============================================================
-- Migration: HMAC Request Signing + Wallet Auth
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================

-- Step 1: Add new HMAC columns to agents table
ALTER TABLE agents ADD COLUMN IF NOT EXISTS api_key_id TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS api_secret_encrypted TEXT;

-- Step 2: Migrate existing data — set placeholder values for existing agents
UPDATE agents
SET api_key_id = 'pk_migrated_' || SUBSTRING(COALESCE(api_key_prefix, id), 1, 32),
    api_secret_encrypted = 'migrated_needs_rotation'
WHERE api_key_id IS NULL;

-- Step 3: Make columns NOT NULL and add unique constraint
ALTER TABLE agents ALTER COLUMN api_key_id SET NOT NULL;
ALTER TABLE agents ALTER COLUMN api_secret_encrypted SET NOT NULL;

-- Add unique constraint on api_key_id (drop old index first if exists)
DROP INDEX IF EXISTS idx_agents_api_key_prefix;
CREATE UNIQUE INDEX IF NOT EXISTS idx_agents_api_key_id ON agents(api_key_id);

-- Step 4: Drop old columns
ALTER TABLE agents DROP COLUMN IF EXISTS api_key_hash;
ALTER TABLE agents DROP COLUMN IF EXISTS api_key_prefix;

-- Step 5: Add security columns (if not already present)
ALTER TABLE agents ADD COLUMN IF NOT EXISTS api_key_expires_at TIMESTAMPTZ;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS x_username TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS x_verified_at TIMESTAMPTZ;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS verification_challenge TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS registered_ip TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS last_known_ip TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS ip_change_count INTEGER DEFAULT 0;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Step 6: Add check constraint for verification_status
-- (ignore error if constraint already exists)
DO $$
BEGIN
  ALTER TABLE agents ADD CONSTRAINT agents_verification_status_check
    CHECK (verification_status IN ('pending', 'verified', 'rejected'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- Step 7: Create new tables

-- Auth nonces (wallet login)
CREATE TABLE IF NOT EXISTS auth_nonces (
  wallet_address TEXT PRIMARY KEY,
  nonce TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);

-- API logs (audit trail)
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

-- IP history (per-agent)
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

-- Step 8: Update the status check constraint to include pending_verification
DO $$
BEGIN
  ALTER TABLE agents DROP CONSTRAINT IF EXISTS agents_status_check;
  ALTER TABLE agents ADD CONSTRAINT agents_status_check
    CHECK (status IN ('active', 'inactive', 'suspended', 'pending_verification'));
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Done! Verify:
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'agents' ORDER BY ordinal_position;
