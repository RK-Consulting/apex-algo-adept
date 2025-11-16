// src/config/breeze.ts
/**
 * 🚨 IMPORTANT NOTICE:
 * Breeze should NOT be initialized globally anymore.
 *
 * Your backend now uses per-user ICICI credentials stored in Postgres,
 * and all authenticated sessions must be generated via:
 *
 *    getBreezeInstance(userId)
 *
 * located in: src/utils/breezeSession.ts
 *
 * This file provides a safe stub ONLY to prevent old imports from breaking.
 * DO NOT use this exported instance for live trading, quotes or orders.
 */

import { BreezeConnect } from "breezeconnect";

// ⚠️ Create a low-privilege placeholder instance.
// This instance should NOT be used for trading or data fetching.
// It allows legacy imports to stay functional without breaking the app.
const breeze = new BreezeConnect();

// Soft warning to remind developers
if (process.env.NODE_ENV !== "production") {
  console.warn(
    "[WARN] src/config/breeze.ts loaded. This global Breeze instance is deprecated. " +
      "Use getBreezeInstance(userId) instead."
  );
}

/**
 * @deprecated DO NOT USE.
 * Exported only to avoid breaking legacy code.
 * Live trading must always use getBreezeInstance().
 */
export { breeze };

/**
 * @deprecated DO NOT USE.
 * Included for backward compatibility ONLY.
 */
export async function initBreezeSession(): Promise<void> {
  console.warn(
    "[WARN] initBreezeSession() called — this function is no longer required. " +
      "All sessions are now user-specific via getBreezeInstance()."
  );
}
