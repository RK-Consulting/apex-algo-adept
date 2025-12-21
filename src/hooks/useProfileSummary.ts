// /src/hooks/useProfileSummary.ts
import { useEffect, useState } from "react";

const backendUrl =
  import.meta.env.VITE_BACKEND_URL ||
  import.meta.env.VITE_API_URL ||
  "https://api.alphaforge.skillsifter.in";

export const useProfileSummary = () => {
  const [summary, setSummary] = useState<{
    full_name?: string;
    email?: string;
  }>({});

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
        if (data?.exists) {
          setSummary({
            full_name: data.profile?.full_name,
            email: data.profile?.email,
          });
        }
      })
      .catch(() => {
        // Silent failure — sidebar must never break UI
      });
  }, []);

  return summary;
};
