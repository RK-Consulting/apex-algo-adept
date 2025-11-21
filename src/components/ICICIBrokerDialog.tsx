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
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ICICIBrokerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ICICIBrokerDialog({ open, onOpenChange }: ICICIBrokerDialogProps) {
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // fallback backend URL
  const backendUrl =
    import.meta.env.VITE_BACKEND_URL || "https://api.alphaforge.skillsifter.in";

  const handleSave = async () => {
    if (!apiKey.trim() || !apiSecret.trim()) {
      toast({
        title: "Missing credentials",
        description: "API Key and API Secret are required.",
        variant: "destructive",
      });
      return;
    }

    const token =
      localStorage.getItem("authToken") || localStorage.getItem("token");

    if (!token) {
      toast({
        title: "Unauthorized",
        description: "Your session has expired. Please login again.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // 1) Store encrypted credentials
      const saveRes = await fetch(`${backendUrl}/api/icici/auth/callback`, {
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

      const saveData = await saveRes.json();

      if (!saveRes.ok) {
        throw new Error(saveData.error || "Failed to save credentials");
      }

      // 2) Immediately activate ICICI trading session
      const connectRes = await fetch(`${backendUrl}/api/icici/connect`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const connectData = await connectRes.json();
      if (!connectRes.ok) {
        throw new Error(connectData.error || "Failed to activate ICICI session");
      }

      toast({
        title: "ICICI Connected",
        description: "Your ICICI Direct Breeze session is active.",
      });

      // cleanup
      setApiKey("");
      setApiSecret("");
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to connect ICICI Direct.",
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
          <DialogTitle>Connect ICICI Direct (Breeze)</DialogTitle>
          <DialogDescription>
            Securely store your ICICI Direct API Key and Secret to enable live trading,
            streaming market data, and placing orders.
          </DialogDescription>
        </DialogHeader>

        <Alert className="mb-3">
          <AlertDescription>
            The system now auto-generates and manages the Breeze session token
            internally. You only need API Key and API Secret.
          </AlertDescription>
        </Alert>

        <div className="space-y-4 py-4">
          <div>
            <Label>API Key *</Label>
            <Input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={loading}
            />
          </div>

          <div>
            <Label>API Secret *</Label>
            <Input
              type="password"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
            Save & Connect
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
