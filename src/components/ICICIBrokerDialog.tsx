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

export function ICICIBrokerDialog({ open, onOpenChange }: Props) {
  const [forcedReconnect, setForcedReconnect] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">(
    "idle"
  );
  const [message, setMessage] = useState("");
  const { toast } = useToast();

  /* -------------------------------------------------------
   * FIXED: ICICI Login Popup
   * Adds ?api_key=YOUR_ICICI_API_KEY
   * -----------------------------------------------------*/
  const startICICILogin = () => {
    setStatus("loading");

    const backend =
      import.meta.env.VITE_BACKEND_URL ||
      import.meta.env.VITE_API_URL ||
      "https://api.alphaforge.skillsifter.in";

    // IMPORTANT — must match backend route:
    // router.get("/auth/login", ... requires ?api_key=...)
    const apiKey = import.meta.env.VITE_ICICI_API_KEY;

    if (!apiKey) {
      setStatus("error");
      setMessage("ICICI_APP_KEY missing in environment");
      toast({
        title: "ICICI API Key Missing",
        description:
          "Add VITE_ICICI_API_KEY to your frontend .env to enable login.",
        variant: "destructive",
      });
      return;
    }

    const loginUrl =
      backend.replace(/\/$/, "") +
      `/api/icici/auth/login?api_key=${encodeURIComponent(apiKey)}`;

    const popup = window.open(
      loginUrl,
      "iciciLogin",
      "width=500,height=700"
    );

    if (!popup) {
      setStatus("error");
      setMessage("Popup blocked. Enable popups.");
      toast({
        title: "Popup Blocked",
        description: "Please allow popups for ICICI authentication.",
        variant: "destructive",
      });
    }
  };

  /* -------------------------------------------------------
   * RECEIVE LOGIN RESULT FROM POPUP
   * -----------------------------------------------------*/
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      if (!event.data) return;

      // SUCCESS
      if (event.data.type === "ICICI_LOGIN") {
        setStatus("success");
        setMessage("ICICI account connected successfully!");

        localStorage.setItem(
          "icici_session_token",
          event.data.session_token || ""
        );
        localStorage.setItem("icici_connected", "true");

        toast({
          title: "ICICI Connected",
          description: "Your ICICI Direct account is now linked.",
        });

        setForcedReconnect(false);
        setTimeout(() => onOpenChange(false), 1500);
      }

      // ERROR
      if (event.data.type === "ICICI_LOGIN_ERROR") {
        setStatus("error");
        setMessage(event.data.error || "Login failed.");
        toast({ title: "ICICI Login Error", variant: "destructive" });
      }
    },
    [onOpenChange, toast]
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

        {/* WARNING BANNER */}
        {forcedReconnect && (
          <div className="p-3 rounded bg-red-100 border border-red-300 text-red-700 text-sm">
            Your ICICI session has expired. Please reconnect.
          </div>
        )}

        {/* Idle */}
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

        {/* Loading */}
        {status === "loading" && (
          <div className="flex items-center gap-3 text-blue-500">
            <Loader2 className="animate-spin" />
            Redirecting to ICICI…
          </div>
        )}

        {/* Success */}
        {status === "success" && (
          <div className="text-green-600 font-medium">{message}</div>
        )}

        {/* Error */}
        {status === "error" && (
          <div className="text-red-600 font-medium">{message}</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
