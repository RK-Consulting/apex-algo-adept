// src/components/ICICIBrokerDialog.tsx
import { useState, useEffect } from "react";
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

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function ICICIBrokerDialog({ open, onOpenChange }: Props) {
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [apisession, setApisession] = useState("");
  const [loading, setLoading] = useState(false);

  const { toast } = useToast();

  const backendUrl =
    import.meta.env.VITE_BACKEND_URL || "http://localhost:3000";

  // 🔥 Capture ICICI apisession from popup
  useEffect(() => {
    function receiveMessage(ev: MessageEvent) {
      if (ev?.data?.type === "ICICI_LOGIN") {
        const sessionToken = String(ev.data.session_token || "").trim();
        if (!sessionToken) return;

        console.log("Received ICICI session_token →", sessionToken);
        setApisession(sessionToken);
        localStorage.setItem("icici_apisession", sessionToken);

        toast({
          title: "Session Received",
          description: "ICICI apisession captured successfully.",
        });
      }
    }

    window.addEventListener("message", receiveMessage);
    return () => window.removeEventListener("message", receiveMessage);
  }, []);

  /* -------------------------------------------------------
   * SAVE API KEY & SECRET
   * -----------------------------------------------------*/
  const handleSave = async () => {
    if (!apiKey || !apiSecret) {
      toast({
        title: "Missing values",
        description: "API Key and Secret are required",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const token =
        localStorage.getItem("authToken") || localStorage.getItem("token");

      const res = await fetch(`${backendUrl}/api/icici/broker/store`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          api_key: apiKey,
          api_secret: apiSecret,
        }),
      });

      const j = await res.json();
      if (!res.ok) throw new Error(j.error);

      toast({
        title: "Saved",
        description: "API Key & Secret saved successfully.",
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to save credentials",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  /* -------------------------------------------------------
   * COMPLETE BREEZE LOGIN
   * -----------------------------------------------------*/
  const handleComplete = async () => {
    if (!apiKey || !apiSecret || !apisession) {
      toast({
        title: "Missing values",
        description: "API Key, Secret & apisession are required",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const token =
        localStorage.getItem("authToken") || localStorage.getItem("token");

      const res = await fetch(`${backendUrl}/api/icici/broker/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          api_key: apiKey,
          api_secret: apiSecret,
          session_token: apisession,
        }),
      });

      const j = await res.json();
      if (!res.ok) throw new Error(j.error);

      toast({
        title: "Connected",
        description: "ICICI Breeze connected successfully.",
      });

      setApiKey("");
      setApiSecret("");
      setApisession("");
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to complete login",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const openICICILogin = () => {
    if (!apiKey) {
      toast({
        title: "Missing API Key",
        description: "Please enter your API Key first",
        variant: "destructive",
      });
      return;
    }

    window.open(
      `https://api.icicidirect.com/apiuser/login?api_key=${encodeURIComponent(
        apiKey
      )}`,
      "_blank",
      "width=500,height=700"
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Connect ICICI (Breeze R50)</DialogTitle>
          <DialogDescription>
            Save API Key + Secret → Login to ICICI → apisession → Complete Login.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <div>
            <Label>API Key</Label>
            <Input
              disabled={loading}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>

          <div>
            <Label>API Secret</Label>
            <Input
              type="password"
              disabled={loading}
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
            />
          </div>

          <div>
            <Label>Session Token (apisession)</Label>

            <div className="flex justify-between items-center mt-1">
              <Button onClick={openICICILogin} variant="link">
                Open ICICI Login <ExternalLink className="ml-1 h-3 w-3" />
              </Button>
            </div>

            <Input
              disabled={loading}
              value={apisession}
              onChange={(e) => setApisession(e.target.value)}
            />

            <p className="text-xs text-muted-foreground mt-1">
              Login in popup → apisession auto-filled.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
            Save
          </Button>
          <Button onClick={handleComplete} disabled={loading}>
            {loading && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
            Complete Login
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
