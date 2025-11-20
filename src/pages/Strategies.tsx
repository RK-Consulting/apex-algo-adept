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

// -------------------- NORMALIZER --------------------
function normalizeStrategies(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.strategies)) return data.strategies;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.strategies?.data)) return data.strategies.data;
  return [];
}

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

  const getToken = () => localStorage.getItem("authToken");

  // -------------------------------
  // FETCH STRATEGIES
  // -------------------------------
  const loadStrategies = async () => {
    const token = getToken();
    if (!token) return;
    setLoading(true);

    try {
      const res = await fetch(`${backendUrl}/api/strategies/`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await res.json().catch(() => ({}));
      const arr = normalizeStrategies(json);

      setStrategies(arr);
    } catch (error: any) {
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
    const token = getToken();
    if (!token) return;

    setTimeout(() => loadStrategies(), 300);
  }, []);

  // -------------------------------
  // Toggle active/paused
  // -------------------------------
  const handleToggleStrategy = async (id: string, currentStatus: string) => {
    const token = getToken();
    if (!token) return;

    try {
      const newStatus = currentStatus === "active" ? "paused" : "active";

      const res = await fetch(`${backendUrl}/api/strategies/toggle/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ id, status: newStatus }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json.success)
        throw new Error("Update failed");

      toast({
        title: "Updated",
        description: `Strategy ${newStatus}`,
      });

      loadStrategies();
    } catch (e: any) {
      toast({
        title: "Error",
        description: "Failed to update strategy",
        variant: "destructive",
      });
    }
  };

  // -------------------------------
  // Deploy Template
  // -------------------------------
  const handleDeployTemplate = async (name: string, description: string, risk: string) => {
    const token = getToken();
    if (!token) return;

    setGeneratingTemplate(name);

    try {
      const res = await fetch(`${backendUrl}/api/strategies/generate/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, description, risk, capital: 500000 }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error("Failed");

      toast({ title: "Success", description: `${name} created` });
      loadStrategies();
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to create strategy",
        variant: "destructive",
      });
    } finally {
      setGeneratingTemplate(null);
    }
  };

  // -------------------------------
  // Deploy AI Suggestion
  // -------------------------------
  const handleDeployAISuggestion = async (s: any) => {
    const token = getToken();
    if (!token) return;

    setGeneratingTemplate(s.name);

    try {
      const res = await fetch(`${backendUrl}/api/strategies/generate/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: s.name,
          description: s.description,
          risk: s.riskLevel,
          capital: 500000,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) throw new Error();

      toast({ title: "Success", description: `${s.name} deployed` });
      loadStrategies();
    } catch {
      toast({
        title: "Error",
        description: "Failed to deploy strategy",
        variant: "destructive",
      });
    } finally {
      setGeneratingTemplate(null);
    }
  };

  // -------------------------------
  // UI
  // -------------------------------
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
                  {aiSuggestions.map((s) => (
                    <div key={s.name} className="p-4 rounded-lg bg-card border">
                      <h4 className="font-semibold mb-2">{s.name}</h4>
                      <p className="text-xs text-muted-foreground mb-3">{s.description}</p>

                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span>Confidence</span>
                          <span className="text-success font-semibold">{s.confidence}</span>
                        </div>

                        <div className="flex justify-between">
                          <span>Expected Return</span>
                          <span>{s.expectedReturn}</span>
                        </div>

                        <div className="flex justify-between">
                          <span>Risk</span>
                          <Badge variant="outline">{s.riskLevel}</Badge>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full mt-3"
                        onClick={() => handleDeployAISuggestion(s)}
                        disabled={generatingTemplate === s.name}
                      >
                        {generatingTemplate === s.name ? (
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

            {/* MAIN TABS */}
            <Tabs defaultValue="active">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="active">Active Strategies</TabsTrigger>
                <TabsTrigger value="builder">Strategy Builder</TabsTrigger>
                <TabsTrigger value="templates">Templates</TabsTrigger>
              </TabsList>

              {/* Active */}
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

                          <div className="flex items-center gap-1 text-success font-mono text-xl">
                            <TrendingUp className="w-5 h-5" />
                            +{strategy.performance?.total_return || 0}%
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => handleToggleStrategy(strategy.id, strategy.status)}
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
              <TabsContent value="builder">
                <Card className="bg-card border mt-4">
                  <CardHeader>
                    <CardTitle>Build Your Own Strategy</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-12">
                      <Brain className="w-16 h-16 mx-auto mb-4 text-accent" />
                      <h3 className="text-xl font-semibold mb-2">AI Strategy Builder</h3>
                      <p className="text-muted-foreground mb-6">
                        Use advanced AI to build custom trading strategies.
                      </p>
                      <Button onClick={() => setDialogOpen(true)} className="gap-2">
                        <Plus className="w-4 h-4" />
                        Create Strategy
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Templates */}
              <TabsContent value="templates">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                  {strategyTemplates.map((template) => (
                    <Card key={template.name} className="bg-card border">
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
