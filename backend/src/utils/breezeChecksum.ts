// backend/src/utils/breezeChecksum.ts
import crypto from "crypto";

/**
 * Calculates ICICI Breeze API checksum.
 * Format: SHA256(timestamp + compactJSON + secretKey)
 */
export function calculateChecksum(
  timestamp: string,
  payload: Record<string, any>,
  secretKey: string
): string {
  // Compact JSON → removes whitespace/newlines
  const compactPayload = JSON.stringify(payload).replace(/\s+/g, "");
  const checksumInput = timestamp + compactPayload + secretKey;

  return crypto.createHash("sha256").update(checksumInput).digest("hex");
}

/**
 * Timestamp must be ISO 8601 with .000Z
 */
export function getTimestamp(): string {
  return new Date().toISOString().split(".")[0] + ".000Z";
}
