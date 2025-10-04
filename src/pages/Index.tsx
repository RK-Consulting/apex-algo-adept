import { AppSidebar } from "@/components/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { MarketOverview } from "@/components/MarketOverview";
import { Watchlist } from "@/components/Watchlist";
import { StrategyBuilder } from "@/components/StrategyBuilder";
import { TradingPanel } from "@/components/TradingPanel";
import { PortfolioOverview } from "@/components/PortfolioOverview";

const Index = () => {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <div className="container mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  AlphaForge
                </h1>
                <p className="text-muted-foreground text-sm">
                  AI-Powered Algorithmic Trading Platform
                </p>
              </div>
              <div className="flex gap-2">
                <div className="px-4 py-2 rounded-lg bg-card border border-border">
                  <div className="text-xs text-muted-foreground">Portfolio Value</div>
                  <div className="text-xl font-mono font-bold text-success">
                    ₹12,45,678
                  </div>
                </div>
                <div className="px-4 py-2 rounded-lg bg-card border border-border">
                  <div className="text-xs text-muted-foreground">Today's P&L</div>
                  <div className="text-xl font-mono font-bold text-success">
                    +₹8,945
                  </div>
                </div>
              </div>
            </div>

            {/* Market Overview */}
            <MarketOverview />

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column */}
              <div className="lg:col-span-2 space-y-6">
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
