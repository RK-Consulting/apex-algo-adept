-- Create user_credentials table for secure API key storage
CREATE TABLE public.user_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  broker_name TEXT NOT NULL,
  api_key TEXT NOT NULL,
  api_secret TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, broker_name)
);

-- Enable RLS on user_credentials
ALTER TABLE public.user_credentials ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_credentials
CREATE POLICY "Users can view their own credentials"
ON public.user_credentials
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own credentials"
ON public.user_credentials
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own credentials"
ON public.user_credentials
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own credentials"
ON public.user_credentials
FOR DELETE
USING (auth.uid() = user_id);

-- Add explicit deny policy for public access to strategies
CREATE POLICY "Deny all public access to strategies"
ON public.strategies
FOR SELECT
TO anon
USING (false);

-- Add trigger for user_credentials updated_at
CREATE TRIGGER update_user_credentials_updated_at
BEFORE UPDATE ON public.user_credentials
FOR EACH ROW
EXECUTE FUNCTION public.update_strategies_updated_at();