"use client";

import { PlayerCard } from "./player-card";
import type { PublicGameState, GameState } from "~/lib/game/types";

interface GameBoardProps {
  gameState: PublicGameState;
  truthState?: GameState;
  showTruth?: boolean;
}

export function GameBoard({ gameState, truthState, showTruth = false }: GameBoardProps) {
  return (
    <div className="space-y-4">
      {/* Turn indicator */}
      <div className="flex justify-center">
        <div className="inline-flex items-center rounded-full bg-gradient-to-r from-violet-600 to-purple-600 px-6 py-2 font-semibold text-white shadow-lg">
          Turn {gameState.turnNumber}
        </div>
      </div>

      {/* Player cards */}
      <div
        className={`grid gap-4 ${
          gameState.players.length <= 4
            ? "grid-cols-2 md:grid-cols-4"
            : "grid-cols-2 md:grid-cols-3 lg:grid-cols-6"
        }`}
      >
        {gameState.players.map((player, index) => (
          <PlayerCard
            key={index}
            player={player}
            isCurrentPlayer={index === gameState.currentPlayerIndex}
            showTruth={showTruth}
            truthCards={truthState?.players[index]?.cards}
          />
        ))}
      </div>

      {/* Game over indicator */}
      {gameState.gameOver && gameState.winner !== null && (
        <div className="mt-6 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 p-6 text-center">
          <h2 className="text-2xl font-bold text-white">🏆 Game Over!</h2>
          <p className="mt-2 text-lg text-white/90">
            Winner: {gameState.players[gameState.winner]?.name}
          </p>
        </div>
      )}
    </div>
  );
}


