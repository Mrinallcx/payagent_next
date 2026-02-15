-- Migration: Webhook Secret Encryption (H3 fix)
--
-- Previous migration (migration-webhook-security.sql) hashed secrets with SHA256.
-- SHA256 is one-way — we cannot recover the raw secret from the hash.
-- The new code encrypts secrets with AES-256-GCM (reversible) so the server
-- can decrypt them at signing time, producing HMAC signatures the receiver
-- can actually verify.
--
-- This migration deactivates any webhooks whose secrets are irreversible
-- SHA256 hashes (64-char lowercase hex strings). Agents must delete and
-- re-register these webhooks to get a new encrypted secret.

-- Deactivate webhooks with hashed secrets (irreversible SHA256 from old migration)
UPDATE webhooks
SET active = false
WHERE length(secret) = 64
  AND secret ~ '^[a-f0-9]{64}$';
