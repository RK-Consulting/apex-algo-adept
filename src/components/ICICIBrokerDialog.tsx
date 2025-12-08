// src/components/ICICIBrokerDialog.tsx
import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ICICIBrokerDialog({ open, onOpenChange }: Props) {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const { toast } = useToast();

  const startICICILogin = () => {
    setStatus("loading");
    setMessage("");

    const popup = window.open(
      "/api/icici/auth/login",
      "iciciLogin",
      "width=500,height=700"
    );

    if (!popup) {
      setStatus("error");
      setMessage("Popup blocked. Enable popups for this site.");
      toast({ title: "Popup Blocked", variant: "destructive" });
    }
  };

  const handleMessage = useCallback((event: MessageEvent) => {
    if (!event.data) return;

    if (event.data.type === "ICICI_LOGIN_SUCCESS") {
      setStatus("success");
      setMessage("ICICI account connected successfully!");

      // Save connection state
      localStorage.setItem("icici_session_token", event.data.session_token);
      localStorage.setItem("icici_connected", "true");

      toast({
        title: "ICICI Connected",
        description: "Your ICICI Direct account is now linked.",
      });

      setTimeout(() => onOpenChange(false), 1500);
    }

    if (event.data.type === "ICICI_LOGIN_ERROR") {
      setStatus("error");
      setMessage(event.data.error || "Login failed.");
      toast({ title: "ICICI Login Error", variant: "destructive" });
    }
  }, []);

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
          <div>
            <p>Click below to authenticate with ICICI Direct securely.</p>
            <Button className="mt-4 w-full" onClick={startICICILogin}>
              Connect ICICI Direct
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
