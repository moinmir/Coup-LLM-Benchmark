"use client";

import type { GameState } from "~/lib/game/types";

interface TruthPanelProps {
  gameState: GameState;
}

const CHARACTER_COLORS: Record<string, string> = {
  Duke: "text-violet-400",
  Assassin: "text-red-400",
  Captain: "text-blue-400",
  Ambassador: "text-emerald-400",
  Contessa: "text-amber-400",
};

export function TruthPanel({ gameState }: TruthPanelProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-primary/30 bg-card/80">
      <div className="border-b border-primary/20 bg-primary/5 px-4 py-3">
        <h4 className="flex items-center gap-2 font-display text-lg tracking-wider text-primary">
          <span>👁️</span>
          The Truth Behind the Masks
        </h4>
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          Hidden information revealed for observation
        </p>
      </div>
      
      <div className="p-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {gameState.players.map((player, i) => (
            <div
              key={i}
              className={`rounded-lg border p-3 text-center transition-colors ${
                player.cards.length > 0
                  ? "border-border/50 bg-muted/30"
                  : "border-destructive/20 bg-destructive/5"
              }`}
            >
              <p className={`font-display tracking-wider ${
                player.cards.length > 0 ? "text-foreground" : "text-muted-foreground"
              }`}>
                {player.name}
              </p>
              <p className="mt-2 text-sm">
                {player.cards.length > 0 ? (
                  player.cards.map((card, j) => (
                    <span key={j}>
                      {j > 0 && <span className="text-muted-foreground">, </span>}
                      <span className={CHARACTER_COLORS[card] ?? "text-foreground"}>
                        {card}
                      </span>
                    </span>
                  ))
                ) : (
                  <span className="font-mono text-xs text-destructive">
                    💀 ELIMINATED
                  </span>
                )}
              </p>
            </div>
          ))}
        </div>
        
        <div className="mt-4 flex items-center justify-between rounded-lg bg-muted/30 p-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">🃏</span>
            <span className="font-mono text-sm text-muted-foreground">
              Deck: <span className="text-primary">{gameState.deckSize}</span> cards
            </span>
          </div>
          <div className="font-mono text-xs text-muted-foreground">
            Turn {gameState.turnNumber}
          </div>
        </div>
      </div>
    </div>
  );
}
