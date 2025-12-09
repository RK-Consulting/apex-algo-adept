// backend/src/utils/breezeChecksum.ts
import crypto from "crypto";

/**
 * Produces deterministic, compact JSON for ICICI Breeze checksum.
 */
function stableStringify(obj: Record<string, any>): string {
  const sorted = Object.keys(obj)
    .sort()
    .reduce((acc, key) => {
      acc[key] = obj[key];
      return acc;
    }, {} as Record<string, any>);

  return JSON.stringify(sorted).replace(/\s+/g, "");
}

/**
 * Calculates ICICI Breeze API checksum.
 * Format: SHA256(timestamp + compactJSON + secretKey)
 */
export function calculateChecksum(
  timestamp: string,
  payload: Record<string, any>,
  secretKey: string
): string {
  const compactPayload = stableStringify(payload);
  const checksumInput = timestamp + compactPayload + secretKey;

  return crypto.createHash("sha256").update(checksumInput).digest("hex");
}

/**
 * Timestamp must be ISO 8601 with .000Z
 */
export function getTimestamp(): string {
  return new Date().toISOString().split(".")[0] + ".000Z";
}
