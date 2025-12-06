/**
 * Core game types for Coup LLM Benchmark
 * These types enforce the game rules at the type level
 */

export const Character = {
  DUKE: "Duke",
  ASSASSIN: "Assassin",
  CAPTAIN: "Captain",
  AMBASSADOR: "Ambassador",
  CONTESSA: "Contessa",
} as const;

export type Character = (typeof Character)[keyof typeof Character];

export const ActionType = {
  INCOME: "income",
  FOREIGN_AID: "foreign_aid",
  COUP: "coup",
  TAX: "tax",
  ASSASSINATE: "assassinate",
  STEAL: "steal",
  EXCHANGE: "exchange",
} as const;

export type ActionType = (typeof ActionType)[keyof typeof ActionType];

export interface Action {
  actionType: ActionType;
  playerIndex: number;
  targetIndex: number | null;
  claimedCharacter: Character | null;
}

export interface Player {
  name: string;
  model: string;
  coins: number;
  cards: Character[];
  revealedCards: Character[];
}

export interface GameEvent {
  eventType: string;
  playerIndex: number;
  description: string;
  details: Record<string, unknown>;
  timestamp: number;
}

export interface GameState {
  turnNumber: number;
  currentPlayerIndex: number;
  gameOver: boolean;
  winner: number | null;
  players: Player[];
  deckSize: number;
  recentEvents: string[];
}

export interface PublicPlayerState {
  index: number;
  name: string;
  model: string;
  coins: number;
  influenceCount: number;
  revealedCards: Character[];
  isAlive: boolean;
}

export interface PrivatePlayerState extends PublicPlayerState {
  cards: Character[];
}

export interface PublicGameState {
  turnNumber: number;
  currentPlayerIndex: number;
  gameOver: boolean;
  winner: number | null;
  players: (PublicPlayerState | PrivatePlayerState)[];
  deckSize: number;
  recentEvents: string[];
}

export interface ValidAction {
  actionType: ActionType;
  targetIndex: number | null;
  description: string;
}

export interface ActionResult {
  success: boolean;
  events: GameEvent[];
  error?: string;
  needsCardSelection?: boolean;
  targetLosesInfluence?: number;
  challengerLosesInfluence?: number;
  actorLosesInfluence?: number;
  blockerLosesInfluence?: number;
  blockChallengerLosesInfluence?: number;
  needsExchangeSelection?: boolean;
  exchangeCards?: Character[];
  cardsToKeep?: number;
}

export interface TurnResult {
  gameOver: boolean;
  turnEvents: string[];
  gameState: PublicGameState;
  gameStateWithTruth: GameState;
  summary: GameSummary | null;
  turnData: TurnData;
}

export interface TurnData {
  turn: number;
  player: string;
  model: string;
  playerCards: Character[];
  action: ActionType;
  target: number | null;
  events: string[];
  challenged: boolean;
  blocked: boolean;
  resultSuccess: boolean;
}

export interface GameSummary {
  totalTurns: number;
  winner: number | null;
  winnerName: string | null;
  winnerModel: string | null;
  players: PlayerSummary[];
  eventCount: number;
  analytics?: GameAnalytics;
}

export interface PlayerSummary {
  name: string;
  model: string;
  finalCoins: number;
  survived: boolean;
  revealedCards: Character[];
}

export interface GameAnalytics {
  bluffStats: Record<string, BluffStats>;
  challengeStats: Record<string, ChallengeStats>;
  blockStats: Record<string, BlockStats>;
  invalidActionStats: Record<string, InvalidActionStats>;
  actionCounts: Record<string, number>;
  totalTurns: number;
}

export interface BluffStats {
  total: number;
  successful: number;
  caught: number;
}

export interface ChallengeStats {
  total: number;
  successful: number;
}

export interface BlockStats {
  total: number;
  successful: number;
  bluffs: number;
}

export interface InvalidActionStats {
  total: number;
  types: string[];
}

export interface PlayerConfig {
  model: string;
  name: string;
}


