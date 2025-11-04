import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

export function BrokerConnectionDialog({ open, onOpenChange, brokerName }: Props) {
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  
  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  const handleConnect = async () => {
    if (!apiKey.trim()) {
      toast({ title: "Error", description: "API Key is required", variant: "destructive" });
      return;
    }

    const token = localStorage.getItem("authToken");
    if (!token) {
      toast({ title: "Session expired", description: "Please login again", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${backendUrl}/api/credentials/store`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}` 
        },
        body: JSON.stringify({ broker_name: brokerName, api_key: apiKey, api_secret: apiSecret }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast({ title: "Success", description: `${brokerName} connected` });

      setApiKey("");
      setApiSecret("");
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Connect to {brokerName}</DialogTitle>
          <DialogDescription>Credentials stored securely on server.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label>API Key *</Label>
            <Input value={apiKey} onChange={e => setApiKey(e.target.value)} disabled={loading}/>
          </div>
          <div>
            <Label>API Secret (optional)</Label>
            <Input type="password" value={apiSecret} onChange={e => setApiSecret(e.target.value)} disabled={loading}/>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
          <Button onClick={handleConnect} disabled={loading}>
            {loading && <Loader2 className="animate-spin mr-2 h-4 w-4"/>}
            Connect
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
