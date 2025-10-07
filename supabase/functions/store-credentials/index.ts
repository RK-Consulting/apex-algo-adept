import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Encrypt data using AES-GCM
async function encryptData(data: string, key: CryptoKey): Promise<{ encrypted: string; iv: string }> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  
  // Generate a random initialization vector
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Encrypt the data
  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    dataBuffer
  );
  
  // Convert to base64 for storage
  const encryptedArray = new Uint8Array(encryptedBuffer);
  const encrypted = btoa(String.fromCharCode(...encryptedArray));
  const ivBase64 = btoa(String.fromCharCode(...iv));
  
  return { encrypted, iv: ivBase64 };
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
  
  // Derive a key using PBKDF2
  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('alphaforge-credentials-v1'), // Static salt for consistency
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

    const { broker_name, api_key, api_secret } = await req.json();

    // Validate input
    if (!broker_name || !api_key) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: broker_name and api_key are required' }),
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

    // Generate encryption key
    const encryptionKey = await getEncryptionKey(masterSecret);

    // Encrypt API key and secret
    const encryptedApiKey = await encryptData(api_key, encryptionKey);
    const encryptedApiSecret = api_secret 
      ? await encryptData(api_secret, encryptionKey)
      : null;

    // Store encrypted credentials
    const credentialData = {
      user_id: user.id,
      broker_name,
      api_key: JSON.stringify(encryptedApiKey),
      api_secret: encryptedApiSecret ? JSON.stringify(encryptedApiSecret) : null,
    };

    // Check if credentials already exist for this broker
    const { data: existing } = await supabaseClient
      .from('user_credentials')
      .select('id')
      .eq('user_id', user.id)
      .eq('broker_name', broker_name)
      .single();

    let result;
    if (existing) {
      // Update existing credentials
      const { data, error } = await supabaseClient
        .from('user_credentials')
        .update(credentialData)
        .eq('id', existing.id)
        .select()
        .single();
      
      result = { data, error };
    } else {
      // Insert new credentials
      const { data, error } = await supabaseClient
        .from('user_credentials')
        .insert(credentialData)
        .select()
        .single();
      
      result = { data, error };
    }

    if (result.error) {
      console.error('Database error:', result.error);
      return new Response(
        JSON.stringify({ error: 'Failed to store credentials' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Credentials stored for user ${user.id}, broker ${broker_name}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Credentials securely stored',
        credential_id: result.data.id
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in store-credentials:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
