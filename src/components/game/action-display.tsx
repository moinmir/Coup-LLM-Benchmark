"use client";

import { cn } from "~/lib/utils";
import type { ActionType } from "~/lib/game/types";

interface ActionDisplayProps {
  action: ActionType | null;
  actorIndex: number | null;
  targetIndex: number | null;
  challenged: boolean;
  blocked: boolean;
  success: boolean;
  actorName?: string;
  targetName?: string;
  className?: string;
}

// Action configurations with visuals
const ACTION_CONFIG: Record<ActionType, {
  icon: string;
  label: string;
  color: string;
  bgGradient: string;
  description: string;
}> = {
  income: {
    icon: "💵",
    label: "Income",
    color: "text-emerald-400",
    bgGradient: "from-emerald-900/40 to-emerald-950/40",
    description: "Takes 1 coin",
  },
  foreign_aid: {
    icon: "🤝",
    label: "Foreign Aid",
    color: "text-blue-400",
    bgGradient: "from-blue-900/40 to-blue-950/40",
    description: "Takes 2 coins",
  },
  coup: {
    icon: "⚔️",
    label: "COUP",
    color: "text-red-400",
    bgGradient: "from-red-900/40 to-red-950/40",
    description: "Pays 7 to eliminate",
  },
  tax: {
    icon: "👑",
    label: "Tax",
    color: "text-violet-400",
    bgGradient: "from-violet-900/40 to-violet-950/40",
    description: "Duke takes 3 coins",
  },
  assassinate: {
    icon: "🗡️",
    label: "Assassinate",
    color: "text-rose-400",
    bgGradient: "from-rose-900/40 to-rose-950/40",
    description: "Pays 3 to eliminate",
  },
  steal: {
    icon: "💰",
    label: "Steal",
    color: "text-cyan-400",
    bgGradient: "from-cyan-900/40 to-cyan-950/40",
    description: "Captain steals 2",
  },
  exchange: {
    icon: "🔄",
    label: "Exchange",
    color: "text-teal-400",
    bgGradient: "from-teal-900/40 to-teal-950/40",
    description: "Ambassador swaps cards",
  },
};

export function ActionDisplay({
  action,
  actorIndex,
  targetIndex,
  challenged,
  blocked,
  success,
  actorName,
  targetName,
  className,
}: ActionDisplayProps) {
  // Idle state
  if (!action || actorIndex === null) {
    return (
      <div className={cn("relative flex flex-col items-center justify-center", className)}>
        <div className="flex h-32 w-32 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/30 bg-muted/10">
          <span className="text-4xl opacity-30">⏳</span>
        </div>
        <p className="mt-4 font-mono text-sm text-muted-foreground">Waiting for action...</p>
      </div>
    );
  }

  const config = ACTION_CONFIG[action];
  const hasTarget = targetIndex !== null;

  return (
    <div className={cn("relative flex flex-col items-center", className)}>
      {/* Main action circle */}
      <div
        className={cn(
          "relative flex h-40 w-40 flex-col items-center justify-center rounded-full border-4 transition-all duration-500 action-pulse",
          `bg-gradient-to-br ${config.bgGradient}`,
          success ? "border-emerald-500/50 shadow-emerald-500/20" : "border-red-500/50 shadow-red-500/20",
          "shadow-2xl animate-in zoom-in-75 duration-500"
        )}
      >
        {/* Action icon */}
        <span className="text-5xl animate-in fade-in zoom-in-50 duration-300">{config.icon}</span>
        
        {/* Action label */}
        <span className={cn("mt-2 font-display text-lg tracking-wider", config.color)}>
          {config.label}
        </span>
      </div>

      {/* Actor indicator */}
      <div className="mt-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary font-display text-sm text-primary-foreground">
          P{(actorIndex ?? 0) + 1}
        </div>
        <span className="font-mono text-xs text-muted-foreground">{actorName}</span>
        
        {/* Arrow to target */}
        {hasTarget && (
          <>
            <span className="mx-2 text-muted-foreground">→</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/80 font-display text-sm text-white">
              P{(targetIndex ?? 0) + 1}
            </div>
            <span className="font-mono text-xs text-muted-foreground">{targetName}</span>
          </>
        )}
      </div>

      {/* Status badges */}
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {challenged && (
          <div className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-xs animate-in slide-in-from-bottom-2 duration-300",
            "bg-amber-500/20 text-amber-400 border border-amber-500/30"
          )}>
            <span className="text-sm">⚔️</span>
            <span>CHALLENGED</span>
          </div>
        )}
        
        {blocked && (
          <div className={cn(
            "flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-xs animate-in slide-in-from-bottom-2 duration-300",
            "bg-blue-500/20 text-blue-400 border border-blue-500/30"
          )}>
            <span className="text-sm">🛡️</span>
            <span>BLOCKED</span>
          </div>
        )}
        
        <div className={cn(
          "flex items-center gap-1.5 rounded-full px-3 py-1.5 font-mono text-xs animate-in slide-in-from-bottom-2 duration-500",
          success
            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
            : "bg-red-500/20 text-red-400 border border-red-500/30"
        )}>
          <span className="text-sm">{success ? "✓" : "✗"}</span>
          <span>{success ? "SUCCESS" : "FAILED"}</span>
        </div>
      </div>

      {/* Descriptive text */}
      <p className="mt-3 font-mono text-xs text-muted-foreground">
        {config.description}
      </p>
    </div>
  );
}

// Compact version for smaller displays
export function ActionBadge({ 
  action, 
  success,
  className 
}: { 
  action: ActionType; 
  success?: boolean;
  className?: string;
}) {
  const config = ACTION_CONFIG[action];
  
  return (
    <div className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-2 py-1",
      `bg-gradient-to-r ${config.bgGradient}`,
      success === true && "ring-1 ring-emerald-500/50",
      success === false && "ring-1 ring-red-500/50",
      className
    )}>
      <span className="text-sm">{config.icon}</span>
      <span className={cn("font-mono text-xs font-medium", config.color)}>
        {config.label}
      </span>
    </div>
  );
}

