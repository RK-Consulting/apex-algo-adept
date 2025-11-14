import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Brain, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const strategySchema = z.object({
  name: z.string().trim().min(1).max(100),
  trading_style: z.enum(["Scalping", "Intraday", "Swing", "Positional"]),
  capital_allocation: z.number().min(1000).max(100000000),
  risk_level: z.enum(["Low", "Medium", "High"]),
  description: z.string().max(1000).optional(),
});

export function CreateStrategyDialog({ open, onOpenChange, onStrategyCreated }) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const backendUrl =
    import.meta.env.VITE_BACKEND_URL || "https://api.alphaforge.skillsifter.in";

  const token = localStorage.getItem("authToken");

  const [formData, setFormData] = useState({
    name: "",
    trading_style: "Intraday",
    capital_allocation: "",
    risk_level: "Medium",
    description: "",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validation = strategySchema.safeParse({
        ...formData,
        capital_allocation: parseFloat(formData.capital_allocation),
      });

      if (!validation.success) {
        toast({
          title: "Validation Error",
          description: validation.error.errors[0].message,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const res = await fetch(`${backendUrl}/api/strategies/ai`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(validation.data),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate strategy");

      toast({
        title: "Success!",
        description: "AI generated your strategy.",
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
      toast({
        title: "Error",
        description: error.message,
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
            <Brain className="w-6 h-6 text-accent" /> Create AI Strategy
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Input grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Trading Style *</Label>
              <Select
                value={formData.trading_style}
                onValueChange={(v) =>
                  setFormData({ ...formData, trading_style: v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
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
              <Label>Capital (₹) *</Label>
              <Input
                type="number"
                value={formData.capital_allocation}
                onChange={(e) =>
                  setFormData({ ...formData, capital_allocation: e.target.value })
                }
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Risk Level *</Label>
              <Select
                value={formData.risk_level}
                onValueChange={(v) =>
                  setFormData({ ...formData, risk_level: v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
            />
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...
                </>
              ) : (
                <>
                  <Brain className="w-4 h-4 mr-2" /> Generate Strategy
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              disabled={loading}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
