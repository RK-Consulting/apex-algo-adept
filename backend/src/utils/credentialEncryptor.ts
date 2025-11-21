// backend/src/utils/credentialEncryptor.ts
import crypto from "crypto";

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

const SALT = "alphaforge-credentials-v1";
const KEY_LEN = 32;          // AES-256
const ITERATIONS = 100_000;  // PBKDF2 cost

/**
 * Derive AES-256 key from MASTER SECRET
 */
export function getEncryptionKey(): Buffer {
  const master = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!master) {
    throw new Error("CREDENTIALS_ENCRYPTION_KEY is missing in .env");
  }

  return crypto.pbkdf2Sync(master, SALT, ITERATIONS, KEY_LEN, "sha256");
}

/**
 * Encrypt STRING with AES-256-GCM
 */
export function encryptData(
  data: string,
  key: Buffer
): { iv: string; encrypted: string } {
  const iv = crypto.randomBytes(12); // 96-bit recommended IV
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const encrypted = Buffer.concat([
    cipher.update(data, "utf8"),
    cipher.final()
  ]);

  const authTag = cipher.getAuthTag();

  // payload = ciphertext + tag
  const payload = Buffer.concat([encrypted, authTag]).toString("base64");

  return {
    iv: iv.toString("base64"),
    encrypted: payload,
  };
}

/**
 * Decrypt STRING encrypted via encryptData()
 */
export function decryptData(
  encryptedData: string,
  iv: string,
  key: Buffer
): string {
  const ivBuf = Buffer.from(iv, "base64");
  const buf = Buffer.from(encryptedData, "base64");

  const tag = buf.slice(-16);
  const ciphertext = buf.slice(0, -16);

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, ivBuf);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ]).toString("utf8");

  return decrypted;
}

/**
 * Encrypt an OBJECT (auto JSON.stringify)
 */
export function encryptObject(obj: any) {
  const key = getEncryptionKey();
  const json = JSON.stringify(obj);

  return encryptData(json, key);
}

/**
 * Decrypt OBJECT payload back to JS object
 */
export function decryptObject(payload: { iv: string; encrypted: string }) {
  const key = getEncryptionKey();
  const str = decryptData(payload.encrypted, payload.iv, key);
  return JSON.parse(str);
}

export default {
  getEncryptionKey,
  encryptData,
  decryptData,
  encryptObject,
  decryptObject,
};
