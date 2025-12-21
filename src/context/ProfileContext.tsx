// /src/context/ProfileContext.tsx
import { createContext, useContext, useEffect, useState } from "react";

const backendUrl =
  import.meta.env.VITE_BACKEND_URL ||
  import.meta.env.VITE_API_URL ||
  "https://api.alphaforge.skillsifter.in";

type ProfileState = {
  profile: any | null;
  isComplete: boolean;
  loading: boolean;
  refresh: () => void;
};

const ProfileContext = createContext<ProfileState | null>(null);

export const ProfileProvider = ({ children }: { children: React.ReactNode }) => {
  const [profile, setProfile] = useState<any | null>(null);
  const [isComplete, setIsComplete] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchProfile = () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    setLoading(true);
    fetch(`${backendUrl}/api/profile`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.exists) {
          setProfile(data.profile);
          setIsComplete(data.isComplete);
        } else {
          setProfile(null);
          setIsComplete(false);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  return (
    <ProfileContext.Provider
      value={{ profile, isComplete, loading, refresh: fetchProfile }}
    >
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used inside ProfileProvider");
  return ctx;
};
