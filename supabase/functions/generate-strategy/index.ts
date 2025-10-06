import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const allowedOrigins = [
  'https://alphaforge.lovable.app',
  'http://localhost:5173',
  'http://localhost:8080'
];

const getCorsHeaders = (origin: string | null) => {
  const allowedOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
};

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    // Rate limiting check: max 10 strategies per hour
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const { count, error: countError } = await supabase
      .from('strategies')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', oneHourAgo);

    if (countError) {
      console.error('Rate limit check error:', countError);
    } else if (count && count >= 10) {
      return new Response(
        JSON.stringify({ 
          error: 'Rate limit exceeded. You can create maximum 10 strategies per hour.'
        }),
        { 
          status: 429, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const { name, trading_style, capital_allocation, risk_level, description } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    // Call Lovable AI to generate strategy
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are an expert algorithmic trading strategy designer for the Indian stock market. Generate detailed trading strategies with specific entry/exit rules, risk management parameters, and technical indicators. Return structured JSON data only.`
          },
          {
            role: 'user',
            content: `Generate a ${risk_level} risk ${trading_style} trading strategy for the Indian stock market.
            
Strategy Name: ${name}
Capital: ₹${capital_allocation}
Description: ${description || 'Not provided'}

Please provide:
1. Entry conditions (specific technical indicators and thresholds)
2. Exit conditions (take profit, stop loss levels)
3. Position sizing rules
4. Risk management parameters
5. Recommended instruments (stocks, indices, derivatives)
6. Timeframe specifications
7. Expected metrics (win rate estimate, max drawdown, profit target)

Format the response as a JSON object with these keys: entry_rules, exit_rules, position_sizing, risk_management, recommended_instruments, timeframe, expected_metrics, reasoning.`
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const strategyContent = aiData.choices[0].message.content;
    console.log('AI generated strategy:', strategyContent);

    // Parse the AI response
    let strategyConfig;
    try {
      // Try to extract JSON from the response
      const jsonMatch = strategyContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        strategyConfig = JSON.parse(jsonMatch[0]);
      } else {
        // If no JSON found, structure the text response
        strategyConfig = {
          raw_response: strategyContent,
          entry_rules: "See raw_response for details",
          exit_rules: "See raw_response for details",
          position_sizing: "See raw_response for details",
          risk_management: "See raw_response for details",
          recommended_instruments: ["NIFTY", "BANKNIFTY"],
          timeframe: trading_style,
          expected_metrics: {
            win_rate: "65-75%",
            max_drawdown: "15-20%",
            profit_target: "15-25%"
          }
        };
      }
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      strategyConfig = {
        raw_response: strategyContent,
        error: 'Could not parse structured response'
      };
    }

    // Save to database
    const { data: strategy, error: insertError } = await supabase
      .from('strategies')
      .insert({
        user_id: user.id,
        name,
        description: description || 'AI-generated strategy',
        trading_style,
        capital_allocation,
        risk_level,
        status: 'paused',
        ai_generated: true,
        strategy_config: strategyConfig,
        performance_data: {
          total_trades: 0,
          win_rate: 0,
          total_return: 0,
          max_drawdown: 0
        }
      })
      .select()
      .single();

    if (insertError) {
      console.error('Database insert error:', insertError);
      throw insertError;
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        strategy,
        message: 'Strategy generated successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-strategy:', error);
    const origin = req.headers.get('origin');
    const errorCorsHeaders = getCorsHeaders(origin);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: error instanceof Error && error.message.includes('Rate limit') ? 429 : 500, 
        headers: { ...errorCorsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
