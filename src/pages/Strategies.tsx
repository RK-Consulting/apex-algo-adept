// apex-algo-adept/src/pages/Strategies.tsx
import { useState, useEffect } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Play,
  Pause,
  Plus,
  TrendingUp,
  Brain,
  Zap,
  Target,
  LineChart,
  Loader2,
} from "lucide-react";
import { CreateStrategyDialog } from "@/components/CreateStrategyDialog";
import { useToast } from "@/hooks/use-toast";

const aiSuggestions = [
  {
    name: "Volatility Arbitrage",
    description: "Capitalize on volatility differences in NIFTY options",
    confidence: "92%",
    expectedReturn: "15-20%",
    riskLevel: "Medium",
  },
  {
    name: "Sector Rotation AI",
    description: "AI-powered sector rotation based on market trends",
    confidence: "87%",
    expectedReturn: "12-18%",
    riskLevel: "Medium",
  },
  {
    name: "Delta Neutral Options",
    description: "Market-neutral strategy using options delta hedging",
    confidence: "89%",
    expectedReturn: "8-12%",
    riskLevel: "Low",
  },
];

const strategyTemplates = [
  { name: "Scalping", icon: Zap, description: "High-frequency small profits", risk: "High" },
  { name: "Mean Reversion", icon: Target, description: "Buy low, sell high on oscillations", risk: "Medium" },
  { name: "Trend Following", icon: TrendingUp, description: "Ride the momentum", risk: "Medium" },
  { name: "AI Neural Network", icon: Brain, description: "Deep learning predictions", risk: "High" },
  { name: "Statistical Arbitrage", icon: LineChart, description: "Quantitative statistical edge", risk: "Low" },
];

const Strategies = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [strategies, setStrategies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingTemplate, setGeneratingTemplate] = useState<string | null>(null);
  const { toast } = useToast();

  const backendUrl =
    import.meta.env.VITE_BACKEND_URL || "https://api.alphaforge.skillsifter.in";

  const getToken = () =>
    localStorage.getItem("authToken") || localStorage.getItem("token");
  //const getToken = () => localStorage.getItem("authToken");

  // -------------------------------------
  // 🔥 Load strategies from your backend
  // -------------------------------------
  const loadStrategies = async () => {
    const token = getToken();
    if (!token) return;

    try {
      const res = await fetch(`${backendUrl}/api/strategies`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error("Failed to load strategies");

      const data = await res.json();
      setStrategies(data?.strategies || []);
    } catch (error) {
      console.error("Error loading strategies:", error);
      toast({
        title: "Error",
        description: "Failed to load strategies",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
  // use the project's token getter (you declared getToken() above)
  const token = getToken();

  // If no token present, skip loading strategies (avoids 403 / invalid-token errors)
  if (!token) {
    console.log("⏳ No token in storage — skipping loadStrategies until login/verify.");
    setLoading(false); // avoid indefinite loading indicator
    return;
  }

  // Delay slightly so ProtectedRoute / verify flow can finish storing/verifying token
  const timer = setTimeout(() => {
    console.log("▶️ Token present — calling loadStrategies()");
    loadStrategies();
  }, 250);

  return () => clearTimeout(timer);
 }, []);

  // -------------------------------------
  // 🔥 Pause / Activate strategy
  // -------------------------------------
  const handleToggleStrategy = async (id: string, currentStatus: string) => {
    const token = getToken();
    if (!token) return;

    try {
      const newStatus = currentStatus === "active" ? "paused" : "active";

      const res = await fetch(`${backendUrl}/api/strategies/toggle`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id, status: newStatus }),
      });

      if (!res.ok) throw new Error("Failed to update strategy");

      toast({
        title: "Success",
        description: `Strategy ${newStatus === "active" ? "activated" : "paused"}`,
      });

      loadStrategies();
    } catch (error) {
      console.error("Error toggling strategy:", error);
      toast({
        title: "Error",
        description: "Failed to update strategy",
        variant: "destructive",
      });
    }
  };

  // -------------------------------------
  // 🔥 Create strategy from template
  // -------------------------------------
  const handleDeployTemplate = async (
    templateName: string,
    templateDescription: string,
    templateRisk: string
  ) => {
    const token = getToken();
    if (!token) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to create strategies",
        variant: "destructive",
      });
      return;
    }

    setGeneratingTemplate(templateName);

    try {
      const res = await fetch(`${backendUrl}/api/strategies/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: templateName,
          description: templateDescription,
          risk: templateRisk,
          capital: 500000,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success)
        throw new Error(data.error || "Strategy generation failed");

      toast({
        title: "Success!",
        description: `${templateName} strategy created`,
      });

      loadStrategies();
    } catch (error: any) {
      console.error("Error deploying template:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create strategy",
        variant: "destructive",
      });
    } finally {
      setGeneratingTemplate(null);
    }
  };

  // -------------------------------------
  // 🔥 Deploy AI suggestion
  // -------------------------------------
  const handleDeployAISuggestion = async (suggestion: any) => {
    const token = getToken();
    if (!token) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to deploy AI suggestions",
        variant: "destructive",
      });
      return;
    }

    setGeneratingTemplate(suggestion.name);

    try {
      const res = await fetch(`${backendUrl}/api/strategies/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: suggestion.name,
          description: suggestion.description,
          risk: suggestion.riskLevel,
          capital: 500000,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success)
        throw new Error(data.error || "Strategy deployment failed");

      toast({
        title: "Success!",
        description: `${suggestion.name} deployed successfully`,
      });

      loadStrategies();
    } catch (error: any) {
      console.error("Error deploying suggestion:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to deploy strategy",
        variant: "destructive",
      });
    } finally {
      setGeneratingTemplate(null);
    }
  };

  // -------------------------------------
  // UI STARTS HERE
  // -------------------------------------

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <div className="container mx-auto p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  AI Strategy Builder
                </h1>
                <p className="text-muted-foreground text-sm">
                  Create and manage algorithmic trading strategies
                </p>
              </div>
              <Button className="gap-2" onClick={() => setDialogOpen(true)}>
                <Plus className="w-4 h-4" />
                Create New Strategy
              </Button>
            </div>

            <CreateStrategyDialog
              open={dialogOpen}
              onOpenChange={setDialogOpen}
              onStrategyCreated={loadStrategies}
            />

            {/* AI Recommendations */}
            <Card className="bg-gradient-to-r from-accent/10 to-primary/10 border-accent/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-accent">
                  <Sparkles className="w-5 h-5" />
                  AI-Powered Recommendations
                </CardTitle>
              </CardHeader>

              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {aiSuggestions.map((suggestion) => (
                    <div key={suggestion.name} className="p-4 rounded-lg bg-card border">
                      <h4 className="font-semibold mb-2">{suggestion.name}</h4>
                      <p className="text-xs text-muted-foreground mb-3">
                        {suggestion.description}
                      </p>

                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Confidence</span>
                          <span className="text-success font-semibold">
                            {suggestion.confidence}
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Expected Return</span>
                          <span className="font-semibold">
                            {suggestion.expectedReturn}
                          </span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Risk</span>
                          <Badge variant="outline">{suggestion.riskLevel}</Badge>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full mt-3"
                        onClick={() => handleDeployAISuggestion(suggestion)}
                        disabled={generatingTemplate === suggestion.name}
                      >
                        {generatingTemplate === suggestion.name ? (
                          <>
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            Deploying...
                          </>
                        ) : (
                          "Deploy Strategy"
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Main Tabs */}
            <Tabs defaultValue="active">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="active">Active Strategies</TabsTrigger>
                <TabsTrigger value="builder">Strategy Builder</TabsTrigger>
                <TabsTrigger value="templates">Templates</TabsTrigger>
              </TabsList>

              {/* Active Strategies */}
              <TabsContent value="active" className="space-y-4">
                {loading ? (
                  <p className="text-center text-muted-foreground">Loading strategies...</p>
                ) : strategies.length === 0 ? (
                  <p className="text-center text-muted-foreground">
                    No strategies yet. Create one!
                  </p>
                ) : (
                  strategies.map((strategy) => (
                    <Card key={strategy.id} className="bg-card border">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="font-semibold text-lg">{strategy.name}</h3>
                            <Badge variant={strategy.status === "active" ? "default" : "secondary"}>
                              {strategy.status}
                            </Badge>
                          </div>

                          <div className="text-right">
                            <div className="flex items-center gap-1 text-success font-mono text-xl">
                              <TrendingUp className="w-5 h-5" />
                              +{strategy.performance?.total_return || 0}%
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() =>
                              handleToggleStrategy(strategy.id, strategy.status)
                            }
                          >
                            {strategy.status === "active" ? (
                              <>
                                <Pause className="w-3 h-3 mr-1" /> Pause
                              </>
                            ) : (
                              <>
                                <Play className="w-3 h-3 mr-1" /> Activate
                              </>
                            )}
                          </Button>
                          <Button size="sm" variant="outline" className="flex-1">
                            View Details
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>

              {/* Strategy Builder */}
              <TabsContent value="builder" className="space-y-4">
                <Card className="bg-card border">
                  <CardHeader>
                    <CardTitle>Build Your Custom Strategy</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-12">
                      <Brain className="w-16 h-16 mx-auto mb-4 text-accent" />
                      <h3 className="text-xl font-semibold mb-2">
                        AI-Powered Strategy Builder
                      </h3>
                      <p className="text-muted-foreground mb-6">
                        Use our advanced AI to create custom trading strategies
                      </p>
                      <Button onClick={() => setDialogOpen(true)} className="gap-2">
                        <Plus className="w-4 h-4" />
                        Create Strategy with AI
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Templates */}
              <TabsContent value="templates" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {strategyTemplates.map((template) => (
                    <Card key={template.name} className="bg-card border cursor-pointer hover:border-primary">
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <template.icon className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-semibold">{template.name}</h3>
                            <Badge variant="outline" className="text-xs mt-1">
                              {template.risk} Risk
                            </Badge>
                          </div>
                        </div>

                        <p className="text-sm text-muted-foreground mb-4">
                          {template.description}
                        </p>

                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full"
                          onClick={() =>
                            handleDeployTemplate(
                              template.name,
                              template.description,
                              template.risk
                            )
                          }
                          disabled={generatingTemplate === template.name}
                        >
                          {generatingTemplate === template.name ? (
                            <>
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              Creating...
                            </>
                          ) : (
                            "Use Template"
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default Strategies;
