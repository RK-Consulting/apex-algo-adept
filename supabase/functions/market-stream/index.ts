import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mock market data generator for Indian market
const generateMarketData = (symbol: string, exchange: string) => {
  const basePrice = Math.random() * 1000 + 100;
  const change = (Math.random() - 0.5) * 50;
  const changePercent = (change / basePrice) * 100;
  
  return {
    symbol,
    exchange,
    price: parseFloat(basePrice.toFixed(2)),
    change: parseFloat(change.toFixed(2)),
    change_percent: parseFloat(changePercent.toFixed(2)),
    volume: Math.floor(Math.random() * 10000000),
    high: parseFloat((basePrice + Math.random() * 20).toFixed(2)),
    low: parseFloat((basePrice - Math.random() * 20).toFixed(2)),
    open: parseFloat((basePrice + (Math.random() - 0.5) * 10).toFixed(2)),
    previous_close: parseFloat((basePrice - change).toFixed(2)),
    additional_data: {
      market_cap: Math.floor(Math.random() * 1000000000000),
      pe_ratio: parseFloat((Math.random() * 30 + 10).toFixed(2)),
      sector: ['Technology', 'Banking', 'Energy', 'FMCG', 'Auto'][Math.floor(Math.random() * 5)]
    }
  };
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbols } = await req.json();
    console.log('Fetching market data for symbols:', symbols);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Generate and store market data
    const marketDataArray = symbols.map((symbolInfo: { symbol: string, exchange: string }) => 
      generateMarketData(symbolInfo.symbol, symbolInfo.exchange)
    );

    // Insert into database
    const { data, error } = await supabase
      .from('market_data')
      .insert(marketDataArray)
      .select();

    if (error) {
      console.error('Database insert error:', error);
      throw error;
    }

    console.log('Market data stored successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: marketDataArray,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in market-stream:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
