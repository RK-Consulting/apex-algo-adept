// /src/pages/Logout.tsx

import { useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const Logout = () => {
  const { toast } = useToast();

  useEffect(() => {
    // 🔥 HARD LOGOUT — kill entire React tree
    localStorage.removeItem("token");
    localStorage.removeItem("authToken");
    localStorage.removeItem("icici_connected");

    toast({
      title: "Logged out",
      description: "You've been successfully logged out",
    });

    // ⚠️ MUST be replace — NOT navigate()
    window.location.replace("/login");
  }, [toast]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
};

export default Logout;
