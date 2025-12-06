/**
 * Database schema for game results and replay data
 */

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// Game results table
export const games = sqliteTable("games", {
  id: text("id").primaryKey(),
  startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
  endedAt: integer("ended_at", { mode: "timestamp" }),
  totalTurns: integer("total_turns"),
  winnerIndex: integer("winner_index"),
  winnerModel: text("winner_model"),
  status: text("status", { enum: ["running", "completed", "error"] }).notNull().default("running"),
});

// Players in each game
export const gamePlayers = sqliteTable("game_players", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gameId: text("game_id").notNull().references(() => games.id),
  playerIndex: integer("player_index").notNull(),
  model: text("model").notNull(),
  finalCoins: integer("final_coins"),
  survived: integer("survived", { mode: "boolean" }),
  revealedCards: text("revealed_cards"), // JSON array
});

// Turn-by-turn game state for replay
export const gameTurns = sqliteTable("game_turns", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gameId: text("game_id").notNull().references(() => games.id),
  turnNumber: integer("turn_number").notNull(),
  playerIndex: integer("player_index").notNull(),
  model: text("model").notNull(),
  action: text("action").notNull(),
  targetIndex: integer("target_index"),
  challenged: integer("challenged", { mode: "boolean" }).notNull().default(false),
  blocked: integer("blocked", { mode: "boolean" }).notNull().default(false),
  success: integer("success", { mode: "boolean" }).notNull().default(true),
  events: text("events").notNull(), // JSON array
  gameStateBefore: text("game_state_before").notNull(), // JSON
  gameStateAfter: text("game_state_after").notNull(), // JSON
});

// LLM prompts and responses for each decision
export const llmInteractions = sqliteTable("llm_interactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gameId: text("game_id").notNull().references(() => games.id),
  turnNumber: integer("turn_number").notNull(),
  model: text("model").notNull(),
  interactionType: text("interaction_type", { 
    enum: ["action", "challenge", "block", "card_loss", "exchange"] 
  }).notNull(),
  prompt: text("prompt").notNull(),
  response: text("response").notNull(),
  parsedResult: text("parsed_result"), // JSON
  wasRetry: integer("was_retry", { mode: "boolean" }).notNull().default(false),
  timestamp: integer("timestamp", { mode: "timestamp" }).notNull(),
});

// Analytics summary for each game
export const gameAnalytics = sqliteTable("game_analytics", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  gameId: text("game_id").notNull().references(() => games.id).unique(),
  bluffStats: text("bluff_stats").notNull(), // JSON
  challengeStats: text("challenge_stats").notNull(), // JSON
  blockStats: text("block_stats").notNull(), // JSON
  invalidActionStats: text("invalid_action_stats").notNull(), // JSON
  actionCounts: text("action_counts").notNull(), // JSON
});

// Types for the tables
export type Game = typeof games.$inferSelect;
export type NewGame = typeof games.$inferInsert;
export type GamePlayer = typeof gamePlayers.$inferSelect;
export type GameTurn = typeof gameTurns.$inferSelect;
export type LLMInteraction = typeof llmInteractions.$inferSelect;
export type GameAnalytics = typeof gameAnalytics.$inferSelect;

