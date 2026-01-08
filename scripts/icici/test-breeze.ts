import { BreezeConnect } from "breezeconnect";
import * as readline from "readline";

// Define the shape of the SDK instance to handle the "mutated state" properties
interface BreezeInstance extends BreezeConnect {
  session_token?: string;
}

const config = {
  appKey: "YOUR_API_KEY",
  appSecret: "YOUR_API_SECRET",
};

const breeze = new BreezeConnect({ appKey: config.appKey }) as BreezeInstance;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const validateBreeze = async (): Promise<void> => {
  console.log("--- ICICI Breeze TypeScript Session Validator ---");

  const loginUrl = `https://api.icicidirect.com/apiuser/login?api_key=${encodeURIComponent(config.appKey)}`;
  console.log(`\n1. Open this URL in your browser:\n${loginUrl}`);

  rl.question('\n2. Paste the "apisession" value from the redirect URL: ', async (apiSessionInput: string) => {
    try {
      console.log("\n3. Exchanging apisession for session_token...");

      // Note: The Node SDK uses snake_case for generate_session
      await breeze.generate_session(config.appSecret, apiSessionInput);

      // Accessing the internal state after mutation
      const token = breeze.session_token;

      if (token) {
        console.log("✅ SUCCESS!");
        console.log(`Your Session Token: ${token}`);

        console.log("\n4. Testing Funds API...");
        const funds: any = await breeze.get_funds();
        console.log("Funds Response:", JSON.stringify(funds.Success || funds.Error, null, 2));
      } else {
        console.error("❌ FAILURE: breeze.session_token is still undefined.");
      }
    } catch (err) {
      const error = err as Error;
      console.error("❌ ERROR during validation:", error.message);
    } finally {
      rl.close();
    }
  });
};

validateBreeze();
