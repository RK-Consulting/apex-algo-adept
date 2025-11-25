// src/components/Watchlist.tsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  TrendingUp,
  TrendingDown,
  Plus,
  Trash2,
  Move,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

type Group = { id: string; name: string; symbols: string[]; collapsed?: boolean; position?: number };
type Tick = { stockCode: string; ltp?: number; change?: number; percentChange?: number; volume?: number };

const backendUrl = import.meta.env.VITE_BACKEND_URL || "https://api.alphaforge.skillsifter.in";

const uid = (prefix = "") => prefix + Math.random().toString(36).slice(2, 9);

function percentToColor(p: number | undefined) {
  if (p === undefined || Number.isNaN(p)) return { inline: "rgba(128,128,128,0.08)", textColor: "text-muted-foreground" };
  const clamp = Math.max(-10, Math.min(10, p));
  const ratio = (clamp + 10) / 20;
  const red = Math.round(220 * (1 - ratio));
  const green = Math.round(220 * ratio);
  const inline = `linear-gradient(90deg, rgba(${red},${green},60,0.14), rgba(${red},${green},60,0.06))`;
  const brightness = (red * 299 + green * 587 + 200 * 114) / 1000;
  const textColor = brightness > 140 ? "text-black" : "text-white";
  return { inline, textColor };
}

export function Watchlist() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const token = localStorage.getItem("authToken") || localStorage.getItem("token");
  const wsRef = useRef<WebSocket | null>(null);

  const [groups, setGroups] = useState<Group[]>([]);
  const [liveTicks, setLiveTicks] = useState<Record<string, Tick>>({});
  const [symbolInput, setSymbolInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [dragGroup, setDragGroup] = useState<{ groupId: string; index: number } | null>(null);
  const [dragSymbol, setDragSymbol] = useState<{ symbol: string; fromGroupId: string } | null>(null);
  const undoBuffer = useRef<{ type: "remove-symbol" | "delete-group"; payload: any } | null>(null);

  useEffect(() => {
    async function load() {
      if (!token) {
        setGroups([{ id: uid("g-"), name: "Default", symbols: ["RELIANCE", "TCS", "INFY"], position: 0 }]);
        setLoading(false);
        return;
      }
      try {
        const r = await fetch(`${backendUrl}/api/watchlist`, { headers: { Authorization: `Bearer ${token}` } });
        if (!r.ok) throw new Error("failed");
        const json = await r.json();
        if (Array.isArray(json.groups)) setGroups(json.groups.map((g: any, i: number) => ({ ...g, position: g.position ?? i })));
        else setGroups([{ id: uid("g-"), name: "Default", symbols: [] }]);
      } catch (e) {
        console.warn("watchlist load failed", e);
        setGroups([{ id: uid("g-"), name: "Default", symbols: [] }]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  // WS + polling fallback
  useEffect(() => {
    if (!token) return;
    //const wsUrl = `${backendUrl.replace("https://", "wss://")}/api/icici/stream`;
    //const ws = new WebSocket(wsUrl);
    //const wsUrl = `${backendUrl.replace("http", "ws")}/api/icici/stream?token=${encodeURIComponent(token)}`;
    const wsScheme = backendUrl.startsWith("https") ? "wss" : "ws";
    const wsUrl = `${wsScheme}://${new URL(backendUrl).host}/api/icici/stream?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("Watchlist WS open");
      // subscribe all groups' symbols
      groups.flatMap((g) => g.symbols).forEach((s) => {
        fetch(`${backendUrl}/api/icici/stream/subscribe`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ symbol: s }),
        }).catch(() => {});
      });
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (!msg?.stockCode) return;
        setLiveTicks((prev) => ({ ...prev, [msg.stockCode]: msg }));
      } catch {}
    };

    ws.onclose = () => console.log("Watchlist WS closed");
    ws.onerror = (e) => console.warn("WS err", e);

    const poll = setInterval(async () => {
      const symbols = groups.flatMap((g) => g.symbols);
      if (symbols.length === 0) return;
      try {
        const resp = await fetch(`${backendUrl}/api/icici/market/quotes-bulk`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ symbols }),
        });
        if (!resp.ok) return;
        const json = await resp.json();
        if (json.ticks) setLiveTicks((prev) => ({ ...prev, ...json.ticks }));
      } catch {}
    }, 15000);

    return () => {
      clearInterval(poll);
      try { ws.close(); } catch {}
    };
  }, [groups, token]);

  // persist helper (debounced could be added later)
  async function persistGroups(gList: Group[]) {
    if (!token) return;
    try {
      await fetch(`${backendUrl}/api/watchlist/update-groups`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ groups: gList }),
      });
    } catch (e) {
      console.warn("persist failed", e);
      toast({ title: "Save failed", description: "Could not persist watchlist", variant: "destructive" });
    }
  }

  // symbol operations
  async function addSymbolToGroup(symbol: string, groupId: string) {
    if (!symbol) return;
    const s = symbol.toUpperCase().trim();
    setGroups((prev) => {
      const next = prev.map((g) => (g.id === groupId ? { ...g, symbols: [...g.symbols, s] } : g));
      persistGroups(next);
      return next;
    });
    // subscribe on backend
    if (token) {
      fetch(`${backendUrl}/api/icici/stream/subscribe`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: s }),
      }).catch(() => {});
    }
  }

  async function removeSymbol(symbol: string, groupId: string) {
    // optimistic removal + undo
    const prevGroup = groups.find((g) => g.id === groupId)!;
    undoBuffer.current = { type: "remove-symbol", payload: { symbol, groupId, prevSymbols: [...prevGroup.symbols] } };
    setGroups((prev) => {
      const next = prev.map((g) => (g.id === groupId ? { ...g, symbols: g.symbols.filter((x) => x !== symbol) } : g));
      persistGroups(next);
      return next;
    });
    toast({
      title: "Symbol removed",
      description: "Undo?",
      action: {
        label: "Undo",
        onClick: () => {
          const buf = undoBuffer.current;
          if (!buf || buf.type !== "remove-symbol") return;
          const { symbol: s, groupId: gid, prevSymbols } = buf.payload;
          setGroups((prev) => {
            const next = prev.map((g) => (g.id === gid ? { ...g, symbols: prevSymbols } : g));
            persistGroups(next);
            return next;
          });
          undoBuffer.current = null;
        },
      },
    });

    // unsubscribe
    if (token) {
      fetch(`${backendUrl}/api/icici/stream/unsubscribe`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ symbol }),
      }).catch(() => {});
    }
  }

  // group operations
  function createGroup(name = `Group ${groups.length + 1}`) {
    const g = { id: uid("g-"), name, symbols: [], position: groups.length };
    const next = [...groups, g];
    setGroups(next);
    persistGroups(next);
  }

  function renameGroup(id: string) {
    const name = prompt("Rename group");
    if (!name) return;
    const next = groups.map((g) => (g.id === id ? { ...g, name } : g));
    setGroups(next);
    persistGroups(next);
  }

  function deleteGroup(id: string) {
    const toDelete = groups.find((g) => g.id === id);
    if (!toDelete) return;
    undoBuffer.current = { type: "delete-group", payload: { group: toDelete } };

    let next: Group[] = groups.filter((g) => g.id !== id);
    if (toDelete.symbols.length > 0) {
      // move to first group if exists
      if (next.length === 0) next = [{ id: uid("g-"), name: "Default", symbols: [...toDelete.symbols], position: 0 }];
      else next[0] = { ...next[0], symbols: [...next[0].symbols, ...toDelete.symbols] };
    }
    setGroups(next);
    persistGroups(next);

    toast({
      title: "Group deleted",
      description: "Undo?",
      action: {
        label: "Undo",
        onClick: () => {
          const buf = undoBuffer.current;
          if (!buf || buf.type !== "delete-group") return;
          const { group } = buf.payload;
          setGroups((prev) => {
            const restored = [...prev, group].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
            persistGroups(restored);
            return restored;
          });
          undoBuffer.current = null;
        },
      },
    });
  }

  // drag group handlers
  function onGroupDragStart(e: React.DragEvent, index: number, groupId: string) {
    setDragGroup({ groupId, index });
    e.dataTransfer.setData("application/json", JSON.stringify({ groupId, index }));
    e.dataTransfer.effectAllowed = "move";
  }
  function onGroupDragOver(e: React.DragEvent) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }
  function onGroupDrop(e: React.DragEvent, targetIndex: number) {
    e.preventDefault();
    try {
      const payload = JSON.parse(e.dataTransfer.getData("application/json"));
      if (!payload) return;
      const fromIndex = payload.index;
      if (fromIndex === targetIndex) return;
      const arr = [...groups];
      const [moved] = arr.splice(fromIndex, 1);
      arr.splice(targetIndex, 0, moved);
      // update positions
      const next = arr.map((g, i) => ({ ...g, position: i }));
      setGroups(next);
      persistGroups(next);
    } catch (err) {
      console.warn(err);
    } finally {
      setDragGroup(null);
    }
  }

  // drag symbol handlers (simpler)
  function onSymbolDragStart(e: React.DragEvent, symbol: string, fromGroupId: string) {
    setDragSymbol({ symbol, fromGroupId });
    e.dataTransfer.setData("text/plain", JSON.stringify({ symbol, fromGroupId }));
    e.dataTransfer.effectAllowed = "move";
  }
  function onSymbolDropOnGroup(e: React.DragEvent, targetGroupId: string) {
    e.preventDefault();
    try {
      const p = JSON.parse(e.dataTransfer.getData("text/plain"));
      const { symbol, fromGroupId } = p;
      if (!symbol) return;
      if (fromGroupId === targetGroupId) {
        // append to same group (no-op)
        return;
      }
      setGroups((prev) => {
        const next = prev.map((g) => {
          if (g.id === fromGroupId) return { ...g, symbols: g.symbols.filter((s) => s !== symbol) };
          if (g.id === targetGroupId) return { ...g, symbols: [...g.symbols, symbol] };
          return g;
        });
        persistGroups(next);
        return next;
      });
    } catch {}
    setDragSymbol(null);
  }

  // convenience formatters
  const fmtPrice = (v?: number) => (typeof v === "number" ? v.toFixed(2) : "—");

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex items-center justify-between pb-3">
        <div className="flex items-center gap-4">
          <CardTitle className="text-lg">Advanced Watchlist</CardTitle>
          <Badge variant="outline">{groups.reduce((a, b) => a + (b.symbols?.length ?? 0), 0)} symbols</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => createGroup()} className="gap-2">
            <Plus className="w-4 h-4" /> New Group
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {groups.map((group, gIndex) => (
              <div
                key={group.id}
                draggable
                onDragStart={(e) => onGroupDragStart(e, gIndex, group.id)}
                onDragOver={onGroupDragOver}
                onDrop={(e) => onGroupDrop(e, gIndex)}
                className="p-3 rounded border border-border bg-background/10 transition-shadow hover:shadow"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="font-semibold">{group.name}</div>
                    <Badge variant="outline" className="text-xs">{group.symbols.length}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="icon" variant="ghost" onClick={() => renameGroup(group.id)}><Move className="w-4 h-4" /></Button>
                    <Button size="icon" variant="destructive" onClick={() => { if (confirm(`Delete "${group.name}"?`)) deleteGroup(group.id); }}><Trash2 className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => setGroups((prev) => prev.map((gg) => gg.id === group.id ? { ...gg, collapsed: !gg.collapsed } : gg))}>
                      {group.collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>

                <div className="flex gap-2 mb-3">
                  <Input placeholder="SYMBOL" value={symbolInput} onChange={(e) => setSymbolInput(e.target.value)} onKeyDown={(e) => {
                    if (e.key === "Enter") { addSymbolToGroup(symbolInput, group.id); setSymbolInput(""); }
                  }} />
                  <Button onClick={() => { addSymbolToGroup(symbolInput, group.id); setSymbolInput(""); }}>Add</Button>
                </div>

                {!group.collapsed && (
                  <div onDragOver={(e) => e.preventDefault()} onDrop={(e) => onSymbolDropOnGroup(e, group.id)} className="space-y-2">
                    {group.symbols.length === 0 ? (
                      <div className="text-sm text-muted-foreground">No symbols</div>
                    ) : group.symbols.map((symbol, sIndex) => {
                      const tick = liveTicks[symbol] || {};
                      const trendUp = (tick.change ?? 0) >= 0;
                      const heat = percentToColor(typeof tick.percentChange === "number" ? tick.percentChange : 0);

                      return (
                        <div key={symbol} draggable onDragStart={(e) => onSymbolDragStart(e, symbol, group.id)} className="flex items-center justify-between p-2 rounded hover:bg-muted/20 transition">
                          <div className="flex items-center gap-3">
                            <div className="font-mono font-semibold">{symbol}</div>
                            <div className="text-xs text-muted-foreground hidden sm:block">NSE</div>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="font-mono font-semibold">₹{fmtPrice(tick.ltp)}</div>
                              <div className={`flex items-center gap-1 text-xs ${trendUp ? "text-success" : "text-destructive"}`}>
                                {trendUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                <span>{(tick.change ?? 0).toFixed(2)}</span>
                                <span className="text-[11px]">({(tick.percentChange ?? 0).toFixed(2)}%)</span>
                              </div>
                            </div>

                            <div className="w-10 h-8 rounded flex items-center justify-center text-[11px]" style={{ background: heat.inline }}>
                              <span className={heat.textColor}>{(tick.percentChange ?? 0).toFixed(2)}%</span>
                            </div>

                            <div className="flex gap-1">
                              <Button size="icon" variant="ghost" onClick={() => removeSymbol(symbol, group.id)} title="Remove"><Trash2 className="w-4 h-4" /></Button>
                              <Button size="icon" variant="ghost" onClick={() => navigate(`/stock/${symbol}`)} title="Open"><ChevronDown className="w-4 h-4" /></Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default Watchlist;
