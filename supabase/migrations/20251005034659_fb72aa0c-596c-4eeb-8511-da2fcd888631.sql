-- Create strategies table
CREATE TABLE public.strategies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  trading_style TEXT NOT NULL,
  capital_allocation DECIMAL(15, 2) NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('Low', 'Medium', 'High')),
  status TEXT NOT NULL DEFAULT 'paused' CHECK (status IN ('active', 'paused', 'stopped')),
  ai_generated BOOLEAN DEFAULT false,
  strategy_config JSONB,
  performance_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.strategies ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own strategies" 
ON public.strategies 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own strategies" 
ON public.strategies 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own strategies" 
ON public.strategies 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own strategies" 
ON public.strategies 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_strategies_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_strategies_updated_at
BEFORE UPDATE ON public.strategies
FOR EACH ROW
EXECUTE FUNCTION public.update_strategies_updated_at();

-- Create market_data table for storing live market streams
CREATE TABLE public.market_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL,
  exchange TEXT NOT NULL,
  price DECIMAL(15, 4) NOT NULL,
  change DECIMAL(15, 4),
  change_percent DECIMAL(10, 4),
  volume BIGINT,
  high DECIMAL(15, 4),
  low DECIMAL(15, 4),
  open DECIMAL(15, 4),
  previous_close DECIMAL(15, 4),
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  additional_data JSONB
);

-- Enable RLS for market_data (public read)
ALTER TABLE public.market_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Market data is viewable by everyone" 
ON public.market_data 
FOR SELECT 
USING (true);

-- Create index for faster queries
CREATE INDEX idx_market_data_symbol ON public.market_data(symbol);
CREATE INDEX idx_market_data_timestamp ON public.market_data(timestamp DESC);