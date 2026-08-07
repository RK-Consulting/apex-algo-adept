// src/pages/Settings.tsx

import { useState, useEffect } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, Bell, Link2, Wallet, CheckCircle2 } from "lucide-react";

import Profile from "./settings/Profile";
import ApiKeys from "./settings/ApiKeys";
import { BrokerConnectionDialog } from "@/components/BrokerConnectionDialog";
import { useProfile } from "@/context/ProfileContext";
import { useIcici } from "@/context/IciciContext"; // Added Context
import { useToast } from "@/hooks/use-toast";

const Settings = () => {
  const { isComplete } = useProfile();
  const { isConnected, fsmState, refreshStatus } = useIcici(); // Use Global State
  const { toast } = useToast();

  const [brokerDialogOpen, setBrokerDialogOpen] = useState(false);
  const [selectedBroker, setSelectedBroker] = useState("");

  /* ======================================================
      LISTEN FOR ICICI POPUP SUCCESS MESSAGE
  ====================================================== */
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const allowedOrigin =
        import.meta.env.VITE_BACKEND_URL ||
        import.meta.env.VITE_API_URL ||
        "https://api.alphaforge.skillsifter.in";

      try {
        const allowedHostname = new URL(allowedOrigin).hostname;
        if (!event.origin.includes(allowedHostname)) {
          // 🔍 FIX 2: Warn instead of silently dropping — helps diagnose mismatches
          console.warn("[ICICI] Origin mismatch. Got:", event.origin, "Expected hostname:", allowedHostname);
          return;
        }
      } catch (e) {
        // 🔍 FIX 2: Log parse errors so misconfigured env vars are visible
        console.error("[ICICI] Failed to parse allowedOrigin:", allowedOrigin);
        return;
      }

      if (event.data?.type === "ICICI_CONNECTED") {
        if (event.data.success) {
          toast({
            title: "Broker Connected",
            description: "ICICI Direct session is now active.",
          });
          refreshStatus(); // ✅ Crucial: Updates the whole app state
        } else {
          toast({
            title: "Connection Failed",
            description: event.data.error || "ICICI login unsuccessful.",
            variant: "destructive",
          });
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [toast, refreshStatus]);

  /* ======================================================
      BROKER CONNECT HANDLER
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

      const token = localStorage.getItem("authToken") || localStorage.getItem("token");

      if (!token) {
        toast({ title: "Session expired", variant: "destructive" });
        return;
      }

      const popup = window.open("about:blank", "ICICI_Login", "width=600,height=700");
      if (!popup) {
        toast({ title: "Popup blocked", variant: "destructive" });
        return;
      }

      // ✅ FIX 1: Write a loading page immediately so the browser doesn't kill
      // the popup during the async fetch. Wrapped in try-catch because some
      // browsers throw a SecurityError accessing popup.document even for
      // about:blank when cross-origin policies are strict — safe to ignore.
      try {
        popup.document.write(`
          <html>
            <body style="font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#0f0f0f;color:white;">
              <div>Connecting to ICICI Direct...</div>
            </body>
          </html>
        `);
      } catch (_) {
        // Cross-origin document access blocked — popup will stay blank briefly
        // until popup.location.href is set below. This is safe to ignore.
      }

      try {
        const response = await fetch(`${backendUrl}/api/icici/status/connect`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        const data = await response.json();
        if (!response.ok || !data.redirectUrl) {
          popup.close();
          throw new Error(data.error || "Initialization failed.");
        }

        popup.location.href = data.redirectUrl;
      } catch (error: any) {
        if (popup) popup.close();
        toast({ title: "Error", description: error.message, variant: "destructive" });
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
            <h1 className="text-3xl font-bold">Settings</h1>

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
                    {["Zerodha", "Upstox", "Angel One", "ICICIDIRECT"].map((b) => {
                      const isICICI = b === "ICICIDIRECT";
                      const active = isICICI && isConnected;

                      return (
                        <div key={b} className="flex justify-between p-4 border rounded-lg items-center">
                          <div className="flex gap-3 items-center">
                            <Wallet className="w-5 h-5 text-muted-foreground" />
                            <div>
                              <div className="font-medium flex items-center gap-2">
                                {b}
                                {active && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                              </div>
                              {isICICI && (
                                <p className="text-xs text-muted-foreground">
                                  Status: <span className={active ? "text-green-500" : ""}>{fsmState}</span>
                                </p>
                              )}
                            </div>
                          </div>
                          <Button
                            variant={active ? "secondary" : "outline"}
                            onClick={() => handleConnectBroker(b)}
                          >
                            {active ? "Reconnect" : "Connect"}
                          </Button>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Other Tabs remain unchanged... */}
              <TabsContent value="notifications">
                <Card><CardContent className="p-6">Notification settings coming soon.</CardContent></Card>
              </TabsContent>
              <TabsContent value="security">
                <Card><CardContent className="p-6">Security settings coming soon.</CardContent></Card>
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
        onSuccess={refreshStatus} // ✅ Added refresh callback
      />
    </SidebarProvider>
  );
};

export default Settings;
