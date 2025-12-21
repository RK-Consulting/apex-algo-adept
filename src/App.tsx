// FRONTEND /src/App.tsx 
import { useEffect } from "react";
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
import ICICICallback from "./pages/ICICICallback";

const queryClient = new QueryClient();

const App = () => {
  /* -------------------------------------------------------
   * GLOBAL ICICI SESSION EXPIRY + MISSING HANDLER
   * -----------------------------------------------------*/
  useEffect(() => {
    function handleExpired() {
      console.log("⚠️ ICICI session expired");
      localStorage.removeItem("icici_connected");

      window.dispatchEvent(
        new CustomEvent("SHOW_ICICI_RECONNECT_DIALOG", {
          detail: { expired: true },
        })
      );
    }

    function handleMissing() {
      console.log("⚠️ ICICI session missing");

      window.dispatchEvent(
        new CustomEvent("SHOW_ICICI_RECONNECT_DIALOG", {
          detail: { missing: true },
        })
      );
    }

    window.addEventListener("ICICI_SESSION_EXPIRED", handleExpired);
    window.addEventListener("ICICI_SESSION_MISSING", handleMissing);

    return () => {
      window.removeEventListener("ICICI_SESSION_EXPIRED", handleExpired);
      window.removeEventListener("ICICI_SESSION_MISSING", handleMissing);
    };
  }, []);

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
            <Route path="/icici-callback" element={<ICICICallback />} />

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
