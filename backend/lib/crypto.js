const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Get the HMAC encryption key from environment.
 * Must be a 64-char hex string (32 bytes).
 */
function getEncryptionKey() {
  const key = process.env.HMAC_ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error('HMAC_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  }
  return Buffer.from(key, 'hex');
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns a combined string: iv:ciphertext:authTag (all hex-encoded)
 */
function encryptSecret(plaintext) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${encrypted}:${authTag}`;
}

/**
 * Decrypt an AES-256-GCM encrypted string.
 * Input format: iv:ciphertext:authTag (all hex-encoded)
 */
function decryptSecret(encrypted) {
  const key = getEncryptionKey();
  const parts = encrypted.split(':');

  if (parts.length !== 3) {
    throw new Error('Invalid encrypted format. Expected iv:ciphertext:authTag');
  }

  const [ivHex, ciphertext, authTagHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Compute HMAC-SHA256 signature for request verification.
 * @param {string} stringToSign - The canonical string to sign
 * @param {string} secret - The signing secret
 * @returns {string} Hex-encoded HMAC signature
 */
function computeHmac(stringToSign, secret) {
  return crypto.createHmac('sha256', secret).update(stringToSign).digest('hex');
}

/**
 * Build the string-to-sign for HMAC verification.
 * Format: timestamp\nMETHOD\npath\nSHA256(body)
 */
function buildStringToSign(timestamp, method, path, body) {
  const bodyHash = crypto.createHash('sha256').update(body || '').digest('hex');
  return `${timestamp}\n${method}\n${path}\n${bodyHash}`;
}

/**
 * Constant-time comparison of two hex strings.
 * Returns false for length mismatch (without timing leak on content).
 */
function timingSafeEqual(a, b) {
  // Normalize to buffers — if either isn't valid hex, treat as mismatch
  let bufA, bufB;
  try {
    bufA = Buffer.from(a, 'hex');
    bufB = Buffer.from(b, 'hex');
  } catch {
    return false;
  }
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = {
  encryptSecret,
  decryptSecret,
  computeHmac,
  buildStringToSign,
  timingSafeEqual
};
