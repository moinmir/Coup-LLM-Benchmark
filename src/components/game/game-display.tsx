"use client";

import { cn } from "~/lib/utils";
import type { GameState, Character, ActionType } from "~/lib/game/types";
import { CharacterCard, HiddenCard } from "./character-card";
import { TurnLog, TurnSummary } from "./turn-log";

interface TurnEntry {
  turn: number;
  player: number;
  model: string;
  action: ActionType;
  target: number | null;
  challenged: boolean;
  blocked: boolean;
  success: boolean;
}

interface GameDisplayProps {
  gameState: GameState;
  turnHistory: TurnEntry[];
  currentTurnInfo?: {
    action: string;
    target: number | null;
    challenged: boolean;
    blocked: boolean;
    success: boolean;
  };
  showGraphics?: boolean;
  showCards?: boolean;
  className?: string;
}

// Get short model name
function getModelShort(model: string): string {
  const name = model.split("/").pop() ?? model;
  return name.length > 12 ? name.slice(0, 10) + "…" : name;
}

// Player display component
function PlayerPanel({
  player,
  index,
  isCurrentPlayer,
  showGraphics,
  showCards,
}: {
  player: GameState["players"][0];
  index: number;
  isCurrentPlayer: boolean;
  showGraphics: boolean;
  showCards: boolean;
}) {
  const isAlive = player.cards.length > 0;

  return (
    <div
      className={cn(
        "relative rounded-lg border-2 p-3 transition-all",
        isCurrentPlayer && isAlive
          ? "border-primary bg-card shadow-md"
          : isAlive
            ? "border-border/40 bg-card/60"
            : "border-border/20 bg-muted/20 opacity-50"
      )}
    >
      {/* Current player indicator */}
      {isCurrentPlayer && isAlive && (
        <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
          ▶
        </div>
      )}

      {/* Header: Player ID + Model */}
      <div className="mb-2 flex items-center justify-between">
        <span
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full font-mono text-sm font-bold",
            isCurrentPlayer
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
          )}
        >
          P{index + 1}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {getModelShort(player.model)}
        </span>
      </div>

      {/* Coins */}
      <div className="mb-2 flex items-center justify-center gap-1 rounded bg-amber-500/10 px-2 py-1">
        <span className="text-sm">💰</span>
        <span className="font-mono text-lg font-bold text-amber-500">{player.coins}</span>
      </div>

      {/* Cards */}
      <div className="min-h-[70px]">
        {isAlive ? (
          showGraphics ? (
            <div className="flex justify-center gap-1">
              {showCards ? (
                player.cards.map((card, j) => (
                  <CharacterCard key={j} character={card} size="sm" />
                ))
              ) : (
                Array.from({ length: player.cards.length }).map((_, j) => (
                  <HiddenCard key={j} size="sm" />
                ))
              )}
            </div>
          ) : (
            <div className="text-center">
              {showCards ? (
                <div className="flex flex-wrap justify-center gap-1">
                  {player.cards.map((card, j) => (
                    <span
                      key={j}
                      className={cn(
                        "rounded px-1.5 py-0.5 font-mono text-xs font-medium",
                        card === "Duke" && "bg-violet-500/20 text-violet-400",
                        card === "Assassin" && "bg-red-500/20 text-red-400",
                        card === "Captain" && "bg-blue-500/20 text-blue-400",
                        card === "Ambassador" && "bg-emerald-500/20 text-emerald-400",
                        card === "Contessa" && "bg-amber-500/20 text-amber-400"
                      )}
                    >
                      {card}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="flex justify-center gap-1">
                  {Array.from({ length: player.cards.length }).map((_, j) => (
                    <span key={j} className="font-mono text-lg text-muted-foreground">🎴</span>
                  ))}
                </div>
              )}
            </div>
          )
        ) : (
          <div className="flex items-center justify-center">
            <span className="rounded bg-destructive/20 px-2 py-1 font-mono text-xs text-destructive">
              💀 ELIMINATED
            </span>
          </div>
        )}
      </div>

      {/* Revealed cards */}
      {player.revealedCards.length > 0 && (
        <div className="mt-2 border-t border-border/30 pt-2">
          <div className="flex flex-wrap justify-center gap-1">
            {player.revealedCards.map((card, j) => (
              showGraphics ? (
                <CharacterCard key={j} character={card as Character} size="sm" revealed />
              ) : (
                <span
                  key={j}
                  className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground line-through"
                >
                  {card}
                </span>
              )
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function GameDisplay({
  gameState,
  turnHistory,
  currentTurnInfo,
  showGraphics = true,
  showCards = true,
  className,
}: GameDisplayProps) {
  const currentEntry = currentTurnInfo ? {
    turn: gameState.turnNumber,
    player: gameState.currentPlayerIndex + 1,
    model: gameState.players[gameState.currentPlayerIndex]?.model ?? "",
    action: currentTurnInfo.action as ActionType,
    target: currentTurnInfo.target !== null ? currentTurnInfo.target + 1 : null,
    challenged: currentTurnInfo.challenged,
    blocked: currentTurnInfo.blocked,
    success: currentTurnInfo.success,
  } : null;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header row: Turn info and stats */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border/50 bg-card/80 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 font-mono text-lg font-bold text-primary">
            {gameState.turnNumber}
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Turn</p>
            <p className="font-medium text-foreground">
              {gameState.gameOver ? "Game Over" : `P${gameState.currentPlayerIndex + 1}'s Move`}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4 font-mono text-xs">
          <span className="flex items-center gap-1.5">
            <span>🃏</span>
            <span className="text-muted-foreground">Deck:</span>
            <span className="text-foreground">{gameState.deckSize}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span>👥</span>
            <span className="text-muted-foreground">Alive:</span>
            <span className="text-emerald-400">
              {gameState.players.filter(p => p.cards.length > 0).length}
            </span>
            <span className="text-muted-foreground">/ {gameState.players.length}</span>
          </span>
        </div>
      </div>

      {/* Current turn summary */}
      {currentEntry && (
        <TurnSummary {...currentEntry} />
      )}

      {/* Players grid */}
      <div className={cn(
        "grid gap-3",
        gameState.players.length <= 4 
          ? "grid-cols-2 md:grid-cols-4" 
          : "grid-cols-2 md:grid-cols-3 lg:grid-cols-6"
      )}>
        {gameState.players.map((player, i) => (
          <PlayerPanel
            key={i}
            player={player}
            index={i}
            isCurrentPlayer={i === gameState.currentPlayerIndex}
            showGraphics={showGraphics}
            showCards={showCards}
          />
        ))}
      </div>

      {/* Winner announcement */}
      {gameState.gameOver && gameState.winner !== null && (
        <div className="rounded-xl border-2 border-primary/50 bg-gradient-to-r from-primary/10 to-primary/5 p-6 text-center">
          <div className="mb-2 text-4xl">👑</div>
          <p className="font-display text-2xl tracking-wider text-primary">WINNER</p>
          <p className="mt-2 font-mono text-lg text-foreground">
            P{gameState.winner + 1} — {getModelShort(gameState.players[gameState.winner]?.model ?? "")}
          </p>
          <p className="mt-1 font-mono text-sm text-muted-foreground">
            {gameState.players[gameState.winner]?.coins ?? 0} coins • {gameState.players[gameState.winner]?.cards.length ?? 0} cards remaining
          </p>
        </div>
      )}

      {/* Turn history log */}
      {turnHistory.length > 0 && (
        <div className="rounded-lg border border-border/50 bg-card/50">
          <div className="flex items-center justify-between border-b border-border/30 px-4 py-2">
            <h4 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Turn History</h4>
            <span className="font-mono text-xs text-muted-foreground">{turnHistory.length} turns</span>
          </div>
          <TurnLog 
            entries={turnHistory} 
            maxHeight="300px"
            currentTurn={gameState.turnNumber}
          />
        </div>
      )}
    </div>
  );
}

