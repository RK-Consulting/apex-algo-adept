// frontend/src/pages/Setting.tsx

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
  AlertTriangle,
} from "lucide-react";
import { BrokerConnectionDialog } from "@/components/BrokerConnectionDialog";
import { ICICIBrokerDialog } from "@/components/ICICIBrokerDialog";
import { useState } from "react";

const Settings = () => {
  const [brokerDialogOpen, setBrokerDialogOpen] = useState(false);
  const [iciciBrokerDialogOpen, setIciciBrokerDialogOpen] = useState(false);
  const [selectedBroker, setSelectedBroker] = useState("");

  const handleConnectBroker = (brokerName: string) => {
    if (brokerName === "ICICIDIRECT") {
      setIciciBrokerDialogOpen(true);
    } else {
      setSelectedBroker(brokerName);
      setBrokerDialogOpen(true);
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
                Manage your account and integrations
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
                      <User className="w-5 h-5" />
                      Profile Information
                    </CardTitle>
                    <CardDescription>Update personal details</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <Label>Full Name</Label>
                        <Input />
                      </div>
                      <div>
                        <Label>Email</Label>
                        <Input type="email" />
                      </div>
                    </div>
                    <Button>Save Changes</Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ================= BROKER ================= */}
              <TabsContent value="broker">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Link2 className="w-5 h-5" />
                      Broker Integration
                    </CardTitle>
                    <CardDescription>
                      Connect your trading accounts
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {["Zerodha", "Upstox", "Angel One", "ICICIDIRECT"].map(
                      (broker) => (
                        <div
                          key={broker}
                          className="flex items-center justify-between p-4 border rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <Wallet className="w-5 h-5 text-primary" />
                            <div>
                              <div className="font-semibold">{broker}</div>
                              <div className="text-xs text-muted-foreground">
                                Not connected
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            onClick={() => handleConnectBroker(broker)}
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
                      <Bell className="w-5 h-5" />
                      Notifications
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between">
                      <span>Trade Executions</span>
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
                      <Shield className="w-5 h-5" />
                      Security
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Input type="password" placeholder="New password" />
                    <Button>Update Password</Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ================= API KEYS (FIXED) ================= */}
              <TabsContent value="api">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <SettingsIcon className="w-5 h-5" />
                      API Configuration
                    </CardTitle>
                    <CardDescription>
                      Store broker API credentials securely
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                      <div className="flex gap-2">
                        <AlertTriangle className="w-5 h-5 text-yellow-500" />
                        <p className="text-sm text-muted-foreground">
                          API credentials are encrypted and stored securely.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <div className="font-semibold">ICICI Direct</div>
                        <div className="text-xs text-muted-foreground">
                          API Key & Secret
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelectedBroker("ICICI");
                          setBrokerDialogOpen(true);
                        }}
                      >
                        Configure
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>

      {/* Dialogs */}
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
