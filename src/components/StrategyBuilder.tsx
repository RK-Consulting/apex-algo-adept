import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Play, Pause, Plus, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CreateStrategyDialog } from "@/components/CreateStrategyDialog";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

export function StrategyBuilder() {
  const [strategies, setStrategies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { toast } = useToast();
  const navigate = useNavigate();

  const backendUrl =
    import.meta.env.VITE_BACKEND_URL || "https://api.alphaforge.skillsifter.in";

  const token = localStorage.getItem("authToken");

  useEffect(() => {
    fetchStrategies();
  }, []);

  const fetchStrategies = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/strategies`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unable to load strategies");

      setStrategies(data || []);
    } catch (error) {
      console.error("Error fetching strategies:", error);
      toast({
        title: "Error",
        description: "Failed to fetch strategies",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleStrategyStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "paused" : "active";

    try {
      const res = await fetch(`${backendUrl}/api/strategies/${id}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update status");

      toast({
        title: "Updated",
        description: `Strategy ${newStatus} successfully.`,
      });

      fetchStrategies();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update strategy",
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
            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-accent" />
            </div>
            <div className="flex-1">
              <h4 className="font-semibold text-sm mb-1">AI Suggestion</h4>
              <p className="text-xs text-muted-foreground mb-2">
                Consider deploying a volatility arbitrage strategy.
              </p>
              <Button size="sm" variant="outline" className="h-7 text-xs">
                View Strategy
              </Button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading strategies...
          </div>
        ) : strategies.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No strategies yet. Create your first strategy!
          </div>
        ) : (
          <div className="space-y-3">
            {strategies.map((s) => {
              const performance = s.performance_data?.total_return || 0;

              return (
                <div
                  key={s.id}
                  className="p-4 rounded-lg bg-muted/30 border hover:border-primary/50"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-sm">{s.name}</h4>

                        <Badge
                          variant={s.status === "active" ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {s.status}
                        </Badge>
                      </div>

                      <div className="text-xs text-muted-foreground">
                        {s.performance_data?.trades || 0} trades • Win rate{" "}
                        {s.performance_data?.win_rate || 0}%
                      </div>
                    </div>

                    <div
                      className={`flex items-center gap-1 font-mono ${
                        performance >= 0 ? "text-success" : "text-destructive"
                      }`}
                    >
                      <TrendingUp className="w-4 h-4" />
                      {performance >= 0 ? "+" : ""}
                      {performance}%
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => toggleStrategyStatus(s.id, s.status)}
                    >
                      {s.status === "active" ? (
                        <>
                          <Pause className="w-3 h-3 mr-1" /> Pause
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3 mr-1" /> Resume
                        </>
                      )}
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() => viewStrategyDetails(s.id)}
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
