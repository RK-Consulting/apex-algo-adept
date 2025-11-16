import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  const backendUrl =
    import.meta.env.VITE_BACKEND_URL || "https://api.alphaforge.skillsifter.in";

  useEffect(() => {
    const token =
      localStorage.getItem("authToken") || localStorage.getItem("token");
      console.log("[ProtectedRoute] Token found:", !!token); // ← DEBUG
      console.log("[ProtectedRoute] Backend URL:", backendUrl); // ← DEBUG

    if (!token) {
      setAuthenticated(false);
      setLoading(false);
      return;
    }

    // Validate token with backend
    fetch(`${backendUrl}/api/auth/verify`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => {
        if (res.ok) {
          setAuthenticated(true);
        } else {
          setAuthenticated(false);
        }
      })
      .catch(() => setAuthenticated(false))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
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
