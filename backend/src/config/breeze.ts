// src/config/breeze.ts  ←  Keep the same path so old imports BREAK LOUDLY

/**
 * GLOBAL BREEZE INSTANCE IS DEAD.
 *
 * You are trying to import the old global Breeze instance.
 * This has been removed because it causes:
 *   • All users sharing one ICICI account
 *   • Silent session corruption
 *   • Impossible horizontal scaling
 *
 * USE PER-USER INSTANCES INSTEAD:
 *
 *   import { getBreezeInstance } from "../utils/breezeSession.js";
 *   const breeze = await getBreezeInstance(userId);
 *
 * If you're seeing this error, fix your code NOW.
 */

throw new Error(
  `[FATAL] Global Breeze instance is forbidden!\n` +
  `→ You imported src/config/breeze.ts\n` +
  `→ This file was removed for security and correctness.\n\n` +
  `Fix: Use getBreezeInstance(userId) from src/utils/breezeSession.ts instead.\n\n` +
  `Stack trace (so you know exactly which file is wrong):`
);
