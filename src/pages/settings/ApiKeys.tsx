// /src/pages/settings/ApiKeys.tsx

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings as SettingsIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const backendUrl =
  import.meta.env.VITE_BACKEND_URL ||
  import.meta.env.VITE_API_URL ||
  "https://api.alphaforge.skillsifter.in";

const ApiKeys = () => {
  const { toast } = useToast();

  const [apiBroker, setApiBroker] = useState("");
  const [appKey, setAppKey] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!apiBroker || !appKey || !appSecret) {
      toast({
        title: "Missing fields",
        description: "Broker, API Key and API Secret are required",
        variant: "destructive",
      });
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      toast({
        title: "Session expired",
        description: "Please login again",
        variant: "destructive",
      });
      return;
    }

    const payload = {
      broker_name: apiBroker,
      app_key: appKey,
      app_secret: appSecret,
    };

    setSaving(true);
    try {
      const res = await fetch(`${backendUrl}/api/credentials/store`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");

      toast({
        title: "Saved",
        description: "Broker API credentials stored securely",
      });

      setAppKey("");
      setAppSecret("");
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <SettingsIcon className="w-5 h-5" /> API Keys
        </CardTitle>
        <CardDescription>
          Store broker API credentials securely
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <Label>Broker</Label>
          <select
            className="w-full p-2 rounded-md border bg-background"
            value={apiBroker}
            onChange={(e) => setApiBroker(e.target.value)}
          >
            <option value="">Select broker</option>
            <option value="ICICI">ICICI Direct</option>
            <option value="ZERODHA">Zerodha</option>
            <option value="UPSTOX">Upstox</option>
            <option value="ANGEL">Angel One</option>
          </select>
        </div>

        <div>
          <Label>API Key</Label>
          <Input
            value={appKey}
            onChange={(e) => setAppKey(e.target.value)}
          />
        </div>

        <div>
          <Label>API Secret</Label>
          <Input
            type="password"
            value={appSecret}
            onChange={(e) => setAppSecret(e.target.value)}
          />
        </div>

        <Button onClick={handleSave} disabled={saving}>
          Save API Credentials
        </Button>
      </CardContent>
    </Card>
  );
};

export default ApiKeys;
