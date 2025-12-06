/**
 * Game Runner - Orchestrates game flow between LLM players
 */

import { CoupGame } from "./engine";
import { CHARACTER_ACTIONS, GAME_CONFIG } from "./constants";
import type {
  Action,
  ActionType,
  Character,
  GameAnalytics,
  GameSummary,
  PlayerConfig,
  TurnData,
  TurnResult,
  ValidAction,
} from "./types";
import { LLMPlayer } from "../llm/player";

interface BluffRecord {
  playerIdx: number;
  model: string;
  claimedCharacter: string;
  hadCard: boolean;
  wasChallenged: boolean;
  bluffSuccess: boolean;
}

interface ChallengeRecord {
  challengerIdx: number;
  challengerModel: string;
  targetIdx: number;
  targetModel: string;
  claimedCharacter: string;
  challengeSuccess: boolean;
  isBlockChallenge: boolean;
}

interface BlockRecord {
  blockerIdx: number;
  blockerModel: string;
  blockingCharacter: string;
  againstAction: string;
  hadCard: boolean;
  wasChallenged: boolean;
  blockSuccess: boolean;
}

interface InvalidActionRecord {
  playerIdx: number;
  model: string;
  attemptedAction: string;
  reason: string;
}

export class GameRunner {
  private game: CoupGame;
  private llmPlayers = new Map<number, LLMPlayer>();
  private maxTurns: number;
  private playerConfigs: PlayerConfig[];

  // Analytics tracking
  private bluffAttempts: BluffRecord[] = [];
  private challenges: ChallengeRecord[] = [];
  private blocks: BlockRecord[] = [];
  private invalidActions: InvalidActionRecord[] = [];
  private actionCounts = new Map<string, number>();
  private turnHistory: TurnData[] = [];

  constructor(playerConfigs: PlayerConfig[], maxTurns: number = GAME_CONFIG.DEFAULT_MAX_TURNS) {
    this.game = new CoupGame(playerConfigs);
    this.maxTurns = maxTurns;
    this.playerConfigs = playerConfigs;

    for (let i = 0; i < playerConfigs.length; i++) {
      const config = playerConfigs[i]!;
      this.llmPlayers.set(i, new LLMPlayer(config.model, config.name));
    }
  }

  getGame(): CoupGame {
    return this.game;
  }

  private recordAction(playerIdx: number, model: string, actionType: string): void {
    const key = `${model}|${actionType}`;
    this.actionCounts.set(key, (this.actionCounts.get(key) ?? 0) + 1);
  }

  private recordInvalidAction(
    playerIdx: number,
    model: string,
    attemptedAction: string,
    reason: string
  ): void {
    this.invalidActions.push({ playerIdx, model, attemptedAction, reason });
  }

  private recordBluff(record: BluffRecord): void {
    this.bluffAttempts.push(record);
  }

  private recordChallenge(record: ChallengeRecord): void {
    this.challenges.push(record);
  }

  private recordBlock(record: BlockRecord): void {
    this.blocks.push(record);
  }

  async runTurn(): Promise<TurnResult> {
    if (this.game.isGameOver) {
      return {
        gameOver: true,
        turnEvents: [],
        gameState: this.game.getPublicGameState(),
        gameStateWithTruth: this.game.getFullGameState(),
        summary: this.getGameSummaryWithAnalytics(),
        turnData: this.turnHistory[this.turnHistory.length - 1]!,
      };
    }

    const currentIdx = this.game.currentPlayer;
    const currentPlayer = this.game.getPlayer(currentIdx)!;
    const currentModel = this.playerConfigs[currentIdx]!.model;
    const llmPlayer = this.llmPlayers.get(currentIdx)!;

    const turnEvents: string[] = [];
    const turnData: TurnData = {
      turn: this.game.turn + 1,
      player: currentPlayer.name,
      model: currentModel,
      playerCards: [...currentPlayer.cards],
      action: "income" as ActionType,
      target: null,
      events: [],
      challenged: false,
      blocked: false,
      resultSuccess: true,
    };

    const playerLabel = `P${currentIdx + 1}`;
    turnEvents.push(`Turn ${this.game.turn + 1}: ${playerLabel}'s turn`);

    const gameState = this.game.getPublicGameState(currentIdx);
    const validActions = this.game.getValidActions(currentIdx);

    let chosenAction: ValidAction;
    
    if (currentPlayer.coins >= GAME_CONFIG.MANDATORY_COUP_THRESHOLD) {
      chosenAction = validActions[0]!;
      turnEvents.push("→ Must Coup (10+ coins)");
    } else {
      chosenAction = await llmPlayer.chooseAction(gameState, validActions);
      
      if (!validActions.some((a) => 
        a.actionType === chosenAction.actionType && 
        a.targetIndex === chosenAction.targetIndex
      )) {
        this.recordInvalidAction(
          currentIdx,
          currentModel,
          chosenAction.actionType,
          "Action not in valid actions list"
        );
        chosenAction = validActions[0]!;
      }
    }

    const action: Action = {
      actionType: chosenAction.actionType,
      playerIndex: currentIdx,
      targetIndex: chosenAction.targetIndex,
      claimedCharacter: CHARACTER_ACTIONS[chosenAction.actionType] ?? null,
    };

    const validation = this.game.validateAction(action);
    if (!validation.valid) {
      this.recordInvalidAction(currentIdx, currentModel, action.actionType, validation.error!);
      const fallbackAction = validActions[0]!;
      action.actionType = fallbackAction.actionType;
      action.targetIndex = fallbackAction.targetIndex;
      action.claimedCharacter = CHARACTER_ACTIONS[fallbackAction.actionType] ?? null;
    }

    this.recordAction(currentIdx, currentModel, action.actionType);
    turnData.action = action.actionType;
    turnData.target = action.targetIndex;

    const actionDesc = action.actionType.toUpperCase().replace("_", " ");
    if (action.targetIndex !== null) {
      turnEvents.push(`${playerLabel} → ${actionDesc} → P${action.targetIndex + 1}`);
    } else {
      turnEvents.push(`${playerLabel} → ${actionDesc}`);
    }

    let challenged = false;
    let challengerIndex: number | undefined;

    if (this.game.canChallengeAction(action)) {
      const otherPlayers = this.getShuffledAlivePlayers(currentIdx);
      
      for (const { index: i } of otherPlayers) {
        const opponentLlm = this.llmPlayers.get(i)!;
        const opponentState = this.game.getPublicGameState(i);

        const shouldChallenge = await opponentLlm.decideChallenge(
          opponentState,
          chosenAction.description,
          currentPlayer.name,
          action.claimedCharacter ?? "unknown"
        );

        if (shouldChallenge) {
          challenged = true;
          challengerIndex = i;
          turnEvents.push(
            `⚔️ P${i + 1} challenges ${action.claimedCharacter ?? "action"}`
          );
          break;
        }
      }
    }

    let blocked = false;
    let blockerIndex: number | undefined;
    let blockCharacter: Character | undefined;

    const blockers = this.game.getBlockers(action);
    
    if (blockers.length > 0 && (!challenged || (challenged && action.claimedCharacter && currentPlayer.cards.includes(action.claimedCharacter)))) {
      if (action.targetIndex !== null) {
        const targetPlayer = this.game.getPlayer(action.targetIndex);
        if (targetPlayer && targetPlayer.cards.length > 0) {
          const targetLlm = this.llmPlayers.get(action.targetIndex)!;
          const targetState = this.game.getPublicGameState(action.targetIndex);

          const { shouldBlock, blockCharacter: bc } = await targetLlm.decideBlock(
            targetState,
            chosenAction.description,
            currentPlayer.name,
            blockers
          );

          if (shouldBlock && bc) {
            blocked = true;
            blockerIndex = action.targetIndex;
            blockCharacter = bc;
            turnEvents.push(`🛡️ P${action.targetIndex + 1} blocks with ${bc}`);
          }
        }
      } else if (action.actionType === "foreign_aid") {
        const otherPlayers = this.getShuffledAlivePlayers(currentIdx);
        
        for (const { index: i } of otherPlayers) {
          const opponentLlm = this.llmPlayers.get(i)!;
          const opponentState = this.game.getPublicGameState(i);

          const { shouldBlock, blockCharacter: bc } = await opponentLlm.decideBlock(
            opponentState,
            chosenAction.description,
            currentPlayer.name,
            blockers
          );

          if (shouldBlock && bc) {
            blocked = true;
            blockerIndex = i;
            blockCharacter = bc;
            turnEvents.push(`🛡️ P${i + 1} blocks Foreign Aid with Duke`);
            break;
          }
        }
      }
    }

    let blockChallenged = false;
    let blockChallengerIndex: number | undefined;

    if (blocked && blockCharacter && blockerIndex !== undefined) {
      const otherPlayers = this.getShuffledAlivePlayers(blockerIndex);
      
      for (const { index: i } of otherPlayers) {
        const opponentLlm = this.llmPlayers.get(i)!;
        const opponentState = this.game.getPublicGameState(i);

        const shouldChallenge = await opponentLlm.decideChallenge(
          opponentState,
          `blocking with ${blockCharacter}`,
          this.game.getPlayer(blockerIndex)!.name,
          blockCharacter
        );

        if (shouldChallenge) {
          blockChallenged = true;
          blockChallengerIndex = i;
          turnEvents.push(`⚔️ P${i + 1} challenges the block`);
          break;
        }
      }
    }

    const result = this.game.executeAction(action, {
      challenged,
      challengerIndex,
      blocked,
      blockerIndex,
      blockCharacter,
      blockChallenged,
      blockChallengerIndex,
    });

    for (const event of result.events) {
      if (!turnEvents.some((e) => e.includes(event.description))) {
        turnEvents.push(event.description);
      }
    }

    const influenceLosses = [
      { key: "challengerLosesInfluence", idx: result.challengerLosesInfluence },
      { key: "actorLosesInfluence", idx: result.actorLosesInfluence },
      { key: "blockerLosesInfluence", idx: result.blockerLosesInfluence },
      { key: "blockChallengerLosesInfluence", idx: result.blockChallengerLosesInfluence },
    ];

    for (const { idx } of influenceLosses) {
      if (idx !== undefined) {
        const loser = this.game.getPlayer(idx);
        if (loser && loser.cards.length > 0) {
          const loserLlm = this.llmPlayers.get(idx)!;
          const cardIdx = await loserLlm.chooseCardToLose(
            this.game.getPublicGameState(idx),
            loser.cards
          );
          const lostCard = this.game.applyInfluenceLoss(idx, cardIdx);
          if (lostCard) {
            turnEvents.push(`💀 P${idx + 1} loses ${lostCard}`);
          }
        }
      }
    }

    if (result.targetLosesInfluence !== undefined && result.success) {
      const loser = this.game.getPlayer(result.targetLosesInfluence);
      if (loser && loser.cards.length > 0) {
        const loserLlm = this.llmPlayers.get(result.targetLosesInfluence)!;
        const cardIdx = await loserLlm.chooseCardToLose(
          this.game.getPublicGameState(result.targetLosesInfluence),
          loser.cards
        );
        const lostCard = this.game.applyInfluenceLoss(result.targetLosesInfluence, cardIdx);
        if (lostCard) {
          turnEvents.push(`💀 P${result.targetLosesInfluence + 1} loses ${lostCard}`);
        }
      }
    }

    if (result.needsExchangeSelection && result.exchangeCards && result.cardsToKeep !== undefined) {
      const keptIndices = await llmPlayer.chooseExchangeCards(
        this.game.getPublicGameState(currentIdx),
        result.exchangeCards,
        result.cardsToKeep
      );
      this.game.applyExchange(currentIdx, keptIndices, result.exchangeCards);
      turnEvents.push(`🔄 P${currentIdx + 1} completes exchange`);
    }

    if (action.claimedCharacter && this.game.canChallengeAction(action)) {
      const hadCard = currentPlayer.cards.includes(action.claimedCharacter);
      const wasBluff = !hadCard;
      
      if (wasBluff) {
        const bluffSuccess = !challenged;
        
        this.recordBluff({
          playerIdx: currentIdx,
          model: currentModel,
          claimedCharacter: action.claimedCharacter,
          hadCard: false,
          wasChallenged: challenged,
          bluffSuccess,
        });
      }
    }

    if (challenged && challengerIndex !== undefined) {
      const challengeSuccess = result.actorLosesInfluence !== undefined;
      this.recordChallenge({
        challengerIdx: challengerIndex,
        challengerModel: this.playerConfigs[challengerIndex]!.model,
        targetIdx: currentIdx,
        targetModel: currentModel,
        claimedCharacter: action.claimedCharacter ?? "unknown",
        challengeSuccess,
        isBlockChallenge: false,
      });
    }

    if (blocked && blockerIndex !== undefined && blockCharacter) {
      const blockerPlayer = this.game.getPlayer(blockerIndex)!;
      const hadBlockCard = blockerPlayer.cards.includes(blockCharacter);
      const blockSuccess = !blockChallenged || (blockChallenged && hadBlockCard);

      this.recordBlock({
        blockerIdx: blockerIndex,
        blockerModel: this.playerConfigs[blockerIndex]!.model,
        blockingCharacter: blockCharacter,
        againstAction: action.actionType,
        hadCard: hadBlockCard,
        wasChallenged: blockChallenged,
        blockSuccess,
      });
    }

    if (blockChallenged && blockChallengerIndex !== undefined && blockCharacter) {
      const blockChallengeSuccess = result.blockerLosesInfluence !== undefined;
      this.recordChallenge({
        challengerIdx: blockChallengerIndex,
        challengerModel: this.playerConfigs[blockChallengerIndex]!.model,
        targetIdx: blockerIndex!,
        targetModel: this.playerConfigs[blockerIndex!]!.model,
        claimedCharacter: blockCharacter,
        challengeSuccess: blockChallengeSuccess,
        isBlockChallenge: true,
      });
    }

    turnEvents.push(result.success ? "✓ Action successful" : "✗ Action failed");

    turnData.events = turnEvents;
    turnData.challenged = challenged;
    turnData.blocked = blocked;
    turnData.resultSuccess = result.success;
    this.turnHistory.push(turnData);

    this.game.advanceTurn();

    return {
      gameOver: this.game.isGameOver,
      turnEvents,
      gameState: this.game.getPublicGameState(),
      gameStateWithTruth: this.game.getFullGameState(),
      summary: this.game.isGameOver ? this.getGameSummaryWithAnalytics() : null,
      turnData,
    };
  }

  private getShuffledAlivePlayers(excludeIndex: number) {
    const players = [];
    for (let i = 0; i < this.game.getPlayerCount(); i++) {
      const player = this.game.getPlayer(i);
      if (player && i !== excludeIndex && player.cards.length > 0) {
        players.push({ index: i, player });
      }
    }
    for (let i = players.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [players[i], players[j]] = [players[j]!, players[i]!];
    }
    return players;
  }

  getGameSummaryWithAnalytics(): GameSummary {
    const summary = this.game.getGameSummary();
    summary.analytics = this.getAnalytics();
    return summary;
  }

  private getAnalytics(): GameAnalytics {
    const bluffStats: Record<string, { total: number; successful: number; caught: number }> = {};
    for (const bluff of this.bluffAttempts) {
      const stats = bluffStats[bluff.model] ?? { total: 0, successful: 0, caught: 0 };
      stats.total++;
      if (bluff.bluffSuccess) {
        stats.successful++; // Not challenged, got away with bluff
      } else {
        stats.caught++; // Was challenged while bluffing
      }
      bluffStats[bluff.model] = stats;
    }

    const challengeStats: Record<string, { total: number; successful: number }> = {};
    for (const challenge of this.challenges) {
      const stats = challengeStats[challenge.challengerModel] ?? { total: 0, successful: 0 };
      stats.total++;
      if (challenge.challengeSuccess) stats.successful++;
      challengeStats[challenge.challengerModel] = stats;
    }

    const blockStats: Record<string, { total: number; successful: number; bluffs: number }> = {};
    for (const block of this.blocks) {
      const stats = blockStats[block.blockerModel] ?? { total: 0, successful: 0, bluffs: 0 };
      stats.total++;
      if (block.blockSuccess) stats.successful++;
      if (!block.hadCard) stats.bluffs++;
      blockStats[block.blockerModel] = stats;
    }

    const invalidActionStats: Record<string, { total: number; types: string[] }> = {};
    for (const invalid of this.invalidActions) {
      const stats = invalidActionStats[invalid.model] ?? { total: 0, types: [] };
      stats.total++;
      if (!stats.types.includes(invalid.reason)) {
        stats.types.push(invalid.reason);
      }
      invalidActionStats[invalid.model] = stats;
    }
    
    // Also collect invalid LLM responses from each player
    for (let i = 0; i < this.playerConfigs.length; i++) {
      const config = this.playerConfigs[i]!;
      const llmPlayer = this.llmPlayers.get(i);
      if (llmPlayer) {
        const invalidResponses = llmPlayer.getInvalidResponses();
        for (const invalid of invalidResponses) {
          const stats = invalidActionStats[config.model] ?? { total: 0, types: [] };
          stats.total++;
          const typeKey = `LLM parse error: ${invalid.type}`;
          if (!stats.types.includes(typeKey)) {
            stats.types.push(typeKey);
          }
          invalidActionStats[config.model] = stats;
        }
      }
    }

    // Convert action counts
    const actionCounts: Record<string, number> = {};
    for (const [key, count] of this.actionCounts) {
      actionCounts[key] = count;
    }

    return {
      bluffStats,
      challengeStats,
      blockStats,
      invalidActionStats,
      actionCounts,
      totalTurns: this.turnHistory.length,
    };
  }

  async runFullGame(
    onTurnComplete?: (result: TurnResult) => void | Promise<void>
  ): Promise<GameSummary> {
    while (!this.game.isGameOver && this.game.turn < this.maxTurns) {
      const result = await this.runTurn();
      if (onTurnComplete) {
        await onTurnComplete(result);
      }
      if (result.gameOver) break;
    }

    return this.getGameSummaryWithAnalytics();
  }

  getTurnHistory(): TurnData[] {
    return [...this.turnHistory];
  }
}

