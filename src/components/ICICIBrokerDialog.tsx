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
     START ICICI LOGIN (POPUP)
     BACKEND FETCHES app_key FROM DB
  ======================================================= */
  const startICICILogin = () => {
    setStatus("loading");

    const popupWindow = window.open(
      `${backendUrl}/api/icici/auth/login`,
      "iciciLogin",
      "width=500,height=700"
    );

    if (!popupWindow) {
      setStatus("error");
      setMessage("Popup blocked");

      toast({
        title: "Popup Blocked",
        description: "Please enable popups for ICICI login",
        variant: "destructive",
      });
    }
  };

  /* =======================================================
     RECEIVE RESULT FROM POPUP (RUNTIME ONLY)
  ======================================================= */
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      if (!event.data || typeof event.data !== "object") return;

      /* ------------------------------
         SUCCESS PATH
      ------------------------------ */
      if (event.data.type === "ICICI_LOGIN") {
        const popupApiSession: string | undefined = event.data.apisession;

        if (!popupApiSession) {
          setStatus("error");
          setMessage("Missing apisession from ICICI");
          return;
        }

        /* ------------------------------
           RUNTIME STORAGE (TEMPORARY)
           - Not a credential
           - Not persisted DB state
        ------------------------------ */
        const runtimeApiSession = popupApiSession;
        localStorage.setItem("icici_runtime_apisession", runtimeApiSession);

        setStatus("success");
        setMessage("ICICI login successful. Finalizing connection…");

        toast({
          title: "ICICI Login Successful",
          description: "Completing broker connection",
        });

        setForcedReconnect(false);
        setTimeout(() => onOpenChange(false), 1200);
      }

      /* ------------------------------
         ERROR PATH
      ------------------------------ */
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
    [onOpenChange, toast]
  );

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  /* =======================================================
     GLOBAL SESSION EXPIRY HANDLER
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
