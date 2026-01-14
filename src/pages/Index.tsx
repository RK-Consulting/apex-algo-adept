// /src/pages/Index.tsx
import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { MarketOverview } from "@/components/MarketOverview";
import { Watchlist } from "@/components/Watchlist";
import { StrategyBuilder } from "@/components/StrategyBuilder";
import { TradingPanel } from "@/components/TradingPanel";
import { PortfolioOverview } from "@/components/PortfolioOverview";
import { usePortfolioData } from "@/hooks/usePortfolioData";
import { useIcici } from "@/context/IciciContext"; // Added Context
import { AlertCircle, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const { isConnected, fsmState } = useIcici();
  const { totalValue, totalPnL } = usePortfolioData();
  const navigate = useNavigate();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <div className="container mx-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
            
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  AlphaForge
                </h1>
                <p className="text-muted-foreground text-sm">
                  AI-Powered Algorithmic Trading Platform
                </p>
              </div>

              {/* Portfolio Stats - Only show values if connected, else show placeholder */}
              <div className="flex gap-2 w-full sm:w-auto">
                <div className="px-3 sm:px-4 py-2 rounded-lg bg-card border border-border flex-1 sm:flex-initial">
                  <div className="text-xs text-muted-foreground">Portfolio Value</div>
                  <div className={`text-lg sm:text-xl font-mono font-bold ${isConnected ? 'text-success' : 'text-muted-foreground/50'}`}>
                    {isConnected ? `₹${totalValue.toLocaleString('en-IN')}` : '₹ --'}
                  </div>
                </div>
                <div className="px-3 sm:px-4 py-2 rounded-lg bg-card border border-border flex-1 sm:flex-initial">
                  <div className="text-xs text-muted-foreground">Today's P&L</div>
                  <div className={`text-lg sm:text-xl font-mono font-bold ${!isConnected ? 'text-muted-foreground/50' : totalPnL >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {isConnected ? `${totalPnL >= 0 ? '+' : ''}₹${totalPnL.toLocaleString('en-IN')}` : '₹ --'}
                  </div>
                </div>
              </div>
            </div>

            {/* Broker Status Alert - Surgical UX improvement */}
            {!isConnected && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="text-destructive w-5 h-5" />
                  <div>
                    <p className="text-sm font-medium text-destructive">Broker Disconnected</p>
                    <p className="text-xs text-muted-foreground">Live data and order execution are disabled. State: {fsmState}</p>
                  </div>
                </div>
                <Button size="sm" variant="destructive" onClick={() => navigate('/settings')}>
                  <Link2 className="w-4 h-4 mr-2" />
                  Reconnect ICICI
                </Button>
              </div>
            )}

            {/* Market Overview */}
            <MarketOverview />

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column */}
              <div className="lg:col-span-2 space-y-6">
                {/* We pass isConnected to sub-components so they can show 'Skeleton' states or lock buttons */}
                <PortfolioOverview />
                <StrategyBuilder />
              </div>

              {/* Right Column */}
              <div className="space-y-6">
                <Watchlist />
                <TradingPanel />
              </div>
            </div>
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

export default Index;
