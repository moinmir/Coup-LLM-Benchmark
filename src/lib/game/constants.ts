/**
 * Game constants and rules mappings
 */

import { ActionType, Character } from "./types";

/** Maps actions to the character required to perform them */
export const CHARACTER_ACTIONS: Partial<Record<ActionType, Character>> = {
  [ActionType.TAX]: Character.DUKE,
  [ActionType.ASSASSINATE]: Character.ASSASSIN,
  [ActionType.STEAL]: Character.CAPTAIN,
  [ActionType.EXCHANGE]: Character.AMBASSADOR,
};

/** Maps actions to characters that can block them */
export const ACTION_BLOCKERS: Partial<Record<ActionType, Character[]>> = {
  [ActionType.FOREIGN_AID]: [Character.DUKE],
  [ActionType.ASSASSINATE]: [Character.CONTESSA],
  [ActionType.STEAL]: [Character.CAPTAIN, Character.AMBASSADOR],
};

/** Actions that can be challenged */
export const CHALLENGEABLE_ACTIONS: ActionType[] = [
  ActionType.TAX,
  ActionType.ASSASSINATE,
  ActionType.STEAL,
  ActionType.EXCHANGE,
];

/** Available models for OpenRouter */
export const AVAILABLE_MODELS = [
  "meta-llama/llama-3.3-70b-instruct",
  "meta-llama/llama-3.1-8b-instruct",
  "mistralai/mistral-small-3.1-24b-instruct",
  "qwen/qwen-2.5-72b-instruct",
  "qwen/qwen-2.5-7b-instruct",
  "deepseek/deepseek-chat-v3-0324",
  "google/gemini-2.0-flash-001",
  "microsoft/phi-4",
] as const;

export type AvailableModel = (typeof AVAILABLE_MODELS)[number];

/** Game configuration limits */
export const GAME_CONFIG = {
  MIN_PLAYERS: 3,
  MAX_PLAYERS: 6,
  STARTING_COINS: 2,
  STARTING_CARDS: 2,
  CARDS_PER_CHARACTER: 3,
  COUP_COST: 7,
  ASSASSINATE_COST: 3,
  MANDATORY_COUP_THRESHOLD: 10,
  MAX_STEAL_AMOUNT: 2,
  EXCHANGE_DRAW_COUNT: 2,
  DEFAULT_MAX_TURNS: 100,
} as const;


