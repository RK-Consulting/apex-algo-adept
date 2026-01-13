// /src/pages/Settings.tsx

import { useState, useEffect } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Shield,
  Bell,
  Link2,
  Wallet,
} from "lucide-react";

import Profile from "./settings/Profile";
import ApiKeys from "./settings/ApiKeys";
import { BrokerConnectionDialog } from "@/components/BrokerConnectionDialog";
import { useProfile } from "@/context/ProfileContext";
import { useToast } from "@/hooks/use-toast";

const Settings = () => {
  /* ======================================================
      PROFILE STATE (GLOBAL, READ-ONLY)
  ====================================================== */
  const { isComplete } = useProfile();
  const { toast } = useToast();

  /* ======================================================
      BROKER DIALOG STATE (FOR NON-ICICI BROKERS)
  ====================================================== */
  const [brokerDialogOpen, setBrokerDialogOpen] = useState(false);
  const [selectedBroker, setSelectedBroker] = useState("");

  /* ======================================================
      LISTEN FOR ICICI POPUP SUCCESS MESSAGE
  ====================================================== */
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // 1. Resolve Allowed Origin
      const allowedOrigin =
        import.meta.env.VITE_BACKEND_URL ||
        import.meta.env.VITE_API_URL ||
        "https://api.alphaforge.skillsifter.in";

      // 2. Security Check: Validate Origin
      try {
        const allowedHostname = new URL(allowedOrigin).hostname;
        if (!event.origin.includes(allowedHostname)) return;
      } catch (e) {
        console.error("Invalid Origin URL configuration");
        return;
      }

      // 3. FSM Listener Logic
      // Only react to terminal states ('success' or 'error')
      if (event.data?.type === "ICICI_CONNECTED") {
        if (event.data.success) {
          toast({
            title: "Broker Connected",
            description: "ICICI Direct session is now active.",
          });
          // Optional: Trigger a state refresh from your API here
          // window.location.reload(); 
        } else {
          // Failure State
          toast({
            title: "Connection Failed",
            description: event.data.error || "ICICI login was unsuccessful.",
            variant: "destructive",
          });
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [toast]);

  /* ======================================================
      BROKER CONNECT HANDLER — SURGICAL FIX
  ====================================================== */
  const handleConnectBroker = async (brokerName: string) => {
    if (brokerName === "ICICIDIRECT" && !isComplete) {
      toast({
        title: "Profile incomplete",
        description: "Please complete your profile before connecting a broker.",
        variant: "destructive",
      });
      return;
    }

    if (brokerName === "ICICIDIRECT") {
      const backendUrl =
        import.meta.env.VITE_BACKEND_URL ||
        import.meta.env.VITE_API_URL ||
        "https://api.alphaforge.skillsifter.in";

      const token =
        localStorage.getItem("authToken") ||
        localStorage.getItem("token");

      if (!token) {
        toast({
          title: "Session expired",
          description: "Please login again",
          variant: "destructive",
        });
        return;
      }

      /* 🔥 POPUP PRE-OPEN (Browser Anti-Popup-Blocker measure) 🔥 */
      const popup = window.open(
        "about:blank",
        "ICICI_Login",
        "width=600,height=700,scrollbars=yes,resizable=yes"
      );

      if (!popup) {
        toast({
          title: "Popup blocked",
          description: "Please allow popups for this site and try again",
          variant: "destructive",
        });
        return;
      }

      try {
        const response = await fetch(
          `${backendUrl}/api/icici/broker/connect`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        const data = await response.json();

        if (!response.ok || !data.redirectUrl) {
          popup.close();
          throw new Error(data.error || "Failed to initialize broker connection.");
        }

        /* ✅ NAVIGATE POPUP TO BROKER LOGIN */
        popup.location.href = data.redirectUrl;

        toast({
          title: "Connecting to ICICI...",
          description: "Please complete the authentication in the login window.",
        });
      } catch (error: any) {
        if (popup) popup.close();
        toast({
          title: "Initialization failed",
          description: error.message,
          variant: "destructive",
        });
      }
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

              <TabsContent value="profile">
                <Profile />
              </TabsContent>

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
                            <div className="font-medium">{b}</div>
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

              <TabsContent value="notifications">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bell className="w-5 h-5" /> Notifications
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span>Trade Executions</span>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Strategy Alerts</span>
                      <Switch defaultChecked />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

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

              <TabsContent value="api">
                <ApiKeys />
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
    </SidebarProvider>
  );
};

export default Settings;
