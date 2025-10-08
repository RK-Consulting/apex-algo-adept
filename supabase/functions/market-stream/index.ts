import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Base prices for consistent data (realistic Indian stock prices)
const BASE_PRICES: Record<string, number> = {
  'RELIANCE': 2456.70,
  'TCS': 3789.20,
  'INFY': 1567.45,
  'HDFCBANK': 1678.90,
  'ICICIBANK': 987.35,
  'NIFTY': 21453.25,
  'SENSEX': 71283.45,
  'BANKNIFTY': 46789.30,
  'INDIAVIX': 12.45,
};

const generateMarketData = async (symbol: string, exchange: string, supabase: any) => {
  // Get the last price from database or use base price
  const { data: lastData } = await supabase
    .from('market_data')
    .select('price, volume')
    .eq('symbol', symbol)
    .eq('exchange', exchange)
    .order('timestamp', { ascending: false })
    .limit(1)
    .maybeSingle();

  const basePrice = lastData?.price || BASE_PRICES[symbol] || 1000;
  
  // Small realistic price movements (0.05% to 0.5%)
  const changePercent = (Math.random() - 0.5) * 1.0; // -0.5% to +0.5%
  const change = (basePrice * changePercent) / 100;
  const newPrice = basePrice + change;

  // Volume should be realistic and not change drastically
  const baseVolume = lastData?.volume || Math.floor(Math.random() * 5000000 + 1000000);
  const volumeChange = (Math.random() - 0.5) * 0.2; // -10% to +10% volume change
  const newVolume = Math.floor(baseVolume * (1 + volumeChange));

  const openPrice = basePrice - (Math.random() - 0.5) * basePrice * 0.01;
  const highPrice = Math.max(newPrice, openPrice) + Math.random() * basePrice * 0.005;
  const lowPrice = Math.min(newPrice, openPrice) - Math.random() * basePrice * 0.005;

  return {
    symbol,
    exchange,
    price: parseFloat(newPrice.toFixed(2)),
    change: parseFloat(change.toFixed(2)),
    change_percent: parseFloat(changePercent.toFixed(2)),
    volume: newVolume,
    open: parseFloat(openPrice.toFixed(2)),
    high: parseFloat(highPrice.toFixed(2)),
    low: parseFloat(lowPrice.toFixed(2)),
    previous_close: parseFloat(basePrice.toFixed(2)),
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
    const marketDataArray = await Promise.all(
      symbols.map((symbolInfo: { symbol: string, exchange: string }) => 
        generateMarketData(symbolInfo.symbol, symbolInfo.exchange, supabase)
      )
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
