// src/components/ProtectedRoute.tsx
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { authService } from '../services/authService';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  const backendUrl =
    import.meta.env.VITE_BACKEND_URL || "https://api.alphaforge.skillsifter.in";

  useEffect(() => {
    // ✅ minimal change: allow BOTH tokens during migration
    //const token = localStorage.getItem("authToken") || localStorage.getItem("token");
    const verifyAuth = async () => {
      const token = authService.getToken();

    console.log("[ProtectedRoute] Token found:", !!token);
    console.log("[ProtectedRoute] Backend URL:", import.meta.env.VITE_API_URL || 'https://api.alphaforge.skillsifter.in');
    // backendUrl);
    if (!token) {
      setAuthenticated(false);
      setLoading(false);
      return;
    }
    
    try {
        const isValid = await authService.verifyToken();
        setIsAuthenticated(isValid);
      } catch (error) {
        console.error('[ProtectedRoute] Verification failed:', error);
        setIsAuthenticated(false);
      } finally {
        setIsVerifying(false);
      }
    };
    
    // 🔥 backend verification
  /*  fetch(`${backendUrl}/api/auth/verify`, {
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
  }, []);*/

    verifyAuth();
  }, [location.pathname]);

  // 🔒 hold UI until verify completes
  // if (loading) {
  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Verifying authentication...</div>
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // ❌ not authenticated → redirect
  // if (!authenticated) {
  if (isAuthenticated === false) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // ✔ authenticated → allow page to render
  return <>{children}</>;
}
