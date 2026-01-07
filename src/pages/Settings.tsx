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
      const allowedOrigin = 
        import.meta.env.VITE_BACKEND_URL ||
        import.meta.env.VITE_API_URL ||
        "https://api.alphaforge.skillsifter.in";
      
      // Accept messages from backend domain
      if (!event.origin.includes(new URL(allowedOrigin).hostname)) {
        return;
      }
      
      if (event.data.type === 'ICICI_CONNECTED') {
        if (event.data.success) {
          toast({
            title: "Success",
            description: "ICICI Direct connected successfully",
          });
        } else {
          toast({
            title: "Connection Failed",
            description: event.data.error || "Failed to connect to ICICI",
            variant: "destructive",
          });
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [toast]);

  /* ======================================================
     BROKER CONNECT HANDLER - OPENS ICICI IN POPUP
  ====================================================== */
  const handleConnectBroker = async (brokerName: string) => {
    if (!isComplete) {
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
      
      const token = localStorage.getItem("token");
      if (!token) {
        toast({
          title: "Session expired",
          description: "Please login again",
          variant: "destructive",
        });
        return;
      }

      try {
        // Get ICICI login URL from backend
        const response = await fetch(`${backendUrl}/api/icici/broker/connect`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        });

        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || "Failed to connect to ICICI");
        }

        // Open ICICI login in POPUP window
        if (data.redirectUrl) {
          const popup = window.open(
            data.redirectUrl, 
            'ICICI_Login',
            'width=600,height=700,scrollbars=yes,resizable=yes,location=no,menubar=no,status=no,toolbar=no'
          );
          
          if (!popup || popup.closed || typeof popup.closed === 'undefined') {
            toast({
              title: "Popup Blocked",
              description: "Please allow popups for this site and try again",
              variant: "destructive",
            });
            return;
          }

          toast({
            title: "ICICI Login Opened",
            description: "Complete your login in the popup window",
          });
        }
        
      } catch (error: any) {
        toast({
          title: "Connection failed",
          description: error.message,
          variant: "destructive",
        });
      }
    } else {
      // Other brokers use dialog
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

              {/* ================= PROFILE ================= */}
              <TabsContent value="profile">
                <Profile />
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
                <ApiKeys />
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>

      {/* ================= BROKER DIALOG (NON-ICICI ONLY) ================= */}
      <BrokerConnectionDialog
        open={brokerDialogOpen}
        onOpenChange={setBrokerDialogOpen}
        brokerName={selectedBroker}
      />
     
    </SidebarProvider>
  );
};

export default Settings;
