import { useState, useEffect } from "react";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Play, Pause, Plus, TrendingUp, Brain, Zap, Target, LineChart } from "lucide-react";
import { CreateStrategyDialog } from "@/components/CreateStrategyDialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const activeStrategies = [
  {
    name: "Mean Reversion Pro",
    status: "active",
    performance: "+18.5%",
    trades: 142,
    winRate: "68%",
    capital: "₹5,00,000",
    risk: "Medium",
    timeframe: "Intraday",
  },
  {
    name: "Momentum Breakout",
    status: "active",
    performance: "+24.3%",
    trades: 89,
    winRate: "71%",
    capital: "₹3,50,000",
    risk: "High",
    timeframe: "Swing",
  },
  {
    name: "AI Smart Grid",
    status: "paused",
    performance: "+12.1%",
    trades: 67,
    winRate: "65%",
    capital: "₹2,50,000",
    risk: "Low",
    timeframe: "Positional",
  },
];

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
  const { toast } = useToast();

  const loadStrategies = async () => {
    try {
      const { data, error } = await supabase
        .from('strategies')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setStrategies(data || []);
    } catch (error) {
      console.error('Error loading strategies:', error);
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
    loadStrategies();
  }, []);

  const handleToggleStrategy = async (id: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'active' ? 'paused' : 'active';
      const { error } = await supabase
        .from('strategies')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;
      
      loadStrategies();
      toast({
        title: "Success",
        description: `Strategy ${newStatus === 'active' ? 'activated' : 'paused'}`,
      });
    } catch (error) {
      console.error('Error toggling strategy:', error);
      toast({
        title: "Error",
        description: "Failed to update strategy",
        variant: "destructive",
      });
    }
  };

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
                <p className="text-muted-foreground text-sm">Create and manage algorithmic trading strategies</p>
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
                    <div key={suggestion.name} className="p-4 rounded-lg bg-card border border-border">
                      <h4 className="font-semibold mb-2">{suggestion.name}</h4>
                      <p className="text-xs text-muted-foreground mb-3">{suggestion.description}</p>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Confidence:</span>
                          <span className="font-semibold text-success">{suggestion.confidence}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Expected Return:</span>
                          <span className="font-semibold">{suggestion.expectedReturn}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Risk Level:</span>
                          <Badge variant="outline" className="text-xs">{suggestion.riskLevel}</Badge>
                        </div>
                      </div>
                      <Button size="sm" variant="outline" className="w-full mt-3 h-8 text-xs">
                        Deploy Strategy
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Tabs defaultValue="active" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="active">Active Strategies</TabsTrigger>
                <TabsTrigger value="builder">Strategy Builder</TabsTrigger>
                <TabsTrigger value="templates">Templates</TabsTrigger>
              </TabsList>

              <TabsContent value="active" className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  {loading ? (
                    <Card className="bg-card border-border">
                      <CardContent className="pt-6">
                        <p className="text-center text-muted-foreground">Loading strategies...</p>
                      </CardContent>
                    </Card>
                  ) : strategies.length === 0 ? (
                    <Card className="bg-card border-border">
                      <CardContent className="pt-6">
                        <p className="text-center text-muted-foreground">
                          No strategies yet. Create your first AI-powered strategy!
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    strategies.map((strategy) => (
                      <Card key={strategy.id} className="bg-card border-border">
                        <CardContent className="pt-6">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="font-semibold text-lg">{strategy.name}</h3>
                                <Badge variant={strategy.status === "active" ? "default" : "secondary"}>
                                  {strategy.status}
                                </Badge>
                                <Badge variant="outline">{strategy.risk_level} Risk</Badge>
                                {strategy.ai_generated && (
                                  <Badge variant="outline" className="bg-accent/10">
                                    <Brain className="w-3 h-3 mr-1" />
                                    AI Generated
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-6 text-sm text-muted-foreground">
                                <span>{strategy.performance_data?.total_trades || 0} trades</span>
                                <span>Win rate: {strategy.performance_data?.win_rate || 0}%</span>
                                <span>Capital: ₹{strategy.capital_allocation?.toLocaleString()}</span>
                                <span>{strategy.trading_style}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="flex items-center gap-1 text-success font-mono font-bold text-xl mb-1">
                                <TrendingUp className="w-5 h-5" />
                                +{strategy.performance_data?.total_return || 0}%
                              </div>
                              <div className="text-xs text-muted-foreground">Total Return</div>
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
                                  <Pause className="w-3 h-3 mr-1" />
                                  Pause
                                </>
                              ) : (
                                <>
                                  <Play className="w-3 h-3 mr-1" />
                                  Activate
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
                </div>
              </TabsContent>

              <TabsContent value="builder" className="space-y-4">
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle>Build Your Custom Strategy</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-12">
                      <Brain className="w-16 h-16 mx-auto mb-4 text-accent" />
                      <h3 className="text-xl font-semibold mb-2">AI-Powered Strategy Builder</h3>
                      <p className="text-muted-foreground mb-6">
                        Use our advanced AI to create customized trading strategies tailored to your goals
                      </p>
                      <Button onClick={() => setDialogOpen(true)} className="gap-2">
                        <Plus className="w-4 h-4" />
                        Create Strategy with AI
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="templates" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {strategyTemplates.map((template) => (
                    <Card key={template.name} className="bg-card border-border hover:border-primary/50 transition-all cursor-pointer">
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <template.icon className="w-5 h-5 text-primary" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-semibold">{template.name}</h3>
                            <Badge variant="outline" className="text-xs mt-1">{template.risk} Risk</Badge>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">{template.description}</p>
                        <Button size="sm" variant="outline" className="w-full">
                          Use Template
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
