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

  // 🔥 Listen for session token from popup
  useEffect(() => {
    function receiveMessage(ev: MessageEvent) {
      if (ev?.data?.type === "ICICI_LOGIN") {
        setApisession(ev.data.session_token);
        toast({
          title: "Session received",
          description: `apisession received from ICICI`,
        });
      }
    }

    window.addEventListener("message", receiveMessage);
    return () => window.removeEventListener("message", receiveMessage);
  }, []);

  const handleSave = async () => {
    if (!apiKey || !apiSecret) {
      toast({
        title: "Missing",
        description: "API Key and Secret required",
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

      toast({ title: "Saved", description: "Credentials saved" });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Save failed",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!apiKey || !apiSecret || !apisession) {
      toast({
        title: "Missing",
        description: "API Key, Secret and apisession required",
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
        description: "ICICI Breeze connected successfully",
      });

      setApiKey("");
      setApiSecret("");
      setApisession("");
      onOpenChange(false);
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Login failed",
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
        description: "Enter API Key first",
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
            Enter API Key + Secret → Login → apisession → Complete Login
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <div>
            <Label>API Key</Label>
