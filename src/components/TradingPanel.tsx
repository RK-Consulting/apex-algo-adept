import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown } from "lucide-react";

export function TradingPanel() {
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-lg">Quick Trade</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="buy" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="buy" className="data-[state=active]:bg-success/20 data-[state=active]:text-success">
              <TrendingUp className="w-4 h-4 mr-1" />
              Buy
            </TabsTrigger>
            <TabsTrigger value="sell" className="data-[state=active]:bg-destructive/20 data-[state=active]:text-destructive">
              <TrendingDown className="w-4 h-4 mr-1" />
              Sell
            </TabsTrigger>
          </TabsList>

          <TabsContent value="buy" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="symbol" className="text-xs">Symbol</Label>
              <Input
                id="symbol"
                placeholder="e.g., RELIANCE"
                className="h-9 bg-background border-border"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="quantity" className="text-xs">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  placeholder="0"
                  className="h-9 bg-background border-border font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price" className="text-xs">Price</Label>
                <Input
                  id="price"
                  type="number"
                  placeholder="0.00"
                  className="h-9 bg-background border-border font-mono"
                />
              </div>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 border border-border">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Total Value</span>
                <span className="font-mono font-semibold">₹0.00</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Available Margin</span>
                <span className="font-mono font-semibold text-success">₹2,45,000</span>
              </div>
            </div>
            <Button className="w-full bg-success hover:bg-success/90 text-success-foreground">
              <TrendingUp className="w-4 h-4 mr-2" />
              Place Buy Order
            </Button>
          </TabsContent>

          <TabsContent value="sell" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sell-symbol" className="text-xs">Symbol</Label>
              <Input
                id="sell-symbol"
                placeholder="e.g., TCS"
                className="h-9 bg-background border-border"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="sell-quantity" className="text-xs">Quantity</Label>
                <Input
                  id="sell-quantity"
                  type="number"
                  placeholder="0"
                  className="h-9 bg-background border-border font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sell-price" className="text-xs">Price</Label>
                <Input
                  id="sell-price"
                  type="number"
                  placeholder="0.00"
                  className="h-9 bg-background border-border font-mono"
                />
              </div>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 border border-border">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Total Value</span>
                <span className="font-mono font-semibold">₹0.00</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Holdings</span>
                <span className="font-mono font-semibold">0 shares</span>
              </div>
            </div>
            <Button className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground">
              <TrendingDown className="w-4 h-4 mr-2" />
              Place Sell Order
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
