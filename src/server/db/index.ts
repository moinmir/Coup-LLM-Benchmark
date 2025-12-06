/**
 * Database connection and exports
 */

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Create SQLite database
const sqlite = new Database(path.join(dataDir, "coup.db"));

sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite, { schema });
export * from "./schema";

export function initDatabase() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS games (
      id TEXT PRIMARY KEY,
      started_at INTEGER NOT NULL,
      ended_at INTEGER,
      total_turns INTEGER,
      winner_model TEXT,
      status TEXT NOT NULL DEFAULT 'running'
    );

    CREATE TABLE IF NOT EXISTS game_players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id TEXT NOT NULL REFERENCES games(id),
      player_index INTEGER NOT NULL,
      model TEXT NOT NULL,
      final_coins INTEGER,
      survived INTEGER,
      revealed_cards TEXT
    );

    CREATE TABLE IF NOT EXISTS game_turns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id TEXT NOT NULL REFERENCES games(id),
      turn_number INTEGER NOT NULL,
      player_index INTEGER NOT NULL,
      model TEXT NOT NULL,
      action TEXT NOT NULL,
      target_index INTEGER,
      challenged INTEGER NOT NULL DEFAULT 0,
      blocked INTEGER NOT NULL DEFAULT 0,
      success INTEGER NOT NULL DEFAULT 1,
      events TEXT NOT NULL,
      game_state_before TEXT NOT NULL,
      game_state_after TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS llm_interactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id TEXT NOT NULL REFERENCES games(id),
      turn_number INTEGER NOT NULL,
      model TEXT NOT NULL,
      interaction_type TEXT NOT NULL,
      prompt TEXT NOT NULL,
      response TEXT NOT NULL,
      parsed_result TEXT,
      was_retry INTEGER NOT NULL DEFAULT 0,
      timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS game_analytics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id TEXT NOT NULL REFERENCES games(id) UNIQUE,
      bluff_stats TEXT NOT NULL,
      challenge_stats TEXT NOT NULL,
      block_stats TEXT NOT NULL,
      invalid_action_stats TEXT NOT NULL,
      action_counts TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_game_turns_game_id ON game_turns(game_id);
    CREATE INDEX IF NOT EXISTS idx_llm_interactions_game_id ON llm_interactions(game_id);
    CREATE INDEX IF NOT EXISTS idx_game_players_game_id ON game_players(game_id);
  `);
}

initDatabase();


