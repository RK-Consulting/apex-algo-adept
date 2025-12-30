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
  const { toast } = useToast();

  const backendUrl =
    import.meta.env.VITE_BACKEND_URL ||
    "https://api.alphaforge.skillsifter.in";

  /* =======================================================
     STEP 1: INITIATE LOGIN (JWT → redirectUrl)
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
        throw new Error("Missing redirect URL");
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
     STEP 2: RECEIVE apisession FROM CALLBACK
  ======================================================= */
  const handleMessage = useCallback(
    async (event: MessageEvent) => {
      if (
        !event.data ||
        typeof event.data !== "object" ||
        event.data.type !== "ICICI_LOGIN"
      ) {
        return;
      }

      const apisession = event.data.apisession;
      if (!apisession) return;

      try {
        const token = localStorage.getItem("token");
        if (!token) throw new Error("JWT missing");

        /* ===================================================
           STEP 3: FINALIZE LOGIN (THIS WAS NEVER FIRING)
        =================================================== */
        const res = await fetch(
          `${backendUrl}/api/icici/auth/complete`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ apisession }),
          }
        );

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Finalization failed");
        }

        setStatus("success");
        setMessage("ICICI connected successfully");

        toast({
          title: "ICICI Connected",
          description: "Broker session established",
        });

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
    },
    [backendUrl, onOpenChange, toast]
  );

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="space-y-4 max-w-md">
        <DialogHeader>
          <DialogTitle>Connect ICICI Direct (Breeze)</DialogTitle>
        </DialogHeader>

        {status === "idle" && (
          <Button className="w-full" onClick={startICICILogin}>
            Connect ICICI
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
