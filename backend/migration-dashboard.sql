-- Migration: Add wallet columns to fee_transactions for human payer tracking
-- Run this in Supabase SQL Editor

-- Add payer_wallet and creator_wallet to fee_transactions
ALTER TABLE fee_transactions ADD COLUMN IF NOT EXISTS payer_wallet TEXT;
ALTER TABLE fee_transactions ADD COLUMN IF NOT EXISTS creator_wallet TEXT;

-- Drop the restrictive fee_token CHECK constraint (we now support any payment token as fee)
ALTER TABLE fee_transactions DROP CONSTRAINT IF EXISTS fee_transactions_fee_token_check;

-- Add indexes for wallet-based reward queries
CREATE INDEX IF NOT EXISTS idx_fee_transactions_creator_wallet ON fee_transactions(creator_wallet);
CREATE INDEX IF NOT EXISTS idx_fee_transactions_payer_wallet ON fee_transactions(payer_wallet);
CREATE INDEX IF NOT EXISTS idx_fee_transactions_creator_agent ON fee_transactions(creator_agent_id);
