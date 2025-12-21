// /src/hooks/useProfileSummary.ts
import { useProfile } from "@/context/ProfileContext";

export const useProfileSummary = () => {
  const { profile } = useProfile();

  return {
    full_name: profile?.full_name,
    email: profile?.email,
  };
};
