"use client";

import { cn } from "~/lib/utils";
import type { Character } from "~/lib/game/types";

interface CharacterCardProps {
  character: Character;
  revealed?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

// Character definitions with colors and symbols
const CHARACTER_CONFIG: Record<Character, {
  color: string;
  bgGradient: string;
  glow: string;
  symbol: string;
  ability: string;
}> = {
  Duke: {
    color: "text-violet-300",
    bgGradient: "from-violet-900/90 via-violet-800/80 to-purple-900/90",
    glow: "shadow-violet-500/30",
    symbol: "👑",
    ability: "Tax +3",
  },
  Assassin: {
    color: "text-red-300",
    bgGradient: "from-red-950/90 via-red-900/80 to-rose-950/90",
    glow: "shadow-red-500/30",
    symbol: "🗡️",
    ability: "Kill -3",
  },
  Captain: {
    color: "text-blue-300",
    bgGradient: "from-blue-900/90 via-blue-800/80 to-cyan-900/90",
    glow: "shadow-blue-500/30",
    symbol: "⚓",
    ability: "Steal 2",
  },
  Ambassador: {
    color: "text-emerald-300",
    bgGradient: "from-emerald-900/90 via-emerald-800/80 to-teal-900/90",
    glow: "shadow-emerald-500/30",
    symbol: "🕊️",
    ability: "Exchange",
  },
  Contessa: {
    color: "text-amber-300",
    bgGradient: "from-amber-900/90 via-amber-800/80 to-orange-900/90",
    glow: "shadow-amber-500/30",
    symbol: "👸",
    ability: "Block Kill",
  },
};

// SVG patterns for card backs
function CardPattern({ character }: { character: Character }) {
  const colors: Record<Character, string> = {
    Duke: "#8b5cf6",
    Assassin: "#ef4444",
    Captain: "#3b82f6",
    Ambassador: "#10b981",
    Contessa: "#f59e0b",
  };

  return (
    <svg
      className="absolute inset-0 h-full w-full opacity-20"
      viewBox="0 0 100 140"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id={`pattern-${character}`} patternUnits="userSpaceOnUse" width="20" height="20">
          <circle cx="10" cy="10" r="2" fill={colors[character]} />
        </pattern>
      </defs>
      <rect width="100" height="140" fill={`url(#pattern-${character})`} />
    </svg>
  );
}

export function CharacterCard({ character, revealed = false, size = "md", className }: CharacterCardProps) {
  const config = CHARACTER_CONFIG[character];
  
  const sizeClasses = {
    sm: "w-12 h-[64px] text-xs",
    md: "w-16 h-[88px] text-sm",
    lg: "w-24 h-[128px] text-base",
  };

  if (revealed) {
    return (
      <div
        className={cn(
          "relative overflow-hidden rounded-lg border border-border/50 bg-muted/30 opacity-60",
          sizeClasses[size],
          className
        )}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-800/50 to-zinc-900/50" />
        <div className="relative flex h-full flex-col items-center justify-center p-1">
          <span className="text-lg opacity-40 grayscale">{config.symbol}</span>
          <span className="mt-0.5 font-mono text-[8px] uppercase tracking-wider text-muted-foreground line-through">
            {character.slice(0, 3)}
          </span>
        </div>
        {/* X overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl text-destructive/60">✕</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-lg border-2 transition-all duration-300",
        "hover:scale-105 hover:shadow-xl",
        `bg-gradient-to-br ${config.bgGradient}`,
        `border-${character.toLowerCase()}-500/50`,
        `shadow-lg ${config.glow}`,
        sizeClasses[size],
        className
      )}
    >
      <CardPattern character={character} />
      
      {/* Shine effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      
      {/* Card content */}
      <div className="relative flex h-full flex-col items-center justify-center p-1">
        {/* Symbol */}
        <span className={cn(
          "transition-transform group-hover:scale-110",
          size === "sm" ? "text-lg" : size === "md" ? "text-2xl" : "text-3xl"
        )}>
          {config.symbol}
        </span>
        
        {/* Name */}
        <span className={cn(
          "mt-1 font-display tracking-wider",
          config.color,
          size === "sm" ? "text-[8px]" : size === "md" ? "text-[10px]" : "text-xs"
        )}>
          {character.toUpperCase()}
        </span>
        
        {/* Ability (only on lg) */}
        {size === "lg" && (
          <span className="mt-0.5 font-mono text-[8px] text-white/50">
            {config.ability}
          </span>
        )}
      </div>

      {/* Corner decorations */}
      <div className={cn("absolute left-1 top-1 font-display", config.color, size === "sm" ? "text-[6px]" : "text-[8px]")}>
        {character.slice(0, 1)}
      </div>
      <div className={cn("absolute bottom-1 right-1 rotate-180 font-display", config.color, size === "sm" ? "text-[6px]" : "text-[8px]")}>
        {character.slice(0, 1)}
      </div>
    </div>
  );
}

// Hidden card back (for opponents' cards)
export function HiddenCard({ size = "md", className }: { size?: "sm" | "md" | "lg"; className?: string }) {
  const sizeClasses = {
    sm: "w-12 h-[64px]",
    md: "w-16 h-[88px]",
    lg: "w-24 h-[128px]",
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border-2 border-primary/30 bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900",
        "shadow-lg shadow-primary/10",
        sizeClasses[size],
        className
      )}
    >
      {/* Decorative pattern */}
      <svg
        className="absolute inset-0 h-full w-full opacity-30"
        viewBox="0 0 100 140"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="card-back-pattern" patternUnits="userSpaceOnUse" width="10" height="10">
            <path d="M0,5 L5,0 L10,5 L5,10 Z" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-primary" />
          </pattern>
        </defs>
        <rect width="100" height="140" fill="url(#card-back-pattern)" />
      </svg>
      
      {/* Center icon */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={cn(
          "text-primary/60",
          size === "sm" ? "text-xl" : size === "md" ? "text-2xl" : "text-4xl"
        )}>
          ♔
        </span>
      </div>
      
      {/* Subtle glow */}
      <div className="absolute inset-0 bg-gradient-to-t from-primary/5 via-transparent to-primary/5" />
    </div>
  );
}

