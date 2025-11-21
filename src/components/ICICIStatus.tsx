// /src/components/ICICIStatus.tsx
import { useIciciStatus } from "@/hooks/useIciciStatus";
import { Button } from "@/components/ui/button";
import { ICICI } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function ICICIStatus() {
  const { loading, connected, hasCredentials, lastUpdated, refresh } = useIciciStatus();
  const { toast } = useToast();

  async function handleConnect() {
    try {
      await ICICI.connect();
      toast({ title: "ICICI session activated" });
      refresh();
    } catch (err: any) {
      toast({ title: "Connect error", description: err?.message, variant: "destructive" });
    }
  }

  if (loading) return <p>Checking ICICI status...</p>;

  return (
    <div className="p-4 rounded border shadow-sm bg-white">
      <h3 className="font-semibold text-lg mb-2">ICICI Direct (Breeze)</h3>

      <p>
        Status:{" "}
        <span className={connected ? "text-green-600" : "text-red-600"}>
          {connected ? "Connected" : "Not Connected"}
        </span>
      </p>

      <p>Credentials saved: {hasCredentials ? "Yes" : "No"}</p>
      {lastUpdated && (
        <p className="text-sm text-gray-500">Updated: {new Date(lastUpdated).toLocaleString()}</p>
      )}

      <div className="mt-3 space-x-2">
        <Button onClick={refresh} variant="secondary">Refresh</Button>
        {!connected && hasCredentials && <Button onClick={handleConnect}>Activate Session</Button>}
      </div>
    </div>
  );
}
