// CREATE THIS NEW FILE: src/components/ICICIConnectionDialog.tsx

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
import { Loader2, ExternalLink } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ICICIConnectionDialog({ open, onOpenChange }: Props) {
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [sessionToken, setSessionToken] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const backendUrl =
    import.meta.env.VITE_BACKEND_URL ||
    import.meta.env.VITE_API_URL ||
    "https://api.alphaforge.skillsifter.in";

  const handleGetSessionToken = () => {
    if (!apiKey.trim()) {
      toast({
        title: "API Key Required",
        description: "Please enter your API Key first",
        variant: "destructive",
      });
      return;
    }

    // Open ICICI login page in new tab
    const loginUrl = `https://api.icicidirect.com/apiuser/login?api_key=${apiKey}`;
    window.open(loginUrl, "_blank");

    toast({
      title: "Login Window Opened",
      description: "After login, copy the session token from the URL and paste it below",
    });
  };

  const handleConnect = async () => {
    if (isSubmitting) return;

    // Validation
    if (!apiKey.trim()) {
      toast({
        title: "Error",
        description: "API Key is required",
        variant: "destructive",
      });
      return;
    }

    if (!apiSecret.trim()) {
      toast({
        title: "Error",
        description: "API Secret is required",
        variant: "destructive",
      });
      return;
    }

    if (!sessionToken.trim()) {
      toast({
        title: "Error",
        description: "Session Token is required",
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
      const response = await fetch(`${backendUrl}/api/icici/connect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          api_key: apiKey,
          api_secret: apiSecret,
          session_token: sessionToken,
        }),
      });

      const responseBody = await response.json();
      
      if (!response.ok) {
        throw new Error(responseBody?.error || "Failed to connect to ICICI Direct");
      }

      toast({
        title: "Success",
        description: "ICICI Direct connected successfully",
      });

      // Clear sensitive data
      setApiKey("");
      setApiSecret("");
      setSessionToken("");
      onOpenChange(false);
      
    } catch (err: any) {
      // Clear sensitive data on error too
      setApiKey("");
      setApiSecret("");
      setSessionToken("");

      toast({
        title: "Connection Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Connect to ICICI Direct</DialogTitle>
          <DialogDescription>
            Enter your API credentials and obtain a session token
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label>API Key *</Label>
            <Input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              disabled={isSubmitting}
              autoComplete="off"
              placeholder="Your ICICI API Key"
            />
          </div>

          <div>
            <Label>API Secret *</Label>
            <Input
              type="password"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              disabled={isSubmitting}
              autoComplete="off"
              placeholder="Your ICICI API Secret"
            />
          </div>

          <div>
            <Button
              type="button"
              variant="outline"
              onClick={handleGetSessionToken}
              disabled={isSubmitting || !apiKey}
              className="w-full"
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              Get Session Token from ICICI
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Click to login with ICICI. Copy the session token from the URL after login.
            </p>
          </div>

          <div>
            <Label>Session Token *</Label>
            <Input
              value={sessionToken}
              onChange={(e) => setSessionToken(e.target.value)}
              disabled={isSubmitting}
              autoComplete="off"
              placeholder="Paste session token here"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setApiKey("");
              setApiSecret("");
              setSessionToken("");
              onOpenChange(false);
            }}
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
