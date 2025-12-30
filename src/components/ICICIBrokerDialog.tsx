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
  const [forcedReconnect, setForcedReconnect] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const { toast } = useToast();

  const backendUrl =
    import.meta.env.VITE_BACKEND_URL ||
    import.meta.env.VITE_API_URL ||
    "https://api.alphaforge.skillsifter.in";

  /* =======================================================
     START ICICI LOGIN
  ======================================================= */
  const startICICILogin = async () => {
    try {
      setStatus("loading");

      const token = localStorage.getItem("token");
      if (!token) throw new Error("Not authenticated");

      const res = await fetch(`${backendUrl}/api/icici/auth/login`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!data.redirectUrl) {
        throw new Error("No redirect URL received");
      }

      const popup = window.open(
        data.redirectUrl,
        "iciciLogin",
        "width=500,height=700"
      );

      if (!popup) {
        throw new Error("Popup blocked");
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
     RECEIVE RESULT FROM POPUP → FINALIZE LOGIN
  ======================================================= */
  const handleMessage = useCallback(
    async (event: MessageEvent) => {
      if (!event.data || typeof event.data !== "object") return;

      /* if (event.data.type === "ICICI_LOGIN") {
        const apisession: string | undefined = event.data.apisession;
        if (!apisession) {
          setStatus("error");
          setMessage("Missing apisession from ICICI");
          return;
        } */
      if (event.data.type === "ICICI_LOGIN") {
          const popupApiSession = event.data.apisession;
          if (!popupApiSession) return;
        
          const token = localStorage.getItem("token");
          if (!token) {
            setStatus("error");
            setMessage("Authentication expired. Please login again.");
            return;
          }
        
          // 🔑 FINALIZE LOGIN (JWT REQUIRED)
          fetch(`${backendUrl}/api/icici/auth/complete`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ apisession: popupApiSession }),
          })
            .then((res) => {
              if (!res.ok) throw new Error("ICICI finalization failed");
              return res.json();
            })
            .then(() => {
              setStatus("success");
              setMessage("ICICI connected successfully");
              setForcedReconnect(false);
              setTimeout(() => onOpenChange(false), 1000);
            })
            .catch((err) => {
              setStatus("error");
              setMessage(err.message);
            });
        }


        try {
          const token = localStorage.getItem("token");
          if (!token) throw new Error("Authentication expired");

          // 🔐 FINALIZE LOGIN (THIS WAS MISSING)
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
            title: "ICICI Finalization Failed",
            description: err.message,
            variant: "destructive",
          });
        }
      }
    },
    [backendUrl, onOpenChange, toast]
  );

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  /* =======================================================
     SESSION EXPIRY HANDLER
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
            {forcedReconnect ? "Reconnect" : "Connect"}
          </Button>
        )}

        {status === "loading" && (
          <div className="flex items-center gap-2 text-blue-500">
            <Loader2 className="animate-spin" />
            Redirecting to ICICI…
          </div>
        )}

        {status === "success" && (
          <div className="text-green-600">{message}</div>
        )}

        {status === "error" && (
          <div className="text-red-600">{message}</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
