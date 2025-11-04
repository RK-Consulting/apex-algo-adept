import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Play, Pause, Plus, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CreateStrategyDialog } from "@/components/CreateStrategyDialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

export function StrategyBuilder() {
  const [strategies, setStrategies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchStrategies();
  }, []);

  const fetchStrategies = async () => {
    try {
      const { data, error } = await supabase
        .from('strategies')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setStrategies(data || []);
    } catch (error) {
      console.error('Error fetching strategies:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleStrategyStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    
    try {
      const { error } = await supabase
        .from('strategies')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Strategy Updated",
        description: `Strategy ${newStatus === 'active' ? 'resumed' : 'paused'} successfully.`,
      });

      fetchStrategies();
    } catch (error) {
      console.error('Error updating strategy:', error);
      toast({
        title: "Error",
        description: "Failed to update strategy status.",
        variant: "destructive",
      });
    }
  };

  const viewStrategyDetails = (id: string) => {
    navigate(`/strategies?id=${id}`);
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-accent" />
            AI Strategy Builder
          </CardTitle>
          <Button 
            variant="default" 
            size="sm" 
            className="gap-2 w-full sm:w-auto"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="w-4 h-4" />
            Create Strategy
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <CreateStrategyDialog 
          open={dialogOpen} 
          onOpenChange={setDialogOpen}
          onStrategyCreated={fetchStrategies}
        />
        
        {/* AI Suggestion Banner */}
        <div className="p-4 rounded-lg bg-gradient-to-r from-accent/10 to-primary/10 border border-accent/20">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-4 h-4 text-accent" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-sm mb-1">AI Recommendation</h4>
              <p className="text-xs text-muted-foreground mb-2">
                Based on current market conditions, consider adding a "Volatility Arbitrage" strategy
                for NIFTY options.
              </p>
              <Button size="sm" variant="outline" className="h-7 text-xs">
                View Strategy
              </Button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center text-muted-foreground py-8">Loading strategies...</div>
        ) : strategies.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No strategies yet. Create your first strategy to get started!
          </div>
        ) : (
          <div className="space-y-3">
            {strategies.map((strategy) => {
              const performanceData = strategy.performance_data as any;
              const trades = performanceData?.trades || 0;
              const winRate = performanceData?.win_rate || 0;
              const performance = performanceData?.total_return || 0;
              
              return (
                <div
                  key={strategy.id}
                  className="p-4 rounded-lg bg-muted/30 border border-border hover:border-primary/50 transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-sm">{strategy.name}</h4>
                        <Badge
                          variant={strategy.status === "active" ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {strategy.status}
                        </Badge>
                        {strategy.ai_generated && (
                          <Badge variant="outline" className="text-xs">
                            <Sparkles className="w-3 h-3 mr-1" />
                            AI
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{trades} trades</span>
                        <span>Win rate: {winRate}%</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`flex items-center gap-1 font-mono font-bold ${
                        performance >= 0 ? 'text-success' : 'text-destructive'
                      }`}>
                        <TrendingUp className="w-4 h-4" />
                        {performance >= 0 ? '+' : ''}{performance}%
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="h-8 text-xs flex-1"
                      onClick={() => toggleStrategyStatus(strategy.id, strategy.status)}
                    >
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
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="h-8 text-xs flex-1"
                      onClick={() => viewStrategyDetails(strategy.id)}
                    >
                      View Details
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
