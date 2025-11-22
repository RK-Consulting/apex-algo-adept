// backend/src/utils/credentialEncryptor.ts
/**
 * ************************************************************
 *  Unified Encryption Utility for AlphaForge
 *  -----------------------------------------------------------
 *  - AES-256-GCM encryption
 *  - PBKDF2 key derivation
 *  - Supports both STRING and OBJECT encryption
 *  - Used by:
 *       • iciciBroker.ts
 *       • breezeSession.ts
 *       • authCallback.ts
 * ************************************************************
 */

import crypto from "crypto";

const SALT = "alphaforge-credentials-v1";
const KEY_LEN = 32; // AES-256
const ITERATIONS = 100_000;
const DIGEST = "sha256";

/**
 * Derive a strong AES key from the master secret in .env
 * Throws if CREDENTIALS_ENCRYPTION_KEY is missing.
 */
export function getEncryptionKey(): Buffer {
  const masterSecret = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!masterSecret) {
    throw new Error("CREDENTIALS_ENCRYPTION_KEY missing in environment");
  }
  return crypto.pbkdf2Sync(masterSecret, SALT, ITERATIONS, KEY_LEN, DIGEST);
}

/**
 * Encrypt a string (utf8) or object (JSON) using AES-256-GCM.
 * Returns { encrypted: base64, iv: base64 } where encrypted = ciphertext + authTag.
 */
export function encryptDataRaw(data: string | object, key?: Buffer) {
  const k = key ?? getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", k, iv);

  const plain = typeof data === "string" ? data : JSON.stringify(data);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const payload = Buffer.concat([encrypted, authTag]).toString("base64");
  return { encrypted: payload, iv: iv.toString("base64") };
}

/**
 * Decrypt previously encrypted blob produced by encryptDataRaw.
 * Returns string — caller can JSON.parse if it stored an object.
 */
export function decryptDataRaw(encryptedData: string, ivBase64: string, key?: Buffer): string {
  const k = key ?? getEncryptionKey();
  const iv = Buffer.from(ivBase64, "base64");
  const buf = Buffer.from(encryptedData, "base64");
  const authTag = buf.slice(-16);
  const enc = buf.slice(0, -16);

  const decipher = crypto.createDecipheriv("aes-256-gcm", k, iv);
  decipher.setAuthTag(authTag);
  const out = Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
  return out;
}

/**
 * Convenience: encrypt an object and return JSON-ready blob
 */
export function encryptJSON(obj: any) {
  return encryptDataRaw(obj);
}

/**
 * Convenience: decrypt JSON blob previously saved with encryptJSON
 */
export function decryptJSON(payload: { encrypted: string; iv: string }) {
  const s = decryptDataRaw(payload.encrypted, payload.iv);
  return JSON.parse(s);
}

export default {
  getEncryptionKey,
  encryptDataRaw,
  decryptDataRaw,
  encryptJSON,
  decryptJSON,
};
