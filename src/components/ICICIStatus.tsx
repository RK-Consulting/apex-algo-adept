// src/components/ICICIStatus.tsx
import { useIciciStatus } from "@/hooks/useIciciStatus";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function ICICIStatus() {
  const { loading, connected, hasCredentials, lastUpdated, refresh } =
    useIciciStatus();

  const { toast } = useToast();

  function openIciciLoginPopup() {
    const popup = window.open(
      "/api/icici/auth/login",
      "iciciLogin",
      "width=500,height=700"
    );

    if (!popup) {
      toast({
        title: "Popup Blocked",
        description: "Please allow popups to authenticate ICICI.",
        variant: "destructive",
      });
    }
  }

  function triggerReconnectDialog() {
    window.dispatchEvent(
      new CustomEvent("SHOW_ICICI_RECONNECT_DIALOG", {
        detail: { manual: true },
      })
    );
  }

  if (loading) return <p>Checking ICICI status...</p>;

  return (
    <div className="p-4 rounded border shadow-sm bg-white">
      <h3 className="font-semibold text-lg mb-2">ICICI Direct (Breeze)</h3>

      {/* Connection Status */}
      <p>
        Status:{" "}
        <span className={connected ? "text-green-600" : "text-red-600"}>
          {connected ? "Connected" : "Not Connected"}
        </span>
      </p>

      <p>Credentials saved: {hasCredentials ? "Yes" : "No"}</p>

      {lastUpdated && (
        <p className="text-sm text-gray-500">
          Updated: {new Date(lastUpdated).toLocaleString()}
        </p>
      )}

      {/* Action Buttons */}
      <div className="mt-3 space-x-2">
        <Button variant="secondary" onClick={refresh}>
          Refresh
        </Button>

        {/* NOT CONNECTED → Show Connect Button */}
        {!connected && (
          <>
            {/* If credentials exist → open ICICI popup */}
            {hasCredentials && (
              <Button onClick={openIciciLoginPopup}>Connect Now</Button>
            )}

            {/* If credentials missing → open full dialog */}
            {!hasCredentials && (
              <Button onClick={triggerReconnectDialog}>
                Setup & Connect
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
