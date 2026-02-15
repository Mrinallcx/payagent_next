-- Migration: Webhook Security (H1 + H5)
-- H5: Rehash existing plaintext webhook secrets
--
-- After this migration, the `secret` column stores SHA256 hashes instead of
-- raw secrets. Existing agents will need to use SHA256(their_raw_secret) for
-- signature verification, or re-register their webhook to get a new secret.
--
-- This is a ONE-WAY operation — raw secrets cannot be recovered.

-- Rehash existing plaintext webhook secrets (those starting with 'whsec_')
UPDATE webhooks
SET secret = encode(sha256(secret::bytea), 'hex')
WHERE secret LIKE 'whsec_%';
