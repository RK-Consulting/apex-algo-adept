import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Decrypt data using AES-GCM
async function decryptData(encryptedData: string, iv: string, key: CryptoKey): Promise<string> {
  // Convert from base64
  const encryptedArray = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
  const ivArray = Uint8Array.from(atob(iv), c => c.charCodeAt(0));
  
  // Decrypt the data
  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: ivArray,
    },
    key,
    encryptedArray
  );
  
  // Convert back to string
  const decoder = new TextDecoder();
  return decoder.decode(decryptedBuffer);
}

// Derive encryption key from master secret
async function getEncryptionKey(masterSecret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(masterSecret),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  
  // Derive a key using PBKDF2 (must match store-credentials)
  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('alphaforge-credentials-v1'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Verify user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { broker_name } = await req.json();

    if (!broker_name) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: broker_name' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get encryption master secret
    const masterSecret = Deno.env.get('CREDENTIALS_ENCRYPTION_KEY');
    if (!masterSecret) {
      console.error('CREDENTIALS_ENCRYPTION_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Retrieve encrypted credentials
    const { data: credentials, error: dbError } = await supabaseClient
      .from('user_credentials')
      .select('api_key, api_secret, broker_name')
      .eq('user_id', user.id)
      .eq('broker_name', broker_name)
      .single();

    if (dbError || !credentials) {
      console.log(`No credentials found for user ${user.id}, broker ${broker_name}`);
      return new Response(
        JSON.stringify({ error: 'Credentials not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate decryption key
    const encryptionKey = await getEncryptionKey(masterSecret);

    // Decrypt API key
    const apiKeyData = JSON.parse(credentials.api_key);
    const decryptedApiKey = await decryptData(apiKeyData.encrypted, apiKeyData.iv, encryptionKey);

    // Decrypt API secret if present
    let decryptedApiSecret = null;
    if (credentials.api_secret) {
      const apiSecretData = JSON.parse(credentials.api_secret);
      decryptedApiSecret = await decryptData(apiSecretData.encrypted, apiSecretData.iv, encryptionKey);
    }

    console.log(`Credentials retrieved for user ${user.id}, broker ${broker_name}`);

    // Return decrypted credentials (only to be used server-side)
    return new Response(
      JSON.stringify({
        broker_name: credentials.broker_name,
        api_key: decryptedApiKey,
        api_secret: decryptedApiSecret,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in retrieve-credentials:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
