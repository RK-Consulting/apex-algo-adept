// src/components/ProtectedRoute.tsx
import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const location = useLocation();

  const backendUrl =
    import.meta.env.VITE_BACKEND_URL ||
    "https://api.alphaforge.skillsifter.in";

  useEffect(() => {
    let mounted = true;

    async function verifyToken() {
      const token = localStorage.getItem("authToken"); // ← use single storage key

      console.log("[ProtectedRoute] Token:", !!token);
      console.log("[ProtectedRoute] Backend URL:", backendUrl);

      // No token → no API verification → no console errors
      if (!token) {
        if (mounted) {
          setAuthenticated(false);
          setChecking(false);
        }
        return;
      }

      try {
        const res = await fetch(`${backendUrl}/api/auth/verify`, {
          method: "GET",
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!mounted) return;

        if (res.ok) {
          setAuthenticated(true);
        } else {
          setAuthenticated(false);
          localStorage.removeItem("authToken");
        }
      } catch (err) {
        console.warn("[ProtectedRoute] Token verify error:", err);
        if (mounted) setAuthenticated(false);
      } finally {
        if (mounted) setChecking(false);
      }
    }

    verifyToken();

    return () => {
      mounted = false;
    };
  }, [location.pathname]); // re-check on navigation

  // Show loader while checking. Avoids premature data fetches.
  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!authenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
