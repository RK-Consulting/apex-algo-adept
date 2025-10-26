import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ExternalLink } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ICICIBrokerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ICICIBrokerDialog({ open, onOpenChange }: ICICIBrokerDialogProps) {
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [sessionToken, setSessionToken] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const getSessionUrl = () => {
    if (!apiKey.trim()) return "#";
    return `https://api.icicidirect.com/apiuser/login?api_key=${encodeURIComponent(apiKey)}`;
  };

  const handleConnect = async () => {
    if (!apiKey.trim() || !apiSecret.trim() || !sessionToken.trim()) {
      toast({
        title: "Error",
        description: "All fields are required",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }

      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
      const response = await fetch(`${backendUrl}/api/icici/connect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          api_key: apiKey,
          api_secret: apiSecret,
          session_token: sessionToken,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to connect to ICICI Direct');
      }

      const result = await response.json();

      toast({
        title: "Success",
        description: result.message || "ICICI Direct connected successfully",
      });
      
      setApiKey("");
      setApiSecret("");
      setSessionToken("");
      onOpenChange(false);
    } catch (error) {
      console.error('Error connecting to ICICI Direct:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to connect. Please check your credentials.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Connect to ICICI Direct (Breeze)</DialogTitle>
          <DialogDescription>
            Enter your ICICI Direct API credentials to enable trading via Breeze API.
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <AlertDescription className="text-sm">
            <strong>Step 1:</strong> Enter your API Key below<br />
            <strong>Step 2:</strong> Click "Get Session Token" to login<br />
            <strong>Step 3:</strong> Copy the session token and paste it here
          </AlertDescription>
        </Alert>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key *</Label>
            <Input
              id="apiKey"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your API key"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiSecret">API Secret *</Label>
            <Input
              id="apiSecret"
              type="password"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              placeholder="Enter your API secret"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="sessionToken">Session Token *</Label>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                onClick={() => window.open(getSessionUrl(), '_blank')}
                disabled={!apiKey.trim() || loading}
              >
                Get Session Token <ExternalLink className="ml-1 h-3 w-3" />
              </Button>
            </div>
            <Input
              id="sessionToken"
              value={sessionToken}
              onChange={(e) => setSessionToken(e.target.value)}
              placeholder="Paste session token here"
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              Click "Get Session Token" above, login, and copy the token from the URL
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleConnect} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Connect
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
