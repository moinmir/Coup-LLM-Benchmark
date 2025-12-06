/**
 * Game Storage Service - Saves game data to database and log files
 */

import { db, games, gamePlayers, gameTurns, llmInteractions, gameAnalytics } from "../db";
import { eq, desc } from "drizzle-orm";
import fs from "fs";
import path from "path";
import type { GameSummary, TurnData, GameState } from "~/lib/game/types";

const logsDir = path.join(process.cwd(), "data", "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

export interface GameStorageData {
  gameId: string;
  startedAt: Date;
  players: { model: string; playerIndex: number }[];
}

export class GameStorage {
  private gameId: string;
  private logFile: string;
  private turnCount = 0;

  constructor(gameId: string) {
    this.gameId = gameId;
    this.logFile = path.join(logsDir, `${gameId}.log`);
  }

  async initGame(players: { model: string }[]): Promise<void> {
    const now = new Date();
    
    // Create game record
    await db.insert(games).values({
      id: this.gameId,
      startedAt: now,
      status: "running",
    });

    // Create player records
    for (let i = 0; i < players.length; i++) {
      await db.insert(gamePlayers).values({
        gameId: this.gameId,
        playerIndex: i,
        model: players[i]!.model,
      });
    }

    this.writeLog(`=== COUP GAME: ${this.gameId} ===`);
    this.writeLog(`Started: ${now.toISOString()}`);
    this.writeLog(`Players: ${players.map((p, i) => `${i + 1}. ${p.model}`).join(", ")}`);
    this.writeLog("=".repeat(60));
  }

  async saveTurn(
    turnData: TurnData,
    gameStateBefore: GameState,
    gameStateAfter: GameState
  ): Promise<void> {
    this.turnCount++;

    await db.insert(gameTurns).values({
      gameId: this.gameId,
      turnNumber: this.turnCount,
      playerIndex: gameStateBefore.currentPlayerIndex,
      model: turnData.model,
      action: turnData.action,
      targetIndex: turnData.target,
      challenged: turnData.challenged,
      blocked: turnData.blocked,
      success: turnData.resultSuccess,
      events: JSON.stringify(turnData.events),
      gameStateBefore: JSON.stringify(gameStateBefore),
      gameStateAfter: JSON.stringify(gameStateAfter),
    });

    this.writeLog(`\n--- TURN ${this.turnCount}: ${turnData.model.split("/").pop()} ---`);
    for (const event of turnData.events) {
      this.writeLog(`  ${event}`);
    }
  }

  async saveInteraction(
    turnNumber: number,
    model: string,
    type: "action" | "challenge" | "block" | "card_loss" | "exchange",
    prompt: string,
    response: string,
    parsedResult: unknown,
    wasRetry: boolean
  ): Promise<void> {
    await db.insert(llmInteractions).values({
      gameId: this.gameId,
      turnNumber,
      model,
      interactionType: type,
      prompt,
      response,
      parsedResult: JSON.stringify(parsedResult),
      wasRetry,
      timestamp: new Date(),
    });

    const shortModel = model.split("/").pop();
    this.writeLog(`\n[${shortModel}] ${type.toUpperCase()}${wasRetry ? " (RETRY)" : ""}`);
    this.writeLog(`PROMPT:\n${prompt.slice(0, 500)}${prompt.length > 500 ? "..." : ""}`);
    this.writeLog(`RESPONSE: ${response}`);
    this.writeLog(`PARSED: ${JSON.stringify(parsedResult)}`);
  }

  async finalizeGame(summary: GameSummary): Promise<void> {
    const now = new Date();

    await db
      .update(games)
      .set({
        endedAt: now,
        totalTurns: summary.totalTurns,
        winnerIndex: summary.winner,
        winnerModel: summary.winnerModel,
        status: "completed",
      })
      .where(eq(games.id, this.gameId));

    for (const player of summary.players) {
      await db
        .update(gamePlayers)
        .set({
          finalCoins: player.finalCoins,
          survived: player.survived,
          revealedCards: JSON.stringify(player.revealedCards),
        })
        .where(
          eq(gamePlayers.gameId, this.gameId)
        );
    }

    if (summary.analytics) {
      await db.insert(gameAnalytics).values({
        gameId: this.gameId,
        bluffStats: JSON.stringify(summary.analytics.bluffStats),
        challengeStats: JSON.stringify(summary.analytics.challengeStats),
        blockStats: JSON.stringify(summary.analytics.blockStats),
        invalidActionStats: JSON.stringify(summary.analytics.invalidActionStats),
        actionCounts: JSON.stringify(summary.analytics.actionCounts),
      });
    }

    this.writeLog("\n" + "=".repeat(60));
    this.writeLog(`GAME OVER`);
    this.writeLog(`Winner: ${summary.winnerModel?.split("/").pop() ?? "None"}`);
    this.writeLog(`Total Turns: ${summary.totalTurns}`);
    this.writeLog(`Ended: ${now.toISOString()}`);
    this.writeLog("=".repeat(60));
  }

  async markError(error: string): Promise<void> {
    await db
      .update(games)
      .set({ status: "error" })
      .where(eq(games.id, this.gameId));

    this.writeLog(`\nERROR: ${error}`);
  }

  private writeLog(message: string): void {
    fs.appendFileSync(this.logFile, message + "\n");
  }

  getTurnNumber(): number {
    return this.turnCount;
  }
}

export async function getRecentGames(limit = 20) {
  return db
    .select()
    .from(games)
    .where(eq(games.status, "completed"))
    .orderBy(desc(games.endedAt))
    .limit(limit);
}

export async function getGameById(gameId: string) {
  const [game] = await db
    .select()
    .from(games)
    .where(eq(games.id, gameId))
    .limit(1);
  return game;
}

export async function getGamePlayers(gameId: string) {
  return db
    .select()
    .from(gamePlayers)
    .where(eq(gamePlayers.gameId, gameId))
    .orderBy(gamePlayers.playerIndex);
}

export async function getGameTurns(gameId: string) {
  return db
    .select()
    .from(gameTurns)
    .where(eq(gameTurns.gameId, gameId))
    .orderBy(gameTurns.turnNumber);
}

export async function getGameInteractions(gameId: string) {
  return db
    .select()
    .from(llmInteractions)
    .where(eq(llmInteractions.gameId, gameId))
    .orderBy(llmInteractions.turnNumber, llmInteractions.timestamp);
}

export async function getGameAnalytics(gameId: string) {
  const [analytics] = await db
    .select()
    .from(gameAnalytics)
    .where(eq(gameAnalytics.gameId, gameId))
    .limit(1);
  return analytics;
}

export async function getAllAnalytics() {
  const allGames = await db
    .select()
    .from(games)
    .where(eq(games.status, "completed"));

  const allAnalytics = await db.select().from(gameAnalytics);

  return { games: allGames, analytics: allAnalytics };
}

export async function clearAllGames() {
  await db.delete(llmInteractions);
  await db.delete(gameTurns);
  await db.delete(gameAnalytics);
  await db.delete(gamePlayers);
  await db.delete(games);
}

