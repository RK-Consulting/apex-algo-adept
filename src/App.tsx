// FRONTEND /src/App.tsx 
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { ProfileProvider } from "@/context/ProfileContext";

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
  // DELETED: All Option 1 ICICI event listeners

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
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <ProfileProvider>
                    <Index />
                  </ProfileProvider>
                </ProtectedRoute>
              }
            />

            <Route
              path="/markets"
              element={
                <ProtectedRoute>
                  <ProfileProvider>
                    <Markets />
                  </ProfileProvider>
                </ProtectedRoute>
              }
            />

            <Route
              path="/strategies"
              element={
                <ProtectedRoute>
                  <ProfileProvider>
                    <Strategies />
                  </ProfileProvider>
                </ProtectedRoute>
              }
            />

            <Route
              path="/portfolio"
              element={
                <ProtectedRoute>
                  <ProfileProvider>
                    <Portfolio />
                  </ProfileProvider>
                </ProtectedRoute>
              }
            />

            <Route
              path="/analytics"
              element={
                <ProtectedRoute>
                  <ProfileProvider>
                    <Analytics />
                  </ProfileProvider>
                </ProtectedRoute>
              }
            />

            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <ProfileProvider>
                    <Settings />
                  </ProfileProvider>
                </ProtectedRoute>
              }
            />

            <Route
              path="/stock/:symbol"
              element={
                <ProtectedRoute>
                  <ProfileProvider>
                    <StockDetails />
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
