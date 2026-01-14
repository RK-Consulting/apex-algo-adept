// src/components/BrokerConnectionDialog.tsx

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brokerName: string;
  onSuccess?: () => void;
}

export function BrokerConnectionDialog({
  open,
  onOpenChange,
  brokerName,
  onSuccess,
}: Props) {
  /* =======================================================
      GUI INPUT STATE
  ======================================================= */
  const [userInputAppKey, setUserInputAppKey] = useState("");
  const [userInputAppSecret, setUserInputAppSecret] = useState("");

  /* =======================================================
      UI RUNTIME STATE
  ======================================================= */
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const backendUrl =
    import.meta.env.VITE_BACKEND_URL ||
    import.meta.env.VITE_API_URL ||
    "https://api.alphaforge.skillsifter.in";

  /* =======================================================
      SUBMIT HANDLER
  ======================================================= */
  const handleConnect = async () => {
    if (isSubmitting) return; // prevent double-submit

    /* ------------------------------
        VALIDATION
    ------------------------------ */
    if (!userInputAppKey.trim()) {
      toast({
        title: "Error",
        description: "API Key is required",
        variant: "destructive",
      });
      return;
    }

    if (!userInputAppSecret.trim()) {
      toast({
        title: "Error",
        description: "API Secret is required",
        variant: "destructive",
      });
      return;
    }

    // Using auth_token to match your App.tsx / ProtectedRoute logic
    const authToken = localStorage.getItem("auth_token");
    if (!authToken) {
      toast({
        title: "Session expired",
        description: "Please login again",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      /* ------------------------------
          API CALL (CREDENTIAL STORAGE)
      ------------------------------ */
      const response = await fetch(`${backendUrl}/api/credentials/store`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          broker_name: brokerName.toUpperCase(),
          app_key: userInputAppKey,
          app_secret: userInputAppSecret,
        }),
      });

      const responseBody = await response.json();
      
      if (!response.ok) {
        throw new Error(
          responseBody?.error || "Failed to save credentials"
        );
      }

      toast({
        title: "Success",
        description: `${brokerName} credentials saved successfully`,
      });

      /* ------------------------------
          CLEANUP & REFRESH
      ------------------------------ */
      setUserInputAppKey("");
      setUserInputAppSecret("");
      onOpenChange(false);
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      toast({
        title: "Connection Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Connect to {brokerName}</DialogTitle>
          <DialogDescription>
            Enter your API credentials. These are encrypted and stored 
            securely on the server to enable automated trading.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="app-key">API Key *</Label>
            <Input
              id="app-key"
              placeholder="Enter your App Key"
              value={userInputAppKey}
              onChange={(e) => setUserInputAppKey(e.target.value)}
              disabled={isSubmitting}
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="app-secret">API Secret *</Label>
            <Input
              id="app-secret"
              type="password"
              placeholder="Enter your App Secret"
              value={userInputAppSecret}
              onChange={(e) => setUserInputAppSecret(e.target.value)}
              disabled={isSubmitting}
              autoComplete="off"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>

          <Button onClick={handleConnect} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              "Connect Broker"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
