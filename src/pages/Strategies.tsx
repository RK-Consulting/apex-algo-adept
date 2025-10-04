import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Play, Pause, Plus, TrendingUp, Brain, Zap, Target, LineChart } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

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
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Create New Strategy
              </Button>
            </div>

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
                  {activeStrategies.map((strategy) => (
                    <Card key={strategy.name} className="bg-card border-border">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-semibold text-lg">{strategy.name}</h3>
                              <Badge variant={strategy.status === "active" ? "default" : "secondary"}>
                                {strategy.status}
                              </Badge>
                              <Badge variant="outline">{strategy.risk} Risk</Badge>
                            </div>
                            <div className="flex items-center gap-6 text-sm text-muted-foreground">
                              <span>{strategy.trades} trades</span>
                              <span>Win rate: {strategy.winRate}</span>
                              <span>Capital: {strategy.capital}</span>
                              <span>{strategy.timeframe}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="flex items-center gap-1 text-success font-mono font-bold text-xl mb-1">
                              <TrendingUp className="w-5 h-5" />
                              {strategy.performance}
                            </div>
                            <div className="text-xs text-muted-foreground">Total Return</div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="flex-1">
                            {strategy.status === "active" ? (
                              <>
                                <Pause className="w-3 h-3 mr-1" />
                                Pause
                              </>
                            ) : (
                              <>
                                <Play className="w-3 h-3 mr-1" />
                                Resume
                              </>
                            )}
                          </Button>
                          <Button size="sm" variant="outline" className="flex-1">
                            View Details
                          </Button>
                          <Button size="sm" variant="outline" className="flex-1">
                            Edit Strategy
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="builder" className="space-y-4">
                <Card className="bg-card border-border">
                  <CardHeader>
                    <CardTitle>Build Your Custom Strategy</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Strategy Name</Label>
                        <Input placeholder="e.g., My Momentum Strategy" className="bg-background" />
                      </div>
                      <div className="space-y-2">
                        <Label>Trading Style</Label>
                        <Input placeholder="Scalping, Swing, Positional" className="bg-background" />
                      </div>
                      <div className="space-y-2">
                        <Label>Capital Allocation</Label>
                        <Input type="number" placeholder="₹0" className="bg-background font-mono" />
                      </div>
                      <div className="space-y-2">
                        <Label>Risk Level</Label>
                        <Input placeholder="Low, Medium, High" className="bg-background" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Strategy Description</Label>
                      <Textarea
                        placeholder="Describe your strategy logic, entry/exit rules, indicators..."
                        className="bg-background min-h-32"
                      />
                    </div>
                    <div className="p-4 rounded-lg bg-accent/10 border border-accent/20">
                      <div className="flex items-start gap-3">
                        <Sparkles className="w-5 h-5 text-accent flex-shrink-0 mt-1" />
                        <div className="flex-1">
                          <h4 className="font-semibold text-sm mb-1">AI-Powered Strategy Generation</h4>
                          <p className="text-xs text-muted-foreground mb-3">
                            Let AI analyze your requirements and generate optimized strategy parameters
                          </p>
                          <Button size="sm" variant="outline" className="gap-2">
                            <Brain className="w-3 h-3" />
                            Generate with AI
                          </Button>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3 pt-4">
                      <Button className="flex-1">Save Strategy</Button>
                      <Button variant="outline" className="flex-1">Backtest</Button>
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
