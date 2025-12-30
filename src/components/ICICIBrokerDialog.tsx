// src/components/ICICIBrokerDialog.tsx

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Status = "idle" | "loading" | "success" | "error";

export function ICICIBrokerDialog({ open, onOpenChange }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [forcedReconnect, setForcedReconnect] = useState(false);
  const { toast } = useToast();

  const backendUrl =
    import.meta.env.VITE_BACKEND_URL ||
    import.meta.env.VITE_API_URL ||
    "https://api.alphaforge.skillsifter.in";

  /* =======================================================
     STEP 1: START ICICI LOGIN (JWT → BACKEND → REDIRECT URL)
  ======================================================= */
  const startICICILogin = async () => {
    try {
      setStatus("loading");

      const token = localStorage.getItem("token");
      if (!token) throw new Error("Authentication required");

      const res = await fetch(`${backendUrl}/api/icici/auth/login`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok || !data.redirectUrl) {
        throw new Error(data.error || "Failed to initiate ICICI login");
      }

      const popup = window.open(
        data.redirectUrl,
        "iciciLogin",
        "width=500,height=700"
      );

      if (!popup) {
        throw new Error("Popup blocked. Please allow popups.");
      }
    } catch (err: any) {
      setStatus("error");
      setMessage(err.message);

      toast({
        title: "ICICI Login Failed",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  /* =======================================================
     STEP 2: RECEIVE apisession FROM POPUP
             → FINALIZE LOGIN (JWT REQUIRED)
  ======================================================= */
  const handleMessage = useCallback(
    async (event: MessageEvent) => {
      if (!event.data || event.data.type !== "ICICI_LOGIN") return;

      const apisession: string | undefined = event.data.apisession;
      if (!apisession) {
        setStatus("error");
        setMessage("Missing apisession from ICICI");
        return;
      }

      try {
        const token = localStorage.getItem("token");
        if (!token) throw new Error("Authentication expired");

        const res = await fetch(
          `${backendUrl}/api/icici/auth/complete`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ apisession }),
          }
        );

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "ICICI finalization failed");
        }

        setStatus("success");
        setMessage("ICICI Breeze connected successfully");

        toast({
          title: "ICICI Connected",
          description: "Broker connection established",
        });

        setForcedReconnect(false);
        setTimeout(() => onOpenChange(false), 1200);
      } catch (err: any) {
        setStatus("error");
        setMessage(err.message);

        toast({
          title: "ICICI Connection Failed",
          description: err.message,
          variant: "destructive",
        });
      }
    },
    [backendUrl, onOpenChange, toast]
  );

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  /* =======================================================
     SESSION EXPIRY / FORCED RECONNECT
  ======================================================= */
  useEffect(() => {
    function handleReconnectEvent() {
      setForcedReconnect(true);
      setStatus("idle");
      setMessage("");
      onOpenChange(true);
    }

    window.addEventListener(
      "SHOW_ICICI_RECONNECT_DIALOG",
      handleReconnectEvent
    );

    return () =>
      window.removeEventListener(
        "SHOW_ICICI_RECONNECT_DIALOG",
        handleReconnectEvent
      );
  }, [onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="space-y-4 max-w-md">
        <DialogHeader>
          <DialogTitle>
            {forcedReconnect
              ? "Reconnect ICICI Direct"
              : "Connect ICICI Direct (Breeze)"}
          </DialogTitle>
        </DialogHeader>

        {status === "idle" && (
          <Button className="w-full" onClick={startICICILogin}>
            {forcedReconnect ? "Reconnect ICICI Direct" : "Connect ICICI Direct"}
          </Button>
        )}

        {status === "loading" && (
          <div className="flex items-center gap-2 text-blue-500">
            <Loader2 className="animate-spin" />
            Redirecting to ICICI…
          </div>
        )}

        {status === "success" && (
          <div className="text-green-600 font-medium">{message}</div>
        )}

        {status === "error" && (
          <div className="text-red-600 font-medium">{message}</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
