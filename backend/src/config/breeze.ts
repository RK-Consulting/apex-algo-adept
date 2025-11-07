// src/config/breeze.ts
import { BreezeConnect } from 'breezeconnect';
import dotenv from 'dotenv';

dotenv.config();

// --- SAFE & STRICT environment variable access ---
const API_KEY = process.env.ICICI_API_KEY;
const API_SECRET = process.env.ICICI_API_SECRET;

// Validate at startup
if (!API_KEY) {
  throw new Error('ICICI_API_KEY is missing in .env');
}
if (!API_SECRET) {
  throw new Error('ICICI_API_SECRET is missing in .env');
}

// --- Initialize Breeze SDK ---
const breeze = new BreezeConnect();
breeze.setApiKey(API_KEY); // Set the appKey

// --- Generate session (called once at startup) ---
export async function initBreezeSession(): Promise<void> {
  try {
    // API_SECRET is guaranteed to be string here
    const session = await breeze.generateSession(API_SECRET);
    console.log('Breeze session initialized:', session);
  } catch (error: any) {
    const message = error?.message || String(error);
    console.error('Breeze session init failed:', message);
    throw new Error(`Breeze session failed: ${message}`);
  }
}

// --- Export the configured breeze instance ---
export { breeze };
