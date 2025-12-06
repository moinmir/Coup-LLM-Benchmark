"use client";

import { useRef, useEffect } from "react";
import { cn } from "~/lib/utils";
import type { ActionType } from "~/lib/game/types";

interface TurnEntry {
  turn: number;
  player: number;
  model: string;
  action: ActionType;
  target: number | null;
  challenged: boolean;
  blocked: boolean;
  success: boolean;
  coinsAfter?: number;
  cardsLost?: string[];
}

interface TurnLogProps {
  entries: TurnEntry[];
  maxHeight?: string;
  currentTurn?: number;
  className?: string;
}

// Get short model name
function getModelShort(model: string): string {
  const name = model.split("/").pop() ?? model;
  return name.length > 15 ? name.slice(0, 13) + "…" : name;
}

// Action display config
const ACTION_LABELS: Record<ActionType, { label: string; emoji: string }> = {
  income: { label: "Income", emoji: "💵" },
  foreign_aid: { label: "Foreign Aid", emoji: "🤝" },
  coup: { label: "Coup", emoji: "⚔️" },
  tax: { label: "Tax", emoji: "👑" },
  assassinate: { label: "Assassinate", emoji: "🗡️" },
  steal: { label: "Steal", emoji: "💰" },
  exchange: { label: "Exchange", emoji: "🔄" },
};

export function TurnLog({ entries, maxHeight = "400px", currentTurn, className }: TurnLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentRowRef = useRef<HTMLTableRowElement>(null);

  // Auto-scroll to current turn
  useEffect(() => {
    if (currentRowRef.current) {
      currentRowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [currentTurn]);

  if (entries.length === 0) {
    return (
      <div className={cn("rounded-lg border border-border/30 bg-card/50 p-8 text-center", className)}>
        <p className="font-mono text-sm text-muted-foreground">No turns yet</p>
      </div>
    );
  }

  return (
    <div className={cn("rounded-lg border border-border/30 bg-card/50 overflow-hidden", className)}>
      <div 
        ref={scrollRef}
        className="overflow-auto"
        style={{ maxHeight }}
      >
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted/90 backdrop-blur-sm">
            <tr className="border-b border-border/50">
              <th className="px-3 py-2 text-left font-mono text-xs uppercase tracking-wider text-muted-foreground w-12">#</th>
              <th className="px-3 py-2 text-left font-mono text-xs uppercase tracking-wider text-muted-foreground w-16">Player</th>
              <th className="px-3 py-2 text-left font-mono text-xs uppercase tracking-wider text-muted-foreground">Model</th>
              <th className="px-3 py-2 text-left font-mono text-xs uppercase tracking-wider text-muted-foreground">Action</th>
              <th className="px-3 py-2 text-left font-mono text-xs uppercase tracking-wider text-muted-foreground w-16">Target</th>
              <th className="px-3 py-2 text-center font-mono text-xs uppercase tracking-wider text-muted-foreground w-20">Status</th>
              <th className="px-3 py-2 text-center font-mono text-xs uppercase tracking-wider text-muted-foreground w-24">Result</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, i) => {
              const isCurrent = currentTurn !== undefined && entry.turn === currentTurn;
              const actionConfig = ACTION_LABELS[entry.action];
              
              return (
                <tr 
                  key={i}
                  ref={isCurrent ? currentRowRef : undefined}
                  className={cn(
                    "border-b border-border/20 transition-colors",
                    isCurrent 
                      ? "bg-primary/10 border-l-2 border-l-primary" 
                      : "hover:bg-muted/30",
                    !entry.success && "bg-red-500/5"
                  )}
                >
                  {/* Turn number */}
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                    {entry.turn}
                  </td>
                  
                  {/* Player */}
                  <td className="px-3 py-2">
                    <span className={cn(
                      "inline-flex h-6 w-6 items-center justify-center rounded-full font-mono text-xs font-bold",
                      isCurrent ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    )}>
                      P{entry.player}
                    </span>
                  </td>
                  
                  {/* Model */}
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                    {getModelShort(entry.model)}
                  </td>
                  
                  {/* Action */}
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1.5">
                      <span>{actionConfig.emoji}</span>
                      <span className="font-medium text-foreground">{actionConfig.label}</span>
                    </span>
                  </td>
                  
                  {/* Target */}
                  <td className="px-3 py-2">
                    {entry.target !== null ? (
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted font-mono text-xs">
                        P{entry.target}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>
                  
                  {/* Status (challenged/blocked) */}
                  <td className="px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {entry.challenged && (
                        <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[10px] text-amber-400" title="Challenged">
                          ⚔️
                        </span>
                      )}
                      {entry.blocked && (
                        <span className="rounded bg-blue-500/20 px-1.5 py-0.5 font-mono text-[10px] text-blue-400" title="Blocked">
                          🛡️
                        </span>
                      )}
                      {!entry.challenged && !entry.blocked && (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </div>
                  </td>
                  
                  {/* Result */}
                  <td className="px-3 py-2 text-center">
                    <span className={cn(
                      "inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono text-xs",
                      entry.success 
                        ? "bg-emerald-500/20 text-emerald-400" 
                        : "bg-red-500/20 text-red-400"
                    )}>
                      {entry.success ? "✓ OK" : "✗ FAIL"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Compact single-line summary for current turn
export function TurnSummary({ 
  turn, 
  player, 
  model, 
  action, 
  target, 
  challenged, 
  blocked, 
  success,
  className 
}: TurnEntry & { className?: string }) {
  const actionConfig = ACTION_LABELS[action];
  
  return (
    <div className={cn(
      "flex flex-wrap items-center gap-2 rounded-lg border px-4 py-3 font-mono text-sm",
      success 
        ? "border-emerald-500/30 bg-emerald-500/5" 
        : "border-red-500/30 bg-red-500/5",
      className
    )}>
      <span className="text-muted-foreground">Turn {turn}</span>
      <span className="text-muted-foreground/50">|</span>
      
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
        P{player}
      </span>
      <span className="text-muted-foreground text-xs">({getModelShort(model)})</span>
      
      <span className="text-muted-foreground/50">→</span>
      
      <span className="flex items-center gap-1">
        <span>{actionConfig.emoji}</span>
        <span className="font-medium text-foreground">{actionConfig.label}</span>
      </span>
      
      {target !== null && (
        <>
          <span className="text-muted-foreground/50">→</span>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-destructive/20 text-xs text-destructive">
            P{target}
          </span>
        </>
      )}
      
      {challenged && (
        <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs text-amber-400">⚔️ Challenged</span>
      )}
      {blocked && (
        <span className="rounded bg-blue-500/20 px-2 py-0.5 text-xs text-blue-400">🛡️ Blocked</span>
      )}
      
      <span className="ml-auto">
        {success ? (
          <span className="text-emerald-400">✓ Success</span>
        ) : (
          <span className="text-red-400">✗ Failed</span>
        )}
      </span>
    </div>
  );
}

