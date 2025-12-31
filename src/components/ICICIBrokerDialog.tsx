// src/components/ICICIBrokerDialog.tsx

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
    import.meta.env.VITE_API_URL ||
    "https://api.alphaforge.skillsifter.in";

  /* =======================================================
     STEP 1: INITIATE ICICI LOGIN (JWT REQUIRED)
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

    const { redirectUrl } = await res.json();
    if (!redirectUrl) throw new Error("No redirect URL");

    window.open(
      redirectUrl,
      "iciciLogin",
      "width=500,height=700"
    );
  } catch (err: any) {
    setStatus("error");
    setMessage(err.message);
  }
};


  /* =======================================================
     STEP 2: RECEIVE APSESSION FROM BACKEND CALLBACK
  ======================================================= */
  const handleMessage = useCallback(
    async (event: MessageEvent) => {
      if (!event.data || typeof event.data !== "object") return;

      if (event.data.type !== "ICICI_LOGIN") return;

      const apisession: string | undefined = event.data.apisession;
      if (!apisession) {
        setStatus("error");
        setMessage("Missing apisession from ICICI");
        return;
      }

      try {
        const token = localStorage.getItem("token");
        if (!token) throw new Error("Authentication expired");

        /* =======================================================
           STEP 3: FINALIZE LOGIN (JWT REQUIRED)
        ======================================================= */
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
          description: "Broker session established",
        });

        setTimeout(() => onOpenChange(false), 1000);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="space-y-4 max-w-md">
        <DialogHeader>
          <DialogTitle>Connect ICICI Direct (Breeze)</DialogTitle>
        </DialogHeader>

        {status === "idle" && (
          <Button className="w-full" onClick={startICICILogin}>
            Connect ICICI Direct
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
