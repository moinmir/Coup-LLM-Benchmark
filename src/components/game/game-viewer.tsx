"use client";

import { cn } from "~/lib/utils";
import type { GameState, PublicGameState } from "~/lib/game/types";
import { GameLog } from "./game-log";

interface GameViewerProps {
  gameState: GameState | PublicGameState;
  events: string[];
  currentTurnInfo?: {
    action: string;
    target: number | null;
    challenged: boolean;
    blocked: boolean;
    success: boolean;
  };
  showTruth?: boolean;
  className?: string;
}

// Character colors for consistent styling
const CHARACTER_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  Duke: { text: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/30" },
  Assassin: { text: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30" },
  Captain: { text: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30" },
  Ambassador: { text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  Contessa: { text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30" },
};

// Get short model name
function getModelShort(model: string): string {
  const name = model.split("/").pop() ?? model;
  // Truncate long names
  return name.length > 16 ? name.slice(0, 14) + "…" : name;
}

export function GameViewer({
  gameState,
  events,
  currentTurnInfo,
  showTruth = false,
  className,
}: GameViewerProps) {
  // Type guard to check if we have full game state
  const isFullState = (state: GameState | PublicGameState): state is GameState => {
    return state.players.length > 0 && "cards" in state.players[0]!;
  };

  const hasFullState = isFullState(gameState);

  // Format cards with colors
  const formatCard = (card: string, index: number) => {
    const colors = CHARACTER_COLORS[card] ?? { text: "text-foreground", bg: "", border: "" };
    return (
      <span
        key={index}
        className={cn(
          "inline-block rounded px-1.5 py-0.5 font-mono text-xs",
          colors.text,
          colors.bg
        )}
      >
        {card.slice(0, 3).toUpperCase()}
      </span>
    );
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Turn indicator & current action */}
      <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 font-display text-lg text-primary">
            {gameState.turnNumber}
          </div>
          <div>
            <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Turn
            </p>
            <p className="font-display tracking-wider text-foreground">
              P{gameState.currentPlayerIndex + 1}&apos;s Move
            </p>
          </div>
        </div>

        {currentTurnInfo && (
          <div className="flex items-center gap-2">
            <span className="rounded bg-muted px-2 py-1 font-mono text-sm">
              {currentTurnInfo.action.toUpperCase().replace("_", " ")}
            </span>
            {currentTurnInfo.target !== null && (
              <span className="text-muted-foreground">→ P{currentTurnInfo.target + 1}</span>
            )}
            {currentTurnInfo.challenged && (
              <span className="rounded bg-amber-500/20 px-2 py-1 font-mono text-xs text-amber-400">
                ⚔ CHALLENGED
              </span>
            )}
            {currentTurnInfo.blocked && (
              <span className="rounded bg-blue-500/20 px-2 py-1 font-mono text-xs text-blue-400">
                🛡 BLOCKED
              </span>
            )}
            <span
              className={cn(
                "rounded px-2 py-1 font-mono text-xs",
                currentTurnInfo.success
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-red-500/20 text-red-400"
              )}
            >
              {currentTurnInfo.success ? "✓" : "✗"}
            </span>
          </div>
        )}
      </div>

      {/* Players Grid - Main Game State View */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {gameState.players.map((player, i) => {
          const isCurrentPlayer = i === gameState.currentPlayerIndex;
          
          // Get cards based on state type
          const cards = hasFullState && showTruth
            ? (gameState.players[i] as { cards: string[] }).cards
            : "cards" in player
              ? player.cards
              : null;
          const influenceCount = "influenceCount" in player ? player.influenceCount : cards?.length ?? 0;
          // Determine if alive - either from isAlive property or from cards.length
          const isAlive = "isAlive" in player ? player.isAlive : (cards?.length ?? 0) > 0;

          return (
            <div
              key={i}
              className={cn(
                "relative rounded-lg border-2 p-3 transition-all",
                isCurrentPlayer && isAlive
                  ? "border-primary bg-card shadow-lg shadow-primary/10"
                  : isAlive
                    ? "border-border/40 bg-card/60"
                    : "border-border/20 bg-muted/20 opacity-50"
              )}
            >
              {/* Current player indicator */}
              {isCurrentPlayer && isAlive && (
                <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground shadow">
                  ▶
                </div>
              )}

              {/* Player ID + Model */}
              <div className="mb-2 flex items-center justify-between">
                <span
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full font-display text-sm",
                    isCurrentPlayer
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  P{i + 1}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {getModelShort(player.model)}
                </span>
              </div>

              {/* Coins */}
              <div className="mb-2 flex items-center justify-center gap-1">
                <span className="text-sm">💰</span>
                <span className="font-mono text-lg font-bold text-primary">{player.coins}</span>
              </div>

              {/* Cards / Influence */}
              {isAlive ? (
                <div className="space-y-1.5">
                  {cards && showTruth ? (
                    <div className="flex flex-wrap justify-center gap-1">
                      {cards.map((card, j) => formatCard(card, j))}
                    </div>
                  ) : (
                    <div className="flex justify-center gap-0.5">
                      {Array.from({ length: influenceCount }).map((_, j) => (
                        <span key={j} className="text-base opacity-60">🎴</span>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center font-mono text-xs text-destructive">
                  💀 OUT
                </div>
              )}

              {/* Revealed cards */}
              {player.revealedCards.length > 0 && (
                <div className="mt-2 flex flex-wrap justify-center gap-0.5 border-t border-destructive/20 pt-2">
                  {player.revealedCards.map((card, j) => (
                    <span
                      key={j}
                      className="font-mono text-[10px] text-destructive/60 line-through"
                    >
                      {card.slice(0, 3)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Deck info */}
      <div className="flex items-center justify-center gap-4 rounded-lg bg-muted/30 px-4 py-2">
        <div className="flex items-center gap-2 text-sm">
          <span>🃏</span>
          <span className="font-mono text-muted-foreground">
            Deck: <span className="text-foreground">{gameState.deckSize}</span>
          </span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2 text-sm">
          <span className="font-mono text-muted-foreground">
            Alive: <span className="text-emerald-400">{gameState.players.filter(p => "isAlive" in p ? p.isAlive : (p.cards?.length ?? 0) > 0).length}</span>
            /{gameState.players.length}
          </span>
        </div>
      </div>

      {/* Game Log */}
      <div className="rounded-lg border border-border/50 bg-card/50">
        <div className="border-b border-border/30 bg-muted/30 px-4 py-2">
          <h4 className="font-display text-sm tracking-wider text-foreground">Event Log</h4>
        </div>
        <div className="p-3">
          <GameLog events={events} maxHeight="250px" />
        </div>
      </div>

      {/* Winner announcement */}
      {gameState.gameOver && gameState.winner !== null && (
        <div className="rounded-xl border-2 border-primary/50 bg-gradient-to-br from-primary/10 to-accent/10 p-6 text-center">
          <div className="mb-2 text-4xl">👑</div>
          <p className="font-display text-2xl tracking-wider text-primary">GAME OVER</p>
          <p className="mt-2 font-mono text-lg text-foreground">
            P{gameState.winner + 1} ({getModelShort(gameState.players[gameState.winner]?.model ?? "")}) Wins!
          </p>
        </div>
      )}
    </div>
  );
}

