import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
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

  const backendUrl = import.meta.env.VITE_BACKEND_URL;

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

    const token = localStorage.getItem("authToken");
    if (!token) {
      toast({
        title: "Session expired",
        description: "Please login again",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${backendUrl}/api/icici/connect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          api_key: apiKey,
          api_secret: apiSecret,
          session_token: sessionToken,
        }),
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error || "Failed to connect ICICI");

      toast({
        title: "Success",
        description: "ICICI Direct connected successfully"
      });

      setApiKey("");
      setApiSecret("");
      setSessionToken("");
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
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
            Enter your ICICI Direct API credentials to enable trading.
          </DialogDescription>
        </DialogHeader>

        <Alert className="mb-2">
          <AlertDescription className="text-sm">
            <b>Steps:</b><br/>
            1️⃣ Enter API Key<br/>
            2️⃣ Click “Get Session Token” and login<br/>
            3️⃣ Copy token → paste here
          </AlertDescription>
        </Alert>

        <div className="space-y-4 py-4">
          <div>
            <Label>API Key *</Label>
            <Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} disabled={loading}/>
          </div>

          <div>
            <Label>API Secret *</Label>
            <Input type="password" value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} disabled={loading}/>
          </div>

          <div>
            <div className="flex justify-between items-center">
              <Label>Session Token *</Label>
              <Button variant="link" onClick={() => window.open(getSessionUrl(), "_blank")} disabled={!apiKey || loading}>
                Get Session Token <ExternalLink className="ml-1 h-3 w-3"/>
              </Button>
            </div>
            <Input value={sessionToken} onChange={(e) => setSessionToken(e.target.value)} disabled={loading}/>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
          <Button onClick={handleConnect} disabled={loading}>
            {loading && <Loader2 className="animate-spin mr-2 h-4 w-4"/>}
            Connect
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
