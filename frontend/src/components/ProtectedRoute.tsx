// src/components/ProtectedRoute.tsx
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  const backendUrl =
    import.meta.env.VITE_BACKEND_URL || "https://api.alphaforge.skillsifter.in";

  useEffect(() => {
    // ✅ minimal change: allow BOTH tokens during migration
    const token =
      localStorage.getItem("authToken") || localStorage.getItem("token");

    console.log("[ProtectedRoute] Token found:", !!token);
    console.log("[ProtectedRoute] Backend URL:", backendUrl);

    if (!token) {
      setAuthenticated(false);
      setLoading(false);
      return;
    }

    // 🔥 backend verification
    fetch(`${backendUrl}/api/auth/verify`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        setAuthenticated(res.ok);
      })
      .catch(() => {
        setAuthenticated(false);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // 🔒 hold UI until verify completes
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // ❌ not authenticated → redirect
  if (!authenticated) {
    return <Navigate to="/login" replace />;
  }

  // ✔ authenticated → allow page to render
  return <>{children}</>;
}
