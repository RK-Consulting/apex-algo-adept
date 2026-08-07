// /src/pages/settings/Profile.tsx
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useProfile } from "@/context/ProfileContext";

const Profile = () => {
  const { toast } = useToast();

  const [profile, setProfile] = useState({
    full_name: "",
    email: "",
    phone: "",
    pan: "",
  });

  const [saving, setSaving] = useState(false);
  const [profileLocked, setProfileLocked] = useState(false);

  const {
    profile: ctxProfile,
    isComplete,
    loading: profileLoading,
  } = useProfile();

  /* ================= LOAD PROFILE FROM CONTEXT ================= */
  useEffect(() => {
    if (!ctxProfile) return;

    setProfile({
      full_name: ctxProfile.full_name || "",
      email: ctxProfile.email || "",
      phone: ctxProfile.phone || "",
      pan: ctxProfile.pan || "",
    });

    if (isComplete) {
      setProfileLocked(true);
    }
  }, [ctxProfile, isComplete]);

  /* ================= SAVE PROFILE (FIRST TIME ONLY) ================= */
  const handleSave = async () => {
    if (profileLocked) return;

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
      const res = await fetch(
        `${
          import.meta.env.VITE_BACKEND_URL ||
          import.meta.env.VITE_API_URL ||
          "https://api.alphaforge.skillsifter.in"
        }/api/profile`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            full_name: profile.full_name,
            phone: profile.phone,
            pan: profile.pan,
          }),
        }
      );

      if (!res.ok) throw new Error();

      toast({
        title: "Profile locked",
        description:
          "Profile submitted successfully. Contact admin for any changes.",
      });

      setProfileLocked(true);
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
          {profileLocked && (
            <span className="flex items-center gap-1 text-sm text-muted-foreground ml-2">
              <Lock className="w-4 h-4" /> Locked
            </span>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {profileLocked && (
          <div className="md:col-span-2 p-3 rounded-md bg-muted text-sm text-muted-foreground">
            Your profile is locked after submission.
            <br />
            Please contact <b>Admin</b> for any changes.
          </div>
        )}

        <div>
          <Label>Full Name</Label>
          <Input value={profile.full_name} readOnly />
        </div>

        <div>
          <Label>Email</Label>
          <Input type="email" value={profile.email} readOnly />
        </div>

        <div>
          <Label>Phone</Label>
          <Input
            value={profile.phone}
            readOnly={profileLocked}
            disabled={profileLoading}
            onChange={(e) =>
              setProfile({ ...profile, phone: e.target.value })
            }
          />
        </div>

        <div>
          <Label>PAN</Label>
          <Input
            value={profile.pan}
            readOnly={profileLocked}
            disabled={profileLoading}
            onChange={(e) =>
              setProfile({ ...profile, pan: e.target.value })
            }
          />
        </div>

        {!profileLocked && (
          <Button
            className="md:col-span-2"
            onClick={handleSave}
            disabled={profileLoading || saving}
          >
            Submit & Lock Profile
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

export default Profile;
