"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Slider } from "~/components/ui/slider";
import { Progress } from "~/components/ui/progress";
import { GameDisplay } from "~/components/game";
import { api } from "~/trpc/react";
import { toast } from "sonner";
import { cn } from "~/lib/utils";
import type { GameState, ActionType } from "~/lib/game/types";

// Helper to get short model name
function getModelShortName(model: string): string {
  return model.split("/").pop() ?? model;
}

type Mode = "new" | "replay";

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

export function RunGame() {
  // Mode: new game or replay
  const [mode, setMode] = useState<Mode>("new");
  
  // New game settings
  const [numPlayers, setNumPlayers] = useState(4);
  const [maxTurns, setMaxTurns] = useState(100);
  const [selectedModels, setSelectedModels] = useState<string[]>([
    "meta-llama/llama-3.3-70b-instruct",
    "meta-llama/llama-3.1-8b-instruct",
    "qwen/qwen-2.5-72b-instruct",
    "google/gemini-2.0-flash-001",
  ]);
  
  // Display settings
  const [showGraphics, setShowGraphics] = useState(true);
  const [showCards, setShowCards] = useState(true);
  const [showConfig, setShowConfig] = useState(true);

  // Game state
  const [truthState, setTruthState] = useState<GameState | null>(null);
  const [turnHistory, setTurnHistory] = useState<TurnEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTurnInfo, setCurrentTurnInfo] = useState<{
    action: string;
    target: number | null;
    challenged: boolean;
    blocked: boolean;
    success: boolean;
  } | null>(null);

  // Replay state
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [replayTurn, setReplayTurn] = useState(0);
  const [isReplaying, setIsReplaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState(1000);

  // API
  const { data: models = [] } = api.game.getModels.useQuery();
  const { data: gameList = [] } = api.game.getGameList.useQuery();
  const { data: replayData, isLoading: isLoadingReplay } = api.game.getGame.useQuery(
    { gameId: selectedGameId! },
    { enabled: !!selectedGameId && mode === "replay" }
  );
  const createGame = api.game.createGame.useMutation();
  const runTurn = api.game.runTurn.useMutation();
  const utils = api.useUtils();

  // Auto-play replay
  useEffect(() => {
    if (!isReplaying || !replayData) return;
    
    const interval = setInterval(() => {
      setReplayTurn(prev => {
        if (prev >= replayData.turns.length - 1) {
          setIsReplaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, replaySpeed);

    return () => clearInterval(interval);
  }, [isReplaying, replayData, replaySpeed]);

  // Update replay state when turn changes
  useEffect(() => {
    if (!replayData || mode !== "replay") return;
    
    const turn = replayData.turns[replayTurn];
    if (!turn) return;
    
    setTruthState(turn.gameStateAfter as GameState);
    setCurrentTurnInfo({
      action: turn.action,
      target: turn.targetIndex,
      challenged: turn.challenged,
      blocked: turn.blocked,
      success: turn.success,
    });
    
    // Build turn history up to current turn
    const history: TurnEntry[] = replayData.turns.slice(0, replayTurn + 1).map((t, i) => ({
      turn: i + 1,
      player: t.playerIndex + 1,
      model: t.model,
      action: t.action as ActionType,
      target: t.targetIndex !== null ? t.targetIndex + 1 : null,
      challenged: t.challenged,
      blocked: t.blocked,
      success: t.success,
    }));
    setTurnHistory(history);
  }, [replayData, replayTurn, mode]);

  // Update models when numPlayers changes
  const handleNumPlayersChange = (value: number[]) => {
    const newNum = value[0] ?? 4;
    setNumPlayers(newNum);
    
    if (newNum > selectedModels.length) {
      const newModels = [...selectedModels];
      for (let i = selectedModels.length; i < newNum; i++) {
        newModels.push(models[i % models.length] ?? "meta-llama/llama-3.3-70b-instruct");
      }
      setSelectedModels(newModels);
    } else {
      setSelectedModels(selectedModels.slice(0, newNum));
    }
  };

  const updateModel = (index: number, model: string) => {
    const newModels = [...selectedModels];
    newModels[index] = model;
    setSelectedModels(newModels);
  };

  const runGame = useCallback(async () => {
    setIsRunning(true);
    setProgress(0);
    setTurnHistory([]);
    setCurrentTurnInfo(null);
    setShowConfig(false);
    
    try {
      const players = selectedModels.slice(0, numPlayers).map((model, i) => ({
        name: `P${i + 1}`,
        model,
      }));

      const { gameId: newGameId, truthState: initialTruth } = 
        await createGame.mutateAsync({ players, maxTurns });

      setTruthState(initialTruth);

      let currentTurn = 0;
      let gameOver = false;
      const history: TurnEntry[] = [];

      while (!gameOver && currentTurn < maxTurns) {
        const result = await runTurn.mutateAsync({ gameId: newGameId });
        
        setTruthState(result.gameStateWithTruth);
        setProgress((currentTurn / maxTurns) * 100);
        
        const turnEntry: TurnEntry = {
          turn: currentTurn + 1,
          player: result.turnData.turn,
          model: result.turnData.model,
          action: result.turnData.action,
          target: result.turnData.target !== null ? result.turnData.target + 1 : null,
          challenged: result.turnData.challenged,
          blocked: result.turnData.blocked,
          success: result.turnData.resultSuccess,
        };
        
        history.push(turnEntry);
        setTurnHistory([...history]);
        
        setCurrentTurnInfo({
          action: result.turnData.action,
          target: result.turnData.target,
          challenged: result.turnData.challenged,
          blocked: result.turnData.blocked,
          success: result.turnData.resultSuccess,
        });
        
        gameOver = result.gameOver;
        currentTurn++;

        if (result.summary) {
          const winnerModel = getModelShortName(result.summary.winnerModel ?? "Unknown");
          toast.success(`👑 P${(result.summary.winner ?? 0) + 1} (${winnerModel}) wins!`, {
            description: `Game ended in ${result.summary.totalTurns} turns`,
          });
          await utils.game.getResults.invalidate();
          await utils.game.getGameList.invalidate();
        }

        // Small delay for UI updates
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      setProgress(100);
    } catch (error) {
      console.error("Game error:", error);
      
      let errorMessage = "Unknown error occurred";
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      if (errorMessage.includes("OPENROUTER_API_KEY")) {
        toast.error("API Key Missing", {
          description: "Please add your OPENROUTER_API_KEY to the .env file and restart the server.",
        });
      } else {
        toast.error("Game Error", { description: errorMessage });
      }
    } finally {
      setIsRunning(false);
    }
  }, [selectedModels, numPlayers, maxTurns, createGame, runTurn, utils]);

  const resetGame = () => {
    setTruthState(null);
    setTurnHistory([]);
    setProgress(0);
    setCurrentTurnInfo(null);
    setShowConfig(true);
  };

  const selectReplay = (gameId: string) => {
    setSelectedGameId(gameId);
    setReplayTurn(0);
    setIsReplaying(false);
    setShowConfig(false);
  };

  return (
    <div className="space-y-4">
      {/* Mode toggle & controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border/50 bg-card/80 p-3">
        {/* Mode tabs */}
        <div className="flex items-center gap-1 rounded-lg bg-muted/50 p-1">
          <button
            onClick={() => { setMode("new"); resetGame(); }}
            className={cn(
              "rounded-md px-4 py-2 font-mono text-sm transition-colors",
              mode === "new" 
                ? "bg-primary text-primary-foreground" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            ▶ New Game
          </button>
          <button
            onClick={() => { setMode("replay"); resetGame(); }}
            className={cn(
              "rounded-md px-4 py-2 font-mono text-sm transition-colors",
              mode === "replay" 
                ? "bg-primary text-primary-foreground" 
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            🎬 Replay
          </button>
        </div>

        {/* Display options */}
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showGraphics}
              onChange={(e) => setShowGraphics(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <span className="font-mono text-xs text-muted-foreground">Graphics</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showCards}
              onChange={(e) => setShowCards(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <span className="font-mono text-xs text-muted-foreground">Show Cards</span>
          </label>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowConfig(!showConfig)}
            className="font-mono text-xs"
          >
            {showConfig ? "▲ Hide" : "▼ Config"}
          </Button>
        </div>
      </div>

      {/* NEW GAME MODE */}
      {mode === "new" && (
        <>
          {/* Configuration */}
          {showConfig && (
            <div className="grid gap-4 lg:grid-cols-2 animate-in slide-in-from-top-2 duration-200">
              {/* Settings */}
              <Card className="border-border/50 bg-card/80">
                <CardHeader className="border-b border-border/30 bg-muted/30 py-2">
                  <CardTitle className="font-mono text-sm uppercase tracking-wider">
                    ⚙ Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 p-4">
                  <div>
                    <label className="mb-1 flex items-center justify-between font-mono text-xs text-muted-foreground">
                      <span>Players</span>
                      <span className="text-primary">{numPlayers}</span>
                    </label>
                    <Slider
                      value={[numPlayers]}
                      onValueChange={handleNumPlayersChange}
                      min={3}
                      max={6}
                      step={1}
                      disabled={isRunning}
                    />
                  </div>
                  <div>
                    <label className="mb-1 flex items-center justify-between font-mono text-xs text-muted-foreground">
                      <span>Max Turns</span>
                      <span className="text-primary">{maxTurns}</span>
                    </label>
                    <Slider
                      value={[maxTurns]}
                      onValueChange={(v) => setMaxTurns(v[0] ?? 100)}
                      min={50}
                      max={200}
                      step={10}
                      disabled={isRunning}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Models */}
              <Card className="border-border/50 bg-card/80">
                <CardHeader className="border-b border-border/30 bg-muted/30 py-2">
                  <CardTitle className="font-mono text-sm uppercase tracking-wider">
                    🤖 Models
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 gap-2">
                    {selectedModels.slice(0, numPlayers).map((model, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 font-mono text-xs font-bold text-primary">
                          P{i + 1}
                        </span>
                        <Select
                          value={model}
                          onValueChange={(v) => updateModel(i, v)}
                          disabled={isRunning}
                        >
                          <SelectTrigger className="h-8 flex-1 font-mono text-[10px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {models.map((m) => (
                              <SelectItem key={m} value={m} className="font-mono text-xs">
                                {getModelShortName(m)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Action bar */}
          <div className="flex items-center gap-3">
            <Button
              onClick={runGame}
              disabled={isRunning}
              className="gap-2 font-mono uppercase tracking-wider"
            >
              {isRunning ? "⏳ Running..." : "▶ Start Game"}
            </Button>
            <Button onClick={resetGame} variant="outline" disabled={isRunning} size="sm" className="font-mono">
              ↺ Reset
            </Button>
            {isRunning && (
              <div className="flex flex-1 items-center gap-2">
                <Progress value={progress} className="h-2 flex-1" />
                <span className="font-mono text-xs text-primary">{Math.round(progress)}%</span>
              </div>
            )}
          </div>
        </>
      )}

      {/* REPLAY MODE */}
      {mode === "replay" && (
        <>
          {/* Game selector */}
          {showConfig && (
            <Card className="border-border/50 bg-card/80 animate-in slide-in-from-top-2 duration-200">
              <CardHeader className="border-b border-border/30 bg-muted/30 py-2">
                <CardTitle className="font-mono text-sm uppercase tracking-wider">
                  🎬 Select Game to Replay
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {gameList.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No games yet. Play a game first!</p>
                ) : (
                  <Select
                    value={selectedGameId ?? ""}
                    onValueChange={selectReplay}
                  >
                    <SelectTrigger className="w-full font-mono text-sm">
                      <SelectValue placeholder="Select a game..." />
                    </SelectTrigger>
                    <SelectContent>
                      {gameList.map((game) => (
                        <SelectItem key={game.id} value={game.id} className="font-mono text-xs">
                          {new Date(game.startedAt).toLocaleDateString()}{" "}
                          {new Date(game.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {" • "}{game.totalTurns} turns
                          {" • "}Winner: P{(game.winnerIndex ?? 0) + 1}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </CardContent>
            </Card>
          )}

          {/* Replay controls */}
          {selectedGameId && replayData && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/50 bg-card/80 p-3">
              {/* Transport */}
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setReplayTurn(0)}
                  disabled={replayTurn === 0 || isReplaying}
                >
                  ⏮
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setReplayTurn(Math.max(0, replayTurn - 1))}
                  disabled={replayTurn === 0 || isReplaying}
                >
                  ◀
                </Button>
                <Button
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => isReplaying ? setIsReplaying(false) : setIsReplaying(true)}
                  disabled={replayTurn >= replayData.turns.length - 1 && !isReplaying}
                >
                  {isReplaying ? "⏸" : "▶"}
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setReplayTurn(Math.min(replayData.turns.length - 1, replayTurn + 1))}
                  disabled={replayTurn >= replayData.turns.length - 1 || isReplaying}
                >
                  ▶
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setReplayTurn(replayData.turns.length - 1)}
                  disabled={replayTurn >= replayData.turns.length - 1 || isReplaying}
                >
                  ⏭
                </Button>
              </div>

              {/* Speed */}
              <Select value={String(replaySpeed)} onValueChange={(v) => setReplaySpeed(Number(v))}>
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

              {/* Slider */}
              <div className="flex flex-1 items-center gap-2">
                <Slider
                  value={[replayTurn]}
                  onValueChange={([v]) => setReplayTurn(v ?? 0)}
                  min={0}
                  max={replayData.turns.length - 1}
                  step={1}
                  disabled={isReplaying}
                  className="flex-1"
                />
                <span className="font-mono text-xs text-muted-foreground">
                  <span className="text-foreground">{replayTurn + 1}</span> / {replayData.turns.length}
                </span>
              </div>
            </div>
          )}

          {/* Loading state */}
          {selectedGameId && isLoadingReplay && (
            <div className="flex items-center justify-center py-12">
              <span className="animate-spin text-2xl">⏳</span>
              <span className="ml-2 font-mono text-sm text-muted-foreground">Loading game...</span>
            </div>
          )}
        </>
      )}

      {/* Game display */}
      {truthState && (
        <GameDisplay
          gameState={truthState}
          turnHistory={turnHistory}
          currentTurnInfo={currentTurnInfo ?? undefined}
          showGraphics={showGraphics}
          showCards={showCards}
        />
      )}

      {/* Empty state */}
      {!truthState && !isLoadingReplay && (
        <div className="flex min-h-[300px] items-center justify-center rounded-lg border-2 border-dashed border-border/30 bg-muted/5">
          <div className="text-center">
            <div className="mb-3 text-4xl opacity-30">
              {mode === "new" ? "🎴" : "🎬"}
            </div>
            <p className="font-mono text-sm text-muted-foreground">
              {mode === "new" 
                ? "Configure settings and click Start Game" 
                : "Select a game to replay"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
