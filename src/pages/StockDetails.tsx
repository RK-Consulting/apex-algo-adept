import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { StockChart } from "@/components/StockChart";
import { generateChartData, useMarketData } from "@/hooks/useMarketData";

const StockDetails = () => {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const [chartData, setChartData] = useState<any[]>([]);
  
  const { data: marketData } = useMarketData([
    { symbol: symbol || "NIFTY", exchange: "NSE" }
  ]);

  const stockInfo = marketData[0] || {
    symbol: symbol || "NIFTY",
    price: 19500,
    change: 125.50,
    change_percent: 0.65,
  };

  useEffect(() => {
    // Generate chart data when component mounts
    const data = generateChartData(stockInfo.symbol, stockInfo.price);
    setChartData(data);
  }, [stockInfo.symbol, stockInfo.price]);

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

            <StockChart
              symbol={stockInfo.symbol}
              data={chartData}
              currentPrice={stockInfo.price}
              change={stockInfo.change}
              changePercent={stockInfo.change_percent}
            />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default StockDetails;
