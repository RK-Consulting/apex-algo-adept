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

  const backend =
    import.meta.env.VITE_BACKEND_URL ||
    import.meta.env.VITE_API_URL ||
    "https://api.alphaforge.skillsifter.in";

  /* -------------------------------------------------------
   * START ICICI LOGIN (JWT-PROTECTED)
   * -----------------------------------------------------*/
  const startICICILogin = async () => {
    setStatus("loading");

    const token = localStorage.getItem("token");
    if (!token) {
      setStatus("error");
      setMessage("User not authenticated");
      toast({
        title: "Authentication Required",
        description: "Please log in before connecting ICICI.",
        variant: "destructive",
      });
      return;
    }

    try {
      const res = await fetch(`${backend}/api/icici/auth/login`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to initiate ICICI login");
      }

      const { redirectUrl } = await res.json();
      if (!redirectUrl) {
        throw new Error("Missing ICICI redirect URL");
      }

      const popup = window.open(
        redirectUrl,
        "iciciLogin",
        "width=500,height=700,noopener,noreferrer"
      );

      if (!popup) {
        throw new Error("Popup blocked. Please enable popups.");
      }
    } catch (err: any) {
      setStatus("error");
      setMessage(err.message || "ICICI login failed");
      toast({
        title: "ICICI Login Error",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  /* -------------------------------------------------------
   * RECEIVE RESULT FROM ICICI POPUP
   * -----------------------------------------------------*/
  const handleMessage = useCallback(
    async (event: MessageEvent) => {
      if (!event.data || typeof event.data !== "object") return;

      // SUCCESS
      if (event.data.type === "ICICI_LOGIN") {
        const apisession = event.data.apisession;
        if (!apisession) {
          toast({
            title: "ICICI Error",
            description: "Missing apisession",
            variant: "destructive",
          });
          return;
        }

        setStatus("loading");

        try {
          const token = localStorage.getItem("token");
          if (!token) throw new Error("User not authenticated");

          const resp = await fetch(`${backend}/api/icici/auth/complete`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ apisession }),
          });

          const json = await resp.json();
          if (!resp.ok) {
            throw new Error(json.error || "ICICI authentication failed");
          }

          setStatus("success");
          setMessage("ICICI Direct account connected successfully.");

          toast({
            title: "ICICI Connected",
            description: "Your ICICI Direct account is now linked.",
          });

          setTimeout(() => onOpenChange(false), 1200);
        } catch (err: any) {
          setStatus("error");
          setMessage(err.message || "ICICI connection failed");
          toast({
            title: "ICICI Error",
            description: err.message,
            variant: "destructive",
          });
        }
      }

      // ERROR
      if (event.data.type === "ICICI_LOGIN_ERROR") {
        setStatus("error");
        setMessage(event.data.error || "ICICI login failed");
        toast({
          title: "ICICI Login Error",
          description: event.data.error,
          variant: "destructive",
        });
      }
    },
    [backend, onOpenChange, toast]
  );

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  /* -------------------------------------------------------
   * GLOBAL SESSION EXPIRY HANDLER
   * -----------------------------------------------------*/
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

  /* -------------------------------------------------------
   * UI
   * -----------------------------------------------------*/
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

        {forcedReconnect && (
          <div className="p-3 rounded bg-red-100 border border-red-300 text-red-700 text-sm">
            Your ICICI session has expired. Please reconnect.
          </div>
        )}

        {status === "idle" && (
          <div>
            <p>
              {forcedReconnect
                ? "Your session expired. Click below to reconnect ICICI Direct."
                : "Authenticate with ICICI Direct to continue."}
            </p>

            <Button className="mt-4 w-full" onClick={startICICILogin}>
              {forcedReconnect
                ? "Reconnect ICICI Direct"
                : "Connect ICICI Direct"}
            </Button>
          </div>
        )}

        {status === "loading" && (
          <div className="flex items-center gap-3 text-blue-500">
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
