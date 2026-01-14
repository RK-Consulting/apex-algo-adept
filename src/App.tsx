// FRONTEND /src/App.tsx 
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ProfileProvider } from "@/context/ProfileContext";
import { IciciProvider } from "@/context/IciciContext"; // Added Context

// Pages
import Index from "./pages/Index";
import Markets from "./pages/Markets";
import Strategies from "./pages/Strategies";
import Portfolio from "./pages/Portfolio";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import Logout from "./pages/Logout";
import NotFound from "./pages/NotFound";
import StockDetails from "./pages/StockDetails";
import Login from "./pages/Login";
import Signup from "./pages/Signup";

const queryClient = new QueryClient();

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />

        <BrowserRouter>
          <Routes>
            {/* ---------- PUBLIC ROUTES ---------- */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            
            {/* ---------- PROTECTED ROUTES ---------- */}
            {/* Surgical Fix: Wrapped all protected routes in Profile & ICICI Providers.
                This ensures global state for the Aggregator and Connector.
            */}
            <Route
              element={
                <ProtectedRoute>
                  <ProfileProvider>
                    <IciciProvider>
                      <Index />
                    </IciciProvider>
                  </ProfileProvider>
                </ProtectedRoute>
              }
              path="/"
            />

            <Route
              path="/markets"
              element={
                <ProtectedRoute>
                  <ProfileProvider>
                    <IciciProvider>
                      <Markets />
                    </IciciProvider>
                  </ProfileProvider>
                </ProtectedRoute>
              }
            />

            <Route
              path="/strategies"
              element={
                <ProtectedRoute>
                  <ProfileProvider>
                    <IciciProvider>
                      <Strategies />
                    </IciciProvider>
                  </ProfileProvider>
                </ProtectedRoute>
              }
            />

            <Route
              path="/portfolio"
              element={
                <ProtectedRoute>
                  <ProfileProvider>
                    <IciciProvider>
                      <Portfolio />
                    </IciciProvider>
                  </ProfileProvider>
                </ProtectedRoute>
              }
            />

            <Route
              path="/analytics"
              element={
                <ProtectedRoute>
                  <ProfileProvider>
                    <IciciProvider>
                      <Analytics />
                    </IciciProvider>
                  </ProfileProvider>
                </ProtectedRoute>
              }
            />

            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <ProfileProvider>
                    <IciciProvider>
                      <Settings />
                    </IciciProvider>
                  </ProfileProvider>
                </ProtectedRoute>
              }
            />

            <Route
              path="/stock/:symbol"
              element={
                <ProtectedRoute>
                  <ProfileProvider>
                    <IciciProvider>
                      <StockDetails />
                    </IciciProvider>
                  </ProfileProvider>
                </ProtectedRoute>
              }
            />

            <Route path="/logout" element={<Logout />} />

            {/* ---------- FALLBACK ---------- */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
