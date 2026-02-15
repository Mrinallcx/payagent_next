-- Migration: Add unique constraint on tx_hash to prevent race condition (Security C4)
-- This allows multiple NULL tx_hash values (pending payments) but prevents
-- two rows from having the same non-null tx_hash.

-- Step 1: Check for existing duplicates (run this query first manually):
-- SELECT tx_hash, COUNT(*) FROM payment_requests
-- WHERE tx_hash IS NOT NULL
-- GROUP BY tx_hash HAVING COUNT(*) > 1;
--
-- If duplicates exist, keep the earliest record and NULL out the rest:
-- UPDATE payment_requests SET tx_hash = NULL
-- WHERE id NOT IN (
--   SELECT DISTINCT ON (tx_hash) id FROM payment_requests
--   WHERE tx_hash IS NOT NULL ORDER BY tx_hash, paid_at ASC
-- ) AND tx_hash IS NOT NULL AND tx_hash IN (
--   SELECT tx_hash FROM payment_requests WHERE tx_hash IS NOT NULL
--   GROUP BY tx_hash HAVING COUNT(*) > 1
-- );

-- Step 2: Create the unique partial index
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_requests_tx_hash_unique
  ON payment_requests(tx_hash) WHERE tx_hash IS NOT NULL;
