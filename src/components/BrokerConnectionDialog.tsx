import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface BrokerConnectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brokerName: string;
}

export function BrokerConnectionDialog({ open, onOpenChange, brokerName }: BrokerConnectionDialogProps) {
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleConnect = async () => {
    if (!apiKey.trim()) {
      toast({
        title: "Error",
        description: "API Key is required",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('store-credentials', {
        body: {
          broker_name: brokerName,
          api_key: apiKey,
          api_secret: apiSecret || undefined,
        },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `${brokerName} connected successfully`,
      });
      
      setApiKey("");
      setApiSecret("");
      onOpenChange(false);
    } catch (error) {
      console.error('Error storing credentials:', error);
      toast({
        title: "Error",
        description: "Failed to connect broker. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Connect to {brokerName}</DialogTitle>
          <DialogDescription>
            Enter your {brokerName} API credentials. They will be encrypted and stored securely.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key *</Label>
            <Input
              id="apiKey"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your API key"
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="apiSecret">API Secret</Label>
            <Input
              id="apiSecret"
              type="password"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              placeholder="Enter your API secret (optional)"
              disabled={loading}
            />
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleConnect} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Connect
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
