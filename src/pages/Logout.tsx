
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const Logout = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const logout = async () => {
      // ❌ Not using Supabase anymore → Remove supabase.auth.signOut()

      // ✅ Clear backend JWT token
      localStorage.removeItem("token");
      localStorage.removeItem("authToken"); // in case some pages still used this

      toast({
        title: "Logged out",
        description: "You've been successfully logged out",
      });

      navigate("/login");
    };

    logout();
  }, [navigate, toast]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
};

export default Logout;
