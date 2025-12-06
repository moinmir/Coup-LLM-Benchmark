"use client";

import { cn } from "~/lib/utils";
import type { PublicPlayerState, PrivatePlayerState } from "~/lib/game/types";

interface PlayerCardProps {
  player: PublicPlayerState | PrivatePlayerState;
  isCurrentPlayer: boolean;
  showTruth?: boolean;
  truthCards?: string[];
}

const CHARACTER_COLORS: Record<string, string> = {
  Duke: "text-violet-400",
  Assassin: "text-red-400",
  Captain: "text-blue-400",
  Ambassador: "text-emerald-400",
  Contessa: "text-amber-400",
};

export function PlayerCard({
  player,
  isCurrentPlayer,
  showTruth = false,
  truthCards,
}: PlayerCardProps) {
  const isAlive = player.isAlive;
  const hasCards = "cards" in player && player.cards;

  const formatCards = (cards: string[]) => {
    return cards.map((card, i) => (
      <span key={i}>
        {i > 0 && <span className="text-muted-foreground">, </span>}
        <span className={CHARACTER_COLORS[card] ?? "text-foreground"}>
          {card}
        </span>
      </span>
    ));
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border-2 p-4 transition-all duration-300",
        isCurrentPlayer && isAlive
          ? "border-primary bg-card shadow-lg shadow-primary/20"
          : isAlive
            ? "border-border/50 bg-card/80"
            : "border-border/30 bg-muted/30 opacity-60"
      )}
    >
      {/* Decorative corner for current player */}
      {isCurrentPlayer && isAlive && (
        <>
          <div className="absolute -right-8 -top-8 h-16 w-16 rotate-45 bg-primary/20" />
          <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground shadow-lg">
            ▶
          </div>
        </>
      )}

      {/* Card suit decoration */}
      <div className="pointer-events-none absolute bottom-1 right-2 text-3xl opacity-5">
        {isCurrentPlayer ? "♔" : "♠"}
      </div>

      {/* Player name and model */}
      <div className="mb-4 text-center">
        <h3
          className={cn(
            "font-display text-lg tracking-wider",
            isAlive ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {player.name}
        </h3>
        <p className="font-mono text-xs text-muted-foreground">
          {player.model.split("/").pop()?.slice(0, 18)}
        </p>
      </div>

      {/* Coins */}
      <div className="mb-4 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1">
          <span className="text-lg">💰</span>
          <span className="font-mono text-xl font-bold text-primary">
            {player.coins}
          </span>
        </div>
      </div>

      {/* Influence */}
      <div className="mb-2 text-center">
        {isAlive ? (
          <div className="rounded-lg bg-muted/30 p-2">
            <div className="mb-1 font-mono text-xs uppercase tracking-wider text-muted-foreground">
              {showTruth || hasCards ? "Cards" : "Influence"}
            </div>
            {showTruth && truthCards ? (
              <div className="text-sm font-medium">
                {formatCards(truthCards)}
              </div>
            ) : hasCards ? (
              <div className="text-sm font-medium">
                {formatCards(player.cards)}
              </div>
            ) : (
              <div className="flex items-center justify-center gap-1">
                {Array.from({ length: player.influenceCount }).map((_, i) => (
                  <span key={i} className="text-lg">🎴</span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-lg bg-destructive/10 p-2">
            <span className="font-display text-sm tracking-wider text-destructive">
              ELIMINATED
            </span>
          </div>
        )}
      </div>

      {/* Revealed cards */}
      {player.revealedCards.length > 0 && (
        <div className="mt-3 rounded-lg border border-destructive/20 bg-destructive/5 p-2 text-center">
          <span className="font-mono text-xs uppercase tracking-wider text-destructive/70">
            Lost: 
          </span>
          <span className="ml-1 text-sm">
            {formatCards(player.revealedCards)}
          </span>
        </div>
      )}
    </div>
  );
}
