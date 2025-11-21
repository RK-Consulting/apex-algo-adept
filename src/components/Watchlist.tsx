// src/components/Watchlist.tsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

type SymbolTick = {
  stockCode: string;
  ltp?: number;
  change?: number;
  percentChange?: number;
  volume?: number;
  timestamp?: string | number;
};

type Group = {
  id: string;
  name: string;
  symbols: string[]; // order matters
  collapsed?: boolean;
};

const backendUrl =
  import.meta.env.VITE_BACKEND_URL || "https://api.alphaforge.skillsifter.in";

function getAuthToken() {
  return localStorage.getItem("authToken") || localStorage.getItem("token");
}

// small helper to compute heatmap color for percent change
function percentToColor(p: number | undefined) {
  // p in -100..+100 (realistic smaller). We'll map:
  // negative -> red shades, positive -> green shades, near zero -> neutral
  if (p === undefined || Number.isNaN(p)) return "bg-muted/20 text-muted-foreground";
  const clamp = Math.max(-10, Math.min(10, p)); // focus range to -10..10
  const ratio = (clamp + 10) / 20; // 0..1
  // ratio 0 => most negative (red), 0.5 => neutral, 1 => most positive (green)
  const red = Math.round(220 * (1 - ratio));
  const green = Math.round(220 * ratio);
  // pick text color depending on brightness
  const brightness = (red * 299 + green * 587 + 200 * 114) / 1000; // rough
  const textColor = brightness > 140 ? "text-black" : "text-white";
  const inline = `background-color: rgba(${red}, ${green}, 60, 0.12);`;
  // We'll return both tailwind-safe fallback classes and inline styles where necessary.
  return { inline, textColor };
}

// generate uid
const uid = (prefix = "") =>
  prefix + Math.random().toString(36).slice(2, 9);

export function Watchlist() {
  const navigate = useNavigate();
  const token = getAuthToken();
  const wsRef = useRef<WebSocket | null>(null);

  // groups: array of watchlist groups; each contains ordered symbols
  const [groups, setGroups] = useState<Group[]>([
    // default group — kept empty; real data loaded from backend if available
    { id: "g-default", name: "Default", symbols: ["RELIANCE", "TCS", "INFY"], collapsed: false },
  ]);
  const [liveTicks, setLiveTicks] = useState<Record<string, SymbolTick>>({});
  const [symbolInput, setSymbolInput] = useState("");
  const [dragging, setDragging] = useState<{ symbol?: string; fromGroupId?: string } | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [pollIntervalMs] = useState(15000); // REST polling fallback

  // ---------------------------
  // Backend persistence helpers
  // ---------------------------
  async function loadGroupsFromServer() {
    if (!token) {
      setLoadingGroups(false);
      return;
    }
    try {
      const res = await fetch(`${backendUrl}/api/watchlist`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load watchlist");
      const json = await res.json();
      if (Array.isArray(json.groups)) {
        setGroups(json.groups);
      } else if (Array.isArray(json.symbols)) {
        // legacy: single array
        setGroups([{ id: uid("g-"), name: "Default", symbols: json.symbols }]);
      }
    } catch (err) {
      console.error("Watchlist load error:", err);
    } finally {
      setLoadingGroups(false);
    }
  }

  async function persistGroupsToServer(groupsToSave: Group[]) {
    if (!token) return;
    try {
      await fetch(`${backendUrl}/api/watchlist/update-groups`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ groups: groupsToSave }),
      });
    } catch (err) {
      console.error("Failed to persist groups:", err);
    }
  }

  // add symbol to specific group (persisted)
  async function addSymbolToGroup(symbol: string, groupId: string) {
    symbol = symbol.toUpperCase().trim();
    if (!symbol) return;

    setGroups((prev) => {
      const out = prev.map((g) =>
        g.id === groupId ? { ...g, symbols: [...g.symbols, symbol] } : g
      );
      persistGroupsToServer(out);
      return out;
    });

    // notify backend stream to subscribe
    try {
      await fetch(`${backendUrl}/api/icici/stream/subscribe`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ symbol }),
      });
    } catch (e) {
      console.warn("subscribe failed", e);
    }
  }

  // remove symbol (persisted)
  async function removeSymbol(symbol: string, groupId: string) {
    setGroups((prev) => {
      const out = prev.map((g) =>
        g.id === groupId ? { ...g, symbols: g.symbols.filter((s) => s !== symbol) } : g
      );
      persistGroupsToServer(out);
      return out;
    });

    // notify backend stream to unsubscribe
    try {
      await fetch(`${backendUrl}/api/icici/stream/unsubscribe`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ symbol }),
      });
    } catch (e) {
      console.warn("unsubscribe failed", e);
    }

    // remove tick
    setLiveTicks((prev) => {
      const p = { ...prev };
      delete p[symbol];
      return p;
    });
  }

  // create new group
  function createGroup(name = "New Group") {
    const g: Group = { id: uid("g-"), name, symbols: [], collapsed: false };
    const next = [...groups, g];
    setGroups(next);
    persistGroupsToServer(next);
  }

  // rename group
  function renameGroup(id: string, name: string) {
    const next = groups.map((g) => (g.id === id ? { ...g, name } : g));
    setGroups(next);
    persistGroupsToServer(next);
  }

  // delete group (move symbols optionally to default)
  function deleteGroup(id: string) {
    // prefer to delete only empty groups; if not empty, move to first group or confirm behavior
    const toDelete = groups.find((g) => g.id === id);
    if (!toDelete) return;
    let next: Group[] = groups.filter((g) => g.id !== id);
    if (toDelete.symbols.length > 0) {
      // move to first existing group or create default
      if (next.length === 0) {
        next = [{ id: uid("g-"), name: "Default", symbols: [...toDelete.symbols] }];
      } else {
        next[0] = { ...next[0], symbols: [...next[0].symbols, ...toDelete.symbols] };
      }
    }
    setGroups(next);
    persistGroupsToServer(next);
  }

  // reorder symbol inside same group
  function reorderSymbol(groupId: string, fromIndex: number, toIndex: number) {
    setGroups((prev) => {
      const next = prev.map((g) => {
        if (g.id !== groupId) return g;
        const arr = [...g.symbols];
        const [item] = arr.splice(fromIndex, 1);
        arr.splice(toIndex, 0, item);
        return { ...g, symbols: arr };
      });
      persistGroupsToServer(next);
      return next;
    });
  }

  // move symbol between groups
  function moveSymbolBetweenGroups(fromGroupId: string, toGroupId: string, symbol: string, toIndex = -1) {
    setGroups((prev) => {
      const next = prev.map((g) => {
        if (g.id === fromGroupId) return { ...g, symbols: g.symbols.filter((s) => s !== symbol) };
        return g;
      }).map((g) => {
        if (g.id === toGroupId) {
          const arr = [...g.symbols];
          if (toIndex < 0) arr.push(symbol);
          else arr.splice(toIndex, 0, symbol);
          return { ...g, symbols: arr };
        }
        return g;
      });
      persistGroupsToServer(next);
      return next;
    });
  }

  // ---------------------------
  // Drag & Drop handlers
  // ---------------------------
  function onDragStart(e: React.DragEvent, symbol: string, fromGroupId: string) {
    setDragging({ symbol, fromGroupId });
    e.dataTransfer.setData("text/plain", JSON.stringify({ symbol, fromGroupId }));
    e.dataTransfer.effectAllowed = "move";
  }

  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  function onDropOnGroup(e: React.DragEvent, targetGroupId: string) {
    e.preventDefault();
    const payload = e.dataTransfer.getData("text/plain");
    try {
      const { symbol, fromGroupId } = JSON.parse(payload);
      if (!symbol) return;
      if (fromGroupId === targetGroupId) {
        // reorder to end
        moveSymbolBetweenGroups(fromGroupId, targetGroupId, symbol);
      } else {
        moveSymbolBetweenGroups(fromGroupId, targetGroupId, symbol);
      }
    } catch (err) {
      console.warn("drop parse", err);
    } finally {
      setDragging(null);
    }
  }

  // drop on specific symbol to reorder position
  function onDropOnSymbol(e: React.DragEvent, targetGroupId: string, targetIndex: number) {
    e.preventDefault();
    const payload = e.dataTransfer.getData("text/plain");
    try {
      const { symbol, fromGroupId } = JSON.parse(payload);
      if (!symbol) return;
      if (fromGroupId === targetGroupId) {
        // find from index
        const g = groups.find((gg) => gg.id === fromGroupId);
        if (!g) return;
        const fromIndex = g.symbols.indexOf(symbol);
        if (fromIndex < 0) return;
        let toIndex = targetIndex;
        // if moving from above to below adjust index
        if (fromIndex < toIndex) toIndex = toIndex - 1;
        reorderSymbol(targetGroupId, fromIndex, toIndex);
      } else {
        moveSymbolBetweenGroups(fromGroupId, targetGroupId, symbol, targetIndex);
      }
    } catch (err) {
      console.warn("drop parse", err);
    } finally {
      setDragging(null);
    }
  }

  // ---------------------------
  // WS + REST fallback
  // ---------------------------
  useEffect(() => {
    if (!token) return;

    // open WS connection to watchlist streaming endpoint
    const wsUrl = `${backendUrl.replace("https://", "wss://")}/api/icici/stream/live`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("Watchlist WS connected");
      // subscribe for all symbols already loaded
      groups.forEach((g) => {
        g.symbols.forEach((s) => {
          fetch(`${backendUrl}/api/icici/stream/subscribe`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ symbol: s }),
          }).catch((e) => console.warn("sub err", e));
        });
      });
    };

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data) as SymbolTick;
        if (!msg?.stockCode) return;
        setLiveTicks((prev) => ({ ...prev, [msg.stockCode]: msg }));
      } catch (err) {
        // ignore malformed messages
      }
    };

    ws.onerror = (e) => {
      console.warn("WS error", e);
    };

    ws.onclose = () => {
      console.log("WS closed; falling back to polling");
      // fallback: start polling if connection dies
    };

    // periodic REST polling fallback
    let pollHandle: any = null;
    const doPoll = async () => {
      const allSymbols = groups.flatMap((g) => g.symbols);
      if (allSymbols.length === 0) return;
      try {
        // request in batches
        const payload = { symbols: allSymbols };
        const res = await fetch(`${backendUrl}/api/icici/market/quotes-bulk`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        if (!res.ok) return;
        const json = await res.json();
        // expected: { ticks: { RELIANCE: {...}, TCS: {...} } } or array
        const ticksFromServer: Record<string, any> = json.ticks || json || {};
        setLiveTicks((prev) => ({ ...prev, ...ticksFromServer }));
      } catch (err) {
        // ignore
      }
    };

    pollHandle = setInterval(doPoll, pollIntervalMs);
    // initial poll to populate UI fast
    doPoll();

    return () => {
      clearInterval(pollHandle);
      try {
        ws.close();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, groups.length]);

  // ---------------------------
  // Load groups on mount & AI suggestions
  // ---------------------------
  useEffect(() => {
    loadGroupsFromServer();

    const fetchAISuggestions = async () => {
      if (!token) {
        // local fallback AI suggestions heuristics (volatility pick)
        setAiSuggestions([
          { name: "Volatility Arb", description: "Suggest pairs with high implied vol", score: 0.8 },
          { name: "Momentum Mini", description: "High momentum stocks in last 5 days", score: 0.67 },
        ]);
        return;
      }
      try {
        const res = await fetch(`${backendUrl}/api/ai/watchlist-suggestions`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("No AI endpoint");
        const json = await res.json();
        setAiSuggestions(json.suggestions || []);
      } catch (err) {
        console.warn("AI suggestions fallback", err);
        setAiSuggestions([
          { name: "Volatility Arb", description: "Suggest pairs with high implied vol", score: 0.8 },
          { name: "Momentum Mini", description: "High momentum stocks in last 5 days", score: 0.67 },
        ]);
      }
    };

    fetchAISuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------
  // UI Render helpers
  // ---------------------------
  function symbolCard(symbol: string, groupId: string, index: number) {
    const tick = liveTicks[symbol] || {};
    const trend = (tick.change ?? 0) >= 0 ? "up" : "down";
    const pct = typeof tick.percentChange === "number" ? tick.percentChange : 0;
    const heat = percentToColor(pct);

    const inlineStyle = heat && (heat as any).inline ? { backgroundColor: undefined } : undefined;

    return (
      <div
        key={symbol}
        draggable
        onDragStart={(e) => onDragStart(e, symbol, groupId)}
        onDragOver={onDragOver}
        onDrop={(e) => onDropOnSymbol(e, groupId, index)}
        className="flex items-center justify-between p-2 rounded-md mb-2 hover:bg-muted/30 transition cursor-move"
      >
        <div className="flex items-center gap-3">
          <div className="font-mono font-semibold">{symbol}</div>
          <div className="text-xs text-muted-foreground hidden sm:block">{/* exchange placeholder */}NSE</div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="font-mono font-semibold">₹{(tick.ltp ?? "—")}</div>
            <div className={`flex items-center gap-1 text-xs ${trend === "up" ? "text-success" : "text-destructive"}`}>
              {trend === "up" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              <span>{(tick.change ?? 0).toFixed?.(2) ?? tick.change ?? "—"}</span>
              <span className="text-[11px]">({(tick.percentChange ?? 0).toFixed(2)}%)</span>
            </div>
          </div>

          {/* Heatmap tile */}
          <div
            title={`${(tick.percentChange ?? 0).toFixed(2)}%`}
            className="w-10 h-8 rounded flex items-center justify-center text-[11px] px-2"
            style={{ ...(heat as any)?.inline ? { background: (heat as any).inline } : undefined }}
          >
            <span className={(heat as any)?.textColor || ""}>{(tick.percentChange ?? 0).toFixed(2)}%</span>
          </div>

          <div className="flex gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                removeSymbol(symbol, groupId);
              }}
              title="Remove"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/stock/${symbol}`);
              }}
              title="Open"
            >
              <ChevronDown className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------
  // Render main component
  // ---------------------------
  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex items-center justify-between pb-3">
        <div className="flex items-center gap-4">
          <CardTitle className="text-lg">Advanced Watchlist</CardTitle>
          <Badge variant="outline">{groups.reduce((a, b) => a + b.symbols.length, 0)} symbols</Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => createGroup(`Group ${groups.length + 1}`)}
            className="gap-2"
          >
            <Plus className="w-4 h-4" /> New Group
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              // quick AI suggestion: add top suggestion to first group
              if (aiSuggestions.length > 0) {
                const pick = aiSuggestions[0];
                const symbol = (pick.symbol || pick.name || "RELIANCE").toUpperCase();
                addSymbolToGroup(symbol, groups[0]?.id || "g-default");
              }
            }}
            title="Add top AI suggestion"
          >
            <Sparkles className="w-4 h-4" /> Suggest
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {/* AI suggestions */}
        {aiSuggestions.length > 0 && (
          <div className="mb-4 p-3 rounded border border-accent/10 bg-accent/5">
            <div className="flex items-center justify-between">
              <div className="font-semibold">AI Suggestions</div>
              <div className="text-xs text-muted-foreground">based on recent market signals</div>
            </div>
            <div className="flex gap-3 mt-2 overflow-x-auto">
              {aiSuggestions.map((s: any, i: number) => (
                <div key={i} className="p-2 rounded bg-card border">
                  <div className="font-semibold text-sm">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{s.description}</div>
                  <div className="mt-2 flex gap-2">
                    <Button
                      size="xs"
                      onClick={() => {
                        const symbol = (s.symbol || s.ticker || s.name || "RELIANCE").toUpperCase();
                        addSymbolToGroup(symbol, groups[0]?.id || "g-default");
                      }}
                      className="gap-2"
                    >
                      Add
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      onClick={async () => {
                        // drill: show details (quick fetch)
                        try {
                          const res = await fetch(`${backendUrl}/api/icici/market/quote?symbol=${s.symbol || s.ticker || s.name}`, {
                            headers: { Authorization: `Bearer ${token}` },
                          });
                          const json = await res.json();
                          alert(JSON.stringify(json.quote?.Success?.[0] || json, null, 2));
                        } catch (e) {
                          alert("Failed to fetch details");
                        }
                      }}
                    >
                      Details
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Groups */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => (
            <div
              key={group.id}
              onDragOver={onDragOver}
              onDrop={(e) => onDropOnGroup(e, group.id)}
              className="p-3 rounded border border-border bg-background/10"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="font-semibold">{group.name}</div>
                  <Badge variant="outline" className="text-xs">
                    {group.symbols.length}
                  </Badge>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setGroups((prev) => prev.map((g) => g.id === group.id ? { ...g, collapsed: !g.collapsed } : g));
                    }}
                  >
                    {group.collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                  </Button>

                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => renameGroup(group.id, prompt("Rename group", group.name) || group.name)}
                    title="Rename"
                  >
                    <Move className="w-4 h-4" />
                  </Button>

                  <Button
                    size="icon"
                    variant="destructive"
                    onClick={() => {
                      if (confirm(`Delete group "${group.name}"?`)) deleteGroup(group.id);
                    }}
                    title="Delete group"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Add symbol input within group */}
              <div className="flex gap-2 mb-3">
                <Input
                  placeholder="Add symbol (RELIANCE)"
                  value={symbolInput}
                  onChange={(e) => setSymbolInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      addSymbolToGroup(symbolInput, group.id);
                      setSymbolInput("");
                    }
                  }}
                />
                <Button
                  onClick={() => {
                    addSymbolToGroup(symbolInput, group.id);
                    setSymbolInput("");
                  }}
                >
                  Add
                </Button>
              </div>

              {!group.collapsed && (
                <div>
                  {group.symbols.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No symbols in this group</div>
                  ) : (
                    group.symbols.map((symbol, idx) => (
                      <div key={symbol}>
                        {symbolCard(symbol, group.id, idx)}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default Watchlist;
