// backend/src/utils/breezeChecksum.ts
import crypto from "crypto";

/**
 * Produces deterministic, compact JSON for ICICI Breeze checksum.
 */
function stableStringify(obj: Record<string, any>): string {
  // If the object is empty, ICICI expects an empty string, not "{}"
  if (Object.keys(obj).length === 0) {
    return "";
  }
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
  //payload: Record<string, any>,
  payload: string,
  secretKey: string
): string {
  // ICICI Formula: Time Stamp + JSONPostData + secret_key
  // const compactPayload = stableStringify(payload);
  // const checksumInput = timestamp + compactPayload + secretKey;
  const checksumInput = timestamp + payload + secretKey;

  return crypto.createHash("sha256").update(checksumInput).digest("hex");
}


export function getTimestamp(): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const now = new Date();
  const date = now.getDate().toString().padStart(2, '0');
  const month = months[now.getMonth()];
  const year = now.getFullYear();
  const time = now.toTimeString().split(' ')[0]; // HH:mm:ss
  
  return `${date}-${month}-${year} ${time}`;
}
