import { BreezeConnect } from 'breezeconnect';
import dotenv from 'dotenv';
dotenv.config();

//const breeze = new BreezeConnect({ appKey: process.env.BREEZE_APP_KEY });
const breeze = new BreezeConnect();
await breeze.generateSession(icici_api_key, icici_api_secret);

export async function initBreezeSession() {
  try {
    await breeze.generateSession(
      process.env.BREEZE_SECRET_KEY!,
      process.env.BREEZE_SESSION_TOKEN!
    );
    console.log('✅ Breeze session initialized');
  } catch (err) {
    console.error('❌ Breeze session init failed:', err);
  }
}

export { breeze };
