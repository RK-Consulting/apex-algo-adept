// src/config/breeze.ts
import { BreezeConnect } from 'breezeconnect';
import dotenv from 'dotenv';

dotenv.config();

// Validate required environment variables
const API_KEY = process.env.ICICI_API_KEY;
const API_SECRET = process.env.ICICI_API_SECRET;

if (!API_KEY || !API_SECRET) {
  throw new Error('ICICI_API_KEY and ICICI_API_SECRET must be set in .env');
}

// Initialize BreezeConnect with API key
const breeze = new BreezeConnect({
  appKey: API_KEY,
});

// Function to generate session (must be called after login)
export async function initBreezeSession(): Promise<void> {
  try {
    const session = await breeze.generateSession(API_SECRET);
    console.log('Breeze session initialized:', session);
  } catch (error: any) {
    console.error('Breeze session init failed:', error.message || error);
    throw error;
  }
}

// Export the breeze instance
export { breeze };
