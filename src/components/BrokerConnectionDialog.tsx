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
}

export function BrokerConnectionDialog({
  open,
  onOpenChange,
  brokerName,
}: Props) {
  /* =======================================================
     GUI INPUT STATE (USER SCOPE)
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
       VALIDATION (GUI SCOPE)
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

    const authToken = localStorage.getItem("token");
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
         REQUEST PAYLOAD (BOUNDARY)
      ------------------------------ */
      const response = await fetch(`${backendUrl}/api/credentials/store`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          broker_name: brokerName.toUpperCase(),
          app_key: userInputAppKey,        // explicit mapping
          app_secret: userInputAppSecret,  // explicit mapping
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
        description: `${brokerName} credentials saved`,
      });

      /* ------------------------------
         CLEAR SENSITIVE INPUT
      ------------------------------ */
      setUserInputAppKey("");
      setUserInputAppSecret("");
      onOpenChange(false);
    } catch (err: any) {
      // Defensive cleanup
      setUserInputAppKey("");
      setUserInputAppSecret("");

      toast({
        title: "Error",
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
            Credentials are encrypted and stored securely on the server.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label>API Key *</Label>
            <Input
              value={userInputAppKey}
              onChange={(e) => setUserInputAppKey(e.target.value)}
              disabled={isSubmitting}
              autoComplete="off"
            />
          </div>

          <div>
            <Label>API Secret *</Label>
            <Input
              type="password"
              value={userInputAppSecret}
              onChange={(e) => setUserInputAppSecret(e.target.value)}
              disabled={isSubmitting}
              autoComplete="off"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>

          <Button onClick={handleConnect} disabled={isSubmitting}>
            {isSubmitting && (
              <Loader2 className="animate-spin mr-2 h-4 w-4" />
            )}
            Connect
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
