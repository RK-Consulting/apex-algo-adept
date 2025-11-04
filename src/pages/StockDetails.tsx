import { useParams, useNavigate } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { StockChart } from "@/components/StockChart";
import { useMarketData } from "@/hooks/useMarketData";

const StockDetails = () => {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  
  const { data: marketData, loading } = useMarketData([
    { symbol: symbol || "NIFTY", exchange: "NSE" }
  ]);

  const stockInfo = marketData[0];

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <div className="container mx-auto p-6 space-y-6">
            <Button 
              variant="ghost" 
              onClick={() => navigate(-1)}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Button>

            {loading ? (
              <div className="text-center text-muted-foreground py-8">Loading...</div>
            ) : !stockInfo ? (
              <div className="text-center text-muted-foreground py-8">
                Connect to ICICI broker to view stock data
              </div>
            ) : (
              <StockChart
                symbol={stockInfo.symbol}
                data={[]}
                currentPrice={stockInfo.price}
                change={stockInfo.change}
                changePercent={stockInfo.change_percent}
              />
            )}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default StockDetails;
