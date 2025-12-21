// /src/pages/settings/Profile.tsx

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const backendUrl =
  import.meta.env.VITE_BACKEND_URL ||
  import.meta.env.VITE_API_URL ||
  "https://api.alphaforge.skillsifter.in";

const Profile = () => {
  const { toast } = useToast();

  const [profile, setProfile] = useState({
    full_name: "",
    email: "",
    phone: "",
    pan: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  /* ================= LOAD PROFILE ================= */
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    fetch(`${backendUrl}/api/profile`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.exists) {
          setProfile(data.profile);
        }
      })
      .catch(() => {
        toast({
          title: "Error",
          description: "Failed to load profile",
          variant: "destructive",
        });
      })
      .finally(() => setLoading(false));
  }, []);

  /* ================= SAVE PROFILE ================= */
  const handleSave = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      toast({
        title: "Session expired",
        description: "Please login again",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`${backendUrl}/api/profile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(profile),
      });

      if (!res.ok) throw new Error();

      toast({
        title: "Profile saved",
        description: "Your profile has been updated",
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to save profile",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  /* ================= UI ================= */
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="w-5 h-5" />
          Profile Information
        </CardTitle>
      </CardHeader>

      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Full Name</Label>
          <Input
            value={profile.full_name}
            onChange={(e) =>
              setProfile({ ...profile, full_name: e.target.value })
            }
            disabled={loading}
          />
        </div>

        <div>
          <Label>Email</Label>
          <Input
            type="email"
            value={profile.email}
            onChange={(e) =>
              setProfile({ ...profile, email: e.target.value })
            }
            disabled={loading}
          />
        </div>

        <div>
          <Label>Phone</Label>
          <Input
            value={profile.phone}
            onChange={(e) =>
              setProfile({ ...profile, phone: e.target.value })
            }
            disabled={loading}
          />
        </div>

        <div>
          <Label>PAN</Label>
          <Input
            value={profile.pan}
            onChange={(e) =>
              setProfile({ ...profile, pan: e.target.value })
            }
            disabled={loading}
          />
        </div>

        <Button
          className="md:col-span-2"
          onClick={handleSave}
          disabled={loading || saving}
        >
          Save Changes
        </Button>
      </CardContent>
    </Card>
  );
};

export default Profile;
