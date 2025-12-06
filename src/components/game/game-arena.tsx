"use client";

import { useState } from "react";
import { cn } from "~/lib/utils";
import type { GameState, ActionType, Character } from "~/lib/game/types";
import { CharacterCard, HiddenCard } from "./character-card";
import { ActionDisplay } from "./action-display";
import { GameLog } from "./game-log";
import { Button } from "~/components/ui/button";

interface GameArenaProps {
  gameState: GameState;
  events: string[];
  currentTurnInfo?: {
    action: string;
    target: number | null;
    challenged: boolean;
    blocked: boolean;
    success: boolean;
  };
  className?: string;
}

// Get position styles for players around the table
function getPlayerPosition(index: number, total: number): string {
  // Distribute players in an arc at the bottom, with center at top
  const positions: Record<number, string[]> = {
    3: [
      "bottom-4 left-1/2 -translate-x-1/2",
      "bottom-24 left-8",
      "bottom-24 right-8",
    ],
    4: [
      "bottom-4 left-1/2 -translate-x-1/2",
      "bottom-20 left-4",
      "top-4 left-1/2 -translate-x-1/2",
      "bottom-20 right-4",
    ],
    5: [
      "bottom-4 left-1/2 -translate-x-1/2",
      "bottom-16 left-8",
      "top-12 left-12",
      "top-12 right-12",
      "bottom-16 right-8",
    ],
    6: [
      "bottom-4 left-1/2 -translate-x-1/2",
      "bottom-16 left-4",
      "top-20 left-4",
      "top-4 left-1/2 -translate-x-1/2",
      "top-20 right-4",
      "bottom-16 right-4",
    ],
  };
  
  return positions[total]?.[index] ?? "bottom-4 left-1/2 -translate-x-1/2";
}

// Get model short name
function getModelShort(model: string): string {
  const name = model.split("/").pop() ?? model;
  return name.length > 12 ? name.slice(0, 10) + "…" : name;
}

// Player seat component
function PlayerSeat({
  player,
  index,
  isCurrentPlayer,
  isEliminated,
  showCards,
  className,
}: {
  player: GameState["players"][0];
  index: number;
  isCurrentPlayer: boolean;
  isEliminated: boolean;
  showCards: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "absolute flex flex-col items-center transition-all duration-500",
        isEliminated && "opacity-40 grayscale",
        className
      )}
    >
      {/* Player badge */}
      <div className={cn(
        "mb-2 flex items-center gap-2 rounded-full px-3 py-1.5 backdrop-blur-sm transition-all",
        isCurrentPlayer 
          ? "bg-primary/90 text-primary-foreground shadow-lg shadow-primary/30 scale-110 pulse-glow" 
          : "bg-card/80 text-foreground border border-border/50"
      )}>
        <span className="font-display text-sm">P{index + 1}</span>
        {isCurrentPlayer && <span className="animate-pulse text-xs">▶</span>}
      </div>
      
      {/* Model name */}
      <p className="mb-2 font-mono text-[10px] text-muted-foreground">
        {getModelShort(player.model)}
      </p>
      
      {/* Cards */}
      <div className="flex gap-1">
        {isEliminated ? (
          <div className="flex items-center gap-1 rounded bg-destructive/20 px-2 py-1">
            <span className="text-sm">💀</span>
            <span className="font-mono text-xs text-destructive">OUT</span>
          </div>
        ) : showCards ? (
          player.cards.map((card, i) => (
            <CharacterCard key={i} character={card} size="sm" />
          ))
        ) : (
          Array.from({ length: player.cards.length }).map((_, i) => (
            <HiddenCard key={i} size="sm" />
          ))
        )}
      </div>
      
      {/* Revealed cards (dead) */}
      {player.revealedCards.length > 0 && (
        <div className="mt-1 flex gap-0.5">
          {player.revealedCards.map((card, i) => (
            <CharacterCard key={i} character={card as Character} size="sm" revealed />
          ))}
        </div>
      )}
      
      {/* Coins */}
      <div className={cn(
        "mt-2 flex items-center gap-1 rounded-full px-2 py-0.5",
        "bg-gradient-to-r from-amber-500/20 to-yellow-500/20 border border-amber-500/30"
      )}>
        <span className="text-sm">💰</span>
        <span className="font-mono text-sm font-bold text-amber-400">{player.coins}</span>
      </div>
    </div>
  );
}

export function GameArena({
  gameState,
  events,
  currentTurnInfo,
  className,
}: GameArenaProps) {
  const [showLog, setShowLog] = useState(false);
  const [showAllCards, setShowAllCards] = useState(true);

  const numPlayers = gameState.players.length;
  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const targetPlayer = currentTurnInfo?.target !== null && currentTurnInfo?.target !== undefined
    ? gameState.players[currentTurnInfo.target]
    : null;

  return (
    <div className={cn("relative", className)}>
      {/* Arena container - fixed aspect ratio */}
      <div className="relative mx-auto aspect-[4/3] max-h-[600px] w-full max-w-4xl">
        {/* Table background */}
        <div className="absolute inset-8 rounded-[100px] bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-950 shadow-2xl shadow-black/50">
          {/* Table felt texture */}
          <div className="absolute inset-0 rounded-[100px] bg-[radial-gradient(ellipse_at_center,_transparent_0%,_rgba(0,0,0,0.3)_100%)]" />
          
          {/* Table rim */}
          <div className="absolute inset-0 rounded-[100px] border-8 border-amber-900/60 shadow-inner" />
          <div className="absolute inset-2 rounded-[92px] border-2 border-amber-700/30" />
        </div>

        {/* Center action display */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <ActionDisplay
            action={currentTurnInfo?.action as ActionType ?? null}
            actorIndex={gameState.currentPlayerIndex}
            targetIndex={currentTurnInfo?.target ?? null}
            challenged={currentTurnInfo?.challenged ?? false}
            blocked={currentTurnInfo?.blocked ?? false}
            success={currentTurnInfo?.success ?? true}
            actorName={currentPlayer?.model ? getModelShort(currentPlayer.model) : undefined}
            targetName={targetPlayer?.model ? getModelShort(targetPlayer.model) : undefined}
          />
        </div>

        {/* Player seats */}
        {gameState.players.map((player, i) => (
          <PlayerSeat
            key={i}
            player={player}
            index={i}
            isCurrentPlayer={i === gameState.currentPlayerIndex}
            isEliminated={player.cards.length === 0}
            showCards={showAllCards}
            className={getPlayerPosition(i, numPlayers)}
          />
        ))}

        {/* Turn indicator */}
        <div className="absolute left-4 top-4 flex items-center gap-2 rounded-lg bg-card/90 px-3 py-2 backdrop-blur-sm">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary font-display text-lg text-primary-foreground">
            {gameState.turnNumber}
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Turn</p>
            <p className="font-display text-sm tracking-wider text-foreground">
              {gameState.gameOver ? "GAME OVER" : `P${gameState.currentPlayerIndex + 1}'s Move`}
            </p>
          </div>
        </div>

        {/* Game stats */}
        <div className="absolute right-4 top-4 flex items-center gap-3 rounded-lg bg-card/90 px-3 py-2 backdrop-blur-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-sm">🃏</span>
            <span className="font-mono text-xs text-muted-foreground">
              Deck: <span className="text-foreground">{gameState.deckSize}</span>
            </span>
          </div>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-1.5">
            <span className="text-sm">👥</span>
            <span className="font-mono text-xs text-muted-foreground">
              Alive: <span className="text-emerald-400">{gameState.players.filter(p => p.cards.length > 0).length}</span>
              /{numPlayers}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="absolute bottom-4 right-4 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAllCards(!showAllCards)}
            className="font-mono text-xs"
          >
            {showAllCards ? "🔒 Hide" : "👁️ Show"} Cards
          </Button>
          <Button
            variant={showLog ? "default" : "outline"}
            size="sm"
            onClick={() => setShowLog(!showLog)}
            className="font-mono text-xs"
          >
            📜 Log
          </Button>
        </div>
      </div>

      {/* Winner overlay */}
      {gameState.gameOver && gameState.winner !== null && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-500">
          <div className="rounded-2xl border-2 border-primary bg-gradient-to-br from-card to-card/90 p-8 text-center shadow-2xl animate-in zoom-in-75 duration-500">
            <div className="mb-4 text-6xl float">👑</div>
            <p className="font-display text-3xl tracking-wider text-primary">VICTORY</p>
            <div className="mt-4 flex items-center justify-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary font-display text-xl text-primary-foreground">
                P{gameState.winner + 1}
              </div>
              <div className="text-left">
                <p className="font-display text-xl tracking-wider text-foreground">
                  {gameState.players[gameState.winner]?.name}
                </p>
                <p className="font-mono text-sm text-muted-foreground">
                  {getModelShort(gameState.players[gameState.winner]?.model ?? "")}
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-center gap-2">
              <span className="text-2xl">💰</span>
              <span className="font-mono text-2xl font-bold text-amber-400">
                {gameState.players[gameState.winner]?.coins ?? 0}
              </span>
              <span className="text-muted-foreground">coins remaining</span>
            </div>
          </div>
        </div>
      )}

      {/* Slide-out event log */}
      <div className={cn(
        "fixed right-0 top-0 z-50 h-screen w-80 bg-card/95 backdrop-blur-md border-l border-border shadow-2xl transition-transform duration-300",
        showLog ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-border/50 p-4">
            <h3 className="font-display text-lg tracking-wider">Event Log</h3>
            <Button variant="ghost" size="sm" onClick={() => setShowLog(false)}>
              ✕
            </Button>
          </div>
          <div className="flex-1 overflow-hidden p-4">
            <GameLog events={events} maxHeight="calc(100vh - 120px)" />
          </div>
        </div>
      </div>
      
      {/* Log overlay backdrop */}
      {showLog && (
        <div 
          className="fixed inset-0 z-40 bg-black/20" 
          onClick={() => setShowLog(false)}
        />
      )}
    </div>
  );
}

