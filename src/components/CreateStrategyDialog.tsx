import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Brain, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CreateStrategyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStrategyCreated?: () => void;
}

export function CreateStrategyDialog({ open, onOpenChange, onStrategyCreated }: CreateStrategyDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: "",
    trading_style: "Intraday",
    capital_allocation: "",
    risk_level: "Medium",
    description: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast({
          title: "Authentication required",
          description: "Please sign in to create strategies",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.functions.invoke('generate-strategy', {
        body: {
          name: formData.name,
          trading_style: formData.trading_style,
          capital_allocation: parseFloat(formData.capital_allocation),
          risk_level: formData.risk_level,
          description: formData.description,
        },
      });

      if (error) throw error;

      toast({
        title: "Success!",
        description: "AI has generated your trading strategy",
      });

      onStrategyCreated?.();
      onOpenChange(false);
      setFormData({
        name: "",
        trading_style: "Intraday",
        capital_allocation: "",
        risk_level: "Medium",
        description: "",
      });
    } catch (error) {
      console.error('Error creating strategy:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate strategy",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Brain className="w-6 h-6 text-accent" />
            Create AI-Powered Strategy
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Strategy Name *</Label>
              <Input
                id="name"
                placeholder="e.g., My Momentum Strategy"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="trading_style">Trading Style *</Label>
              <Select
                value={formData.trading_style}
                onValueChange={(value) => setFormData({ ...formData, trading_style: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Scalping">Scalping</SelectItem>
                  <SelectItem value="Intraday">Intraday</SelectItem>
                  <SelectItem value="Swing">Swing</SelectItem>
                  <SelectItem value="Positional">Positional</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="capital">Capital Allocation (₹) *</Label>
              <Input
                id="capital"
                type="number"
                placeholder="500000"
                value={formData.capital_allocation}
                onChange={(e) => setFormData({ ...formData, capital_allocation: e.target.value })}
                required
                min="1000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="risk_level">Risk Level *</Label>
              <Select
                value={formData.risk_level}
                onValueChange={(value) => setFormData({ ...formData, risk_level: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Low">Low Risk</SelectItem>
                  <SelectItem value="Medium">Medium Risk</SelectItem>
                  <SelectItem value="High">High Risk</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Strategy Description</Label>
            <Textarea
              id="description"
              placeholder="Describe your strategy goals, preferred indicators, market conditions..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="min-h-32"
            />
          </div>

          <div className="p-4 rounded-lg bg-accent/10 border border-accent/20">
            <div className="flex items-start gap-3">
              <Brain className="w-5 h-5 text-accent flex-shrink-0 mt-1" />
              <div>
                <h4 className="font-semibold text-sm mb-1">AI Strategy Generation</h4>
                <p className="text-xs text-muted-foreground">
                  Our AI will analyze your requirements and generate optimized entry/exit rules, 
                  risk management parameters, and technical indicator configurations tailored for 
                  the Indian stock market.
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Brain className="w-4 h-4 mr-2" />
                  Generate Strategy
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
