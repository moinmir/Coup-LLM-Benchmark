"use client";

import { useRef, useEffect } from "react";
import { cn } from "~/lib/utils";

interface GameLogProps {
  events: string[];
  maxHeight?: string;
  autoScroll?: boolean;
}

// Format event text to highlight P# notation
function formatEvent(event: string): React.ReactNode {
  // Pattern to match P followed by a number
  const parts = event.split(/(P\d+)/g);
  
  return parts.map((part, i) => {
    if (/^P\d+$/.test(part)) {
      return (
        <span
          key={i}
          className="mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded bg-primary/20 px-1 font-mono text-xs font-bold text-primary"
        >
          {part}
        </span>
      );
    }
    return part;
  });
}

export function GameLog({ events, maxHeight = "300px", autoScroll = true }: GameLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events, autoScroll]);

  const getEventStyle = (event: string) => {
    const lower = event.toLowerCase();
    if (lower.includes("wins") || lower.includes("game over")) return "border-l-primary bg-primary/5";
    if (lower.includes("challenge") && (lower.includes("success") || lower.includes("correct"))) return "border-l-emerald-500 bg-emerald-500/5";
    if (lower.includes("challenge") && lower.includes("fail")) return "border-l-red-500 bg-red-500/5";
    if (lower.includes("challenge") || lower.includes("⚔")) return "border-l-amber-500 bg-amber-500/5";
    if (lower.includes("block") || lower.includes("🛡")) return "border-l-blue-500 bg-blue-500/5";
    if (lower.includes("loses") || lower.includes("eliminated") || lower.includes("💀")) return "border-l-destructive bg-destructive/5";
    if (lower.includes("coup") || lower.includes("assassinate")) return "border-l-red-400 bg-red-400/5";
    if (lower.includes("tax") || lower.includes("duke")) return "border-l-violet-400 bg-violet-400/5";
    if (lower.includes("steal") || lower.includes("captain")) return "border-l-blue-400 bg-blue-400/5";
    if (lower.includes("exchange") || lower.includes("ambassador") || lower.includes("🔄")) return "border-l-emerald-400 bg-emerald-400/5";
    if (lower.includes("turn")) return "border-l-muted-foreground/50 bg-muted/30";
    if (lower.includes("✓") || lower.includes("successful")) return "border-l-emerald-500/50";
    if (lower.includes("✗") || lower.includes("failed")) return "border-l-red-500/50";
    return "border-l-muted-foreground/30";
  };

  // Deduplicate events
  const uniqueEvents = [...new Set(events)];

  return (
    <div className="rounded-lg border border-border/30 bg-background/30">
      <div 
        ref={scrollRef}
        className="overflow-y-auto overflow-x-hidden p-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border"
        style={{ maxHeight }}
      >
        <div className="space-y-1 text-sm">
          {uniqueEvents.length === 0 ? (
            <p className="py-4 text-center font-mono text-xs text-muted-foreground">
              Awaiting first move...
            </p>
          ) : (
            uniqueEvents.map((event, i) => (
              <div
                key={i}
                className={cn(
                  "rounded-r border-l-2 py-1.5 pl-3 pr-2 text-foreground/90 transition-colors",
                  getEventStyle(event)
                )}
              >
                {formatEvent(event)}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
