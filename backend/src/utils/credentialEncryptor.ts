// backend/src/utils/credentialEncryptor.ts
import crypto from "crypto";

/**
 * PBKDF2 → AES-256-GCM Encryption for API keys & Secrets
 * Used in:
 *   - iciciBroker.ts (store / retrieve)
 *   - icici/authCallback.ts (OAuth callback storing token)
 */

const SALT = "alphaforge-credentials-v1";
const KEY_LEN = 32; // AES-256
const ITERATIONS = 100_000;

/**
 * Derive strong AES key from master secret in .env
 */
export function getEncryptionKey(): Buffer {
  const masterSecret = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!masterSecret) {
    throw new Error("CREDENTIALS_ENCRYPTION_KEY missing in .env");
  }

  return crypto.pbkdf2Sync(
    masterSecret,
    SALT,
    ITERATIONS,
    KEY_LEN,
    "sha256"
  );
}

/**
 * Encrypt a string using AES-256-GCM
 */
export function encryptData(
  data: string,
  key: Buffer
): { encrypted: string; iv: string } {
  const iv = crypto.randomBytes(12); // 96-bit GCM IV
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  let encrypted = cipher.update(data, "utf8", "base64");
  encrypted += cipher.final("base64");

  const authTag = cipher.getAuthTag(); // 16 bytes

  // Append authTag to encrypted text
  const encryptedWithTag = Buffer.concat([
    Buffer.from(encrypted, "base64"),
    authTag
  ]).toString("base64");

  return {
    encrypted: encryptedWithTag,
    iv: iv.toString("base64"),
  };
}

/**
 * Decrypt AES-256-GCM output
 */
export function decryptData(
  encryptedData: string,
  iv: string,
  key: Buffer
): string {
  const ivBuf = Buffer.from(iv, "base64");
  const encryptedBuf = Buffer.from(encryptedData, "base64");

  // Extract last 16 bytes = authTag
  const authTag = encryptedBuf.slice(-16);
  const encrypted = encryptedBuf.slice(0, -16);

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, ivBuf);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, undefined, "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

export default {
  getEncryptionKey,
  encryptData,
  decryptData,
};
