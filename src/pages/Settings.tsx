// /src/pages/Settings.tsx

import { useState } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
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
import { Switch } from "@/components/ui/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Settings as SettingsIcon,
  User,
  Shield,
  Bell,
  Link2,
  Wallet,
} from "lucide-react";
import { BrokerConnectionDialog } from "@/components/BrokerConnectionDialog";
import { ICICIBrokerDialog } from "@/components/ICICIBrokerDialog";
import { useToast } from "@/hooks/use-toast";

const Settings = () => {
  const { toast } = useToast();

  const backendUrl =
    import.meta.env.VITE_BACKEND_URL ||
    import.meta.env.VITE_API_URL ||
    "https://api.alphaforge.skillsifter.in";

  /* ======================================================
     BROKER DIALOG STATE
  ====================================================== */
  const [brokerDialogOpen, setBrokerDialogOpen] = useState(false);
  const [iciciBrokerDialogOpen, setIciciBrokerDialogOpen] = useState(false);
  const [selectedBroker, setSelectedBroker] = useState("");

  /* ======================================================
     API KEYS TAB — GUI INPUT STATE (EXPLICIT)
  ====================================================== */
  const [apiBroker, setApiBroker] = useState("");

  const [userInputAppKey, setUserInputAppKey] = useState("");
  const [userInputAppSecret, setUserInputAppSecret] = useState("");

  const [savingApi, setSavingApi] = useState(false);

  /* ======================================================
     BROKER CONNECT HANDLER
  ====================================================== */
  const handleConnectBroker = (brokerName: string) => {
    if (brokerName === "ICICIDIRECT") {
      setIciciBrokerDialogOpen(true);
    } else {
      setSelectedBroker(brokerName);
      setBrokerDialogOpen(true);
    }
  };

  /* ======================================================
     SAVE API KEYS (GUI → REQUEST PAYLOAD)
  ====================================================== */
  const handleSaveApiKeys = async () => {
    if (!apiBroker || !userInputAppKey || !userInputAppSecret) {
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

    /* ------------------------------
       REQUEST PAYLOAD (EXPLICIT)
    ------------------------------ */
    const requestPayload = {
      broker_name: apiBroker,
      app_key: userInputAppKey,
      app_secret: userInputAppSecret,
    };

    setSavingApi(true);
    try {
      const res = await fetch(`${backendUrl}/api/credentials/store`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestPayload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast({
        title: "Saved",
        description: "Broker API credentials stored securely",
      });

      /* ------------------------------
         CLEAR GUI STATE
      ------------------------------ */
      setUserInputAppKey("");
      setUserInputAppSecret("");
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setSavingApi(false);
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <div className="container mx-auto p-6 space-y-6">
            <div>
              <h1 className="text-3xl font-bold">Settings</h1>
              <p className="text-muted-foreground text-sm">
                Manage your account and preferences
              </p>
            </div>

            <Tabs defaultValue="profile" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="profile">Profile</TabsTrigger>
                <TabsTrigger value="broker">Broker</TabsTrigger>
                <TabsTrigger value="notifications">Notifications</TabsTrigger>
                <TabsTrigger value="security">Security</TabsTrigger>
                <TabsTrigger value="api">API Keys</TabsTrigger>
              </TabsList>

              {/* ================= PROFILE ================= */}
              <TabsContent value="profile">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="w-5 h-5" /> Profile Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Full Name</Label>
                      <Input />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input type="email" />
                    </div>
                    <div>
                      <Label>Phone</Label>
                      <Input />
                    </div>
                    <div>
                      <Label>PAN Number</Label>
                      <Input />
                    </div>
                    <Button className="md:col-span-2">Save Changes</Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ================= BROKER ================= */}
              <TabsContent value="broker">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Link2 className="w-5 h-5" /> Broker Integration
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {["Zerodha", "Upstox", "Angel One", "ICICIDIRECT"].map(
                      (b) => (
                        <div
                          key={b}
                          className="flex justify-between p-4 border rounded-lg"
                        >
                          <div className="flex gap-3 items-center">
                            <Wallet className="w-5 h-5" />
                            <div>{b}</div>
                          </div>
                          <Button
                            variant="outline"
                            onClick={() => handleConnectBroker(b)}
                          >
                            Connect
                          </Button>
                        </div>
                      )
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ================= NOTIFICATIONS ================= */}
              <TabsContent value="notifications">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bell className="w-5 h-5" /> Notifications
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between">
                      <span>Trade Executions</span>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex justify-between">
                      <span>Strategy Alerts</span>
                      <Switch defaultChecked />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ================= SECURITY ================= */}
              <TabsContent value="security">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="w-5 h-5" /> Security
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Input type="password" placeholder="Current Password" />
                    <Input type="password" placeholder="New Password" />
                    <Input type="password" placeholder="Confirm Password" />
                    <Button>Update Password</Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ================= API KEYS ================= */}
              <TabsContent value="api">
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
                        className="
                          w-full
                          p-2
                          rounded-md
                          border
                          border-border
                          bg-background
                          text-foreground
                          focus:outline-none
                          focus:ring-2
                          focus:ring-primary
                        "
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
                        value={userInputAppKey}
                        onChange={(e) =>
                          setUserInputAppKey(e.target.value)
                        }
                      />
                    </div>

                    <div>
                      <Label>API Secret</Label>
                      <Input
                        type="password"
                        value={userInputAppSecret}
                        onChange={(e) =>
                          setUserInputAppSecret(e.target.value)
                        }
                      />
                    </div>

                    <Button onClick={handleSaveApiKeys} disabled={savingApi}>
                      Save API Credentials
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>

      <BrokerConnectionDialog
        open={brokerDialogOpen}
        onOpenChange={setBrokerDialogOpen}
        brokerName={selectedBroker}
      />

      <ICICIBrokerDialog
        open={iciciBrokerDialogOpen}
        onOpenChange={setIciciBrokerDialogOpen}
      />
    </SidebarProvider>
  );
};

export default Settings;
