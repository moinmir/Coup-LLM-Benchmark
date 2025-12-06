"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Slider } from "~/components/ui/slider";
import { api } from "~/trpc/react";
import { GameViewer } from "~/components/game";
import type { GameState } from "~/lib/game/types";

function getModelShortName(model: string): string {
  return model.split("/").pop() ?? model;
}

export function Replay() {
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(1000); // ms between turns

  const { data: gameList = [] } = api.game.getGameList.useQuery();
  const { data: gameData, isLoading } = api.game.getGame.useQuery(
    { gameId: selectedGameId! },
    { enabled: !!selectedGameId }
  );

  // Auto-play functionality
  useEffect(() => {
    if (!isPlaying || !gameData) return;
    
    const interval = setInterval(() => {
      setCurrentTurn(prev => {
        if (prev >= gameData.turns.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, playSpeed);

    return () => clearInterval(interval);
  }, [isPlaying, gameData, playSpeed]);

  const handlePlay = useCallback(() => {
    if (!gameData || currentTurn >= gameData.turns.length - 1) return;
    setIsPlaying(true);
  }, [gameData, currentTurn]);

  const handleStop = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const handleStepForward = useCallback(() => {
    if (!gameData) return;
    setCurrentTurn(prev => Math.min(gameData.turns.length - 1, prev + 1));
  }, [gameData]);

  const handleStepBack = useCallback(() => {
    setCurrentTurn(prev => Math.max(0, prev - 1));
  }, []);

  const currentTurnData = gameData?.turns[currentTurn];
  const currentState = currentTurnData?.gameStateAfter as GameState | undefined;
  
  // Collect all events up to and including current turn
  const accumulatedEvents = gameData?.turns
    .slice(0, currentTurn + 1)
    .flatMap(t => t.events) ?? [];

  return (
    <div className="space-y-6">
      {/* Game Selection */}
      <Card className="overflow-hidden border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="border-b border-border/30 bg-muted/30 py-3">
          <CardTitle className="flex items-center gap-2 font-display text-lg tracking-wider">
            <span className="text-primary">🎬</span>
            Game Replay
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Select
              value={selectedGameId ?? ""}
              onValueChange={(v) => {
                setSelectedGameId(v);
                setCurrentTurn(0);
                setIsPlaying(false);
              }}
            >
              <SelectTrigger className="w-full font-mono text-sm sm:w-96">
                <SelectValue placeholder="Select a game to replay..." />
              </SelectTrigger>
              <SelectContent>
                {gameList.map((game) => (
                  <SelectItem key={game.id} value={game.id} className="font-mono text-xs">
                    <span className="text-muted-foreground">
                      {new Date(game.startedAt).toLocaleDateString()}{" "}
                      {new Date(game.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="mx-2">•</span>
                    <span>{game.totalTurns} turns</span>
                    <span className="mx-2">•</span>
                    <span className="text-primary">
                      Winner: P{(gameList.find(g => g.id === game.id)?.winnerIndex ?? 0) + 1}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {gameList.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No games yet. Play a game first!
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* No game selected */}
      {!selectedGameId && gameList.length > 0 && (
        <Card className="overflow-hidden border-border/50 bg-card/80">
          <CardContent className="py-12 text-center">
            <div className="mb-4 text-5xl opacity-20">🎬</div>
            <p className="font-display text-lg tracking-wider text-foreground">
              Select a Game
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose a completed game from the dropdown to replay it step by step.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {selectedGameId && isLoading && (
        <Card className="overflow-hidden border-border/50 bg-card/80">
          <CardContent className="py-12 text-center">
            <div className="mb-4 animate-spin text-4xl">⏳</div>
            <p className="font-mono text-sm text-muted-foreground">Loading game...</p>
          </CardContent>
        </Card>
      )}

      {/* Replay UI */}
      {gameData && !isLoading && (
        <>
          {/* Playback Controls */}
          <Card className="overflow-hidden border-border/50 bg-card/80 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                {/* Transport controls */}
                <div className="flex items-center gap-2">
                  {/* Jump to start */}
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentTurn(0)}
                    disabled={currentTurn === 0 || isPlaying}
                    title="Jump to start"
                  >
                    ⏮
                  </Button>

                  {/* Step back */}
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleStepBack}
                    disabled={currentTurn === 0 || isPlaying}
                    title="Previous turn"
                  >
                    ◀
                  </Button>

                  {/* Play/Pause */}
                  {isPlaying ? (
                    <Button 
                      onClick={handleStop} 
                      size="icon" 
                      className="h-8 w-8"
                      title="Pause"
                    >
                      ⏸
                    </Button>
                  ) : (
                    <Button 
                      onClick={handlePlay} 
                      size="icon"
                      className="h-8 w-8"
                      disabled={currentTurn >= gameData.turns.length - 1}
                      title="Play"
                    >
                      ▶
                    </Button>
                  )}

                  {/* Step forward */}
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={handleStepForward}
                    disabled={currentTurn >= gameData.turns.length - 1 || isPlaying}
                    title="Next turn"
                  >
                    ▶
                  </Button>

                  {/* Jump to end */}
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setCurrentTurn(gameData.turns.length - 1)}
                    disabled={currentTurn >= gameData.turns.length - 1 || isPlaying}
                    title="Jump to end"
                  >
                    ⏭
                  </Button>
                </div>

                {/* Speed control */}
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">Speed:</span>
                  <Select
                    value={String(playSpeed)}
                    onValueChange={(v) => setPlaySpeed(Number(v))}
                    disabled={isPlaying}
                  >
                    <SelectTrigger className="h-8 w-20 font-mono text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2000" className="font-mono text-xs">0.5x</SelectItem>
                      <SelectItem value="1000" className="font-mono text-xs">1x</SelectItem>
                      <SelectItem value="500" className="font-mono text-xs">2x</SelectItem>
                      <SelectItem value="250" className="font-mono text-xs">4x</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Turn slider */}
                <div className="flex flex-1 items-center gap-3">
                  <Slider
                    value={[currentTurn]}
                    onValueChange={([v]) => setCurrentTurn(v ?? 0)}
                    min={0}
                    max={gameData.turns.length - 1}
                    step={1}
                    disabled={isPlaying}
                    className="flex-1"
                  />
                  <div className="font-mono text-sm text-muted-foreground">
                    <span className="text-foreground">{currentTurn + 1}</span>
                    <span className="mx-1">/</span>
                    <span>{gameData.turns.length}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Current Turn Summary */}
          {currentTurnData && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
              <span className="font-display tracking-wider text-foreground">
                Turn {currentTurn + 1}:
              </span>
              <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-primary/20 px-1.5 font-mono text-xs font-bold text-primary">
                P{currentTurnData.playerIndex + 1}
              </span>
              <span className="font-mono text-sm text-muted-foreground">
                ({getModelShortName(currentTurnData.model)})
              </span>
              <span className="mx-1 text-muted-foreground">→</span>
              <span className="rounded bg-muted px-2 py-0.5 font-mono text-sm">
                {currentTurnData.action.toUpperCase().replace("_", " ")}
              </span>
              {currentTurnData.targetIndex !== null && (
                <>
                  <span className="text-muted-foreground">→</span>
                  <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-muted px-1.5 font-mono text-xs">
                    P{currentTurnData.targetIndex + 1}
                  </span>
                </>
              )}
              {currentTurnData.challenged && (
                <span className="rounded bg-amber-500/20 px-2 py-0.5 font-mono text-xs text-amber-400">
                  ⚔ CHALLENGED
                </span>
              )}
              {currentTurnData.blocked && (
                <span className="rounded bg-blue-500/20 px-2 py-0.5 font-mono text-xs text-blue-400">
                  🛡 BLOCKED
                </span>
              )}
              <span
                className={`rounded px-2 py-0.5 font-mono text-xs ${
                  currentTurnData.success
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-red-500/20 text-red-400"
                }`}
              >
                {currentTurnData.success ? "✓ SUCCESS" : "✗ FAILED"}
              </span>
            </div>
          )}

          {/* Game Viewer */}
          {currentState && (
            <GameViewer
              gameState={currentState}
              events={accumulatedEvents}
              currentTurnInfo={currentTurnData ? {
                action: currentTurnData.action,
                target: currentTurnData.targetIndex,
                challenged: currentTurnData.challenged,
                blocked: currentTurnData.blocked,
                success: currentTurnData.success,
              } : undefined}
              showTruth
            />
          )}
        </>
      )}
    </div>
  );
}
