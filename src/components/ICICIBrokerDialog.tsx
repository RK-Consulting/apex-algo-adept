// src/components/ICICIBrokerDialog.tsx
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ExternalLink } from "lucide-react";

interface Props { open: boolean; onOpenChange: (o: boolean) => void; }

export function ICICIBrokerDialog({ open, onOpenChange }: Props) {
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [sessionToken, setSessionToken] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:8080";

  const handleSave = async () => {
    if (!apiKey || !apiSecret) {
      toast({ title: "Missing", description: "API Key and Secret required", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem("authToken") || localStorage.getItem("token");
      const res = await fetch(`${backendUrl}/api/icici/broker/store`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ api_key: apiKey, api_secret: apiSecret, username, password }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Save failed");
      toast({ title: "Saved", description: "Broker credentials saved" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Save failed", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleComplete = async () => {
    if (!apiKey || !apiSecret || !sessionToken) {
      toast({ title: "Missing", description: "apiKey, apiSecret, sessionToken required", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem("authToken") || localStorage.getItem("token");
      const res = await fetch(`${backendUrl}/api/icici/broker/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ api_key: apiKey, api_secret: apiSecret, session_token: sessionToken }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Complete failed");
      toast({ title: "Connected", description: "ICICI Breeze connected" });
      setApiKey(""); setApiSecret(""); setSessionToken(""); setUsername(""); setPassword("");
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Complete failed", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const getSessionUrl = () => {
    if (!apiKey) return "#";
    // The frontend will open the ICICI login page (instructions: enter username/password, OTP will be asked by provider)
    // The user must copy the sessionToken from the browser address bar after login
    return `https://api.icicidirect.com/apiuser/login?api_key=${encodeURIComponent(apiKey)}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Connect to ICICI (Breeze)</DialogTitle>
          <DialogDescription>Save API key/secret and complete Breeze JWT login</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <div>
            <Label>API Key</Label>
            <Input disabled={loading} value={apiKey} onChange={(e)=>setApiKey(e.target.value)} />
          </div>
          <div>
            <Label>API Secret</Label>
            <Input type="password" disabled={loading} value={apiSecret} onChange={(e)=>setApiSecret(e.target.value)} />
          </div>
          <div>
            <Label>Initial Username</Label>
            <Input disabled={loading} value={username} onChange={(e)=>setUsername(e.target.value)} />
          </div>
          <div>
            <Label>Initial Password</Label>
            <Input disabled={loading} value={password} onChange={(e)=>setPassword(e.target.value)} />
          </div>

          <div>
            <div className="flex justify-between items-center">
              <Label>Session Token</Label>
              <Button variant="link" onClick={() => window.open(getSessionUrl(), "_blank")} disabled={!apiKey}>
                Open ICICI Login <ExternalLink className="ml-1 h-3 w-3"/>
              </Button>
            </div>
            <Input disabled={loading} value={sessionToken} onChange={(e)=>setSessionToken(e.target.value)} />
            <div className="text-xs text-muted-foreground mt-1">
              After you login on ICICI site (browser), copy the sessionToken from the URL and paste here.
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={()=>onOpenChange(false)} disabled={loading}>Cancel</Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="animate-spin mr-2 h-4 w-4" />}Save
          </Button>
          <Button onClick={handleComplete} disabled={loading}>
            {loading && <Loader2 className="animate-spin mr-2 h-4 w-4" />}Complete (login)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
