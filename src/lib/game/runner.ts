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

    // ============================================
    // PHASE 1: Challenge opportunity on the action
    // ============================================
    let challenged = false;
    let challengerIndex: number | undefined;
    let challengeSucceeded = false; // True if the challenger caught a bluff

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

    // ============================================
    // PHASE 2: Resolve challenge IMMEDIATELY if it happened
    // ============================================
    if (challenged && challengerIndex !== undefined) {
      const requiredChar = CHARACTER_ACTIONS[action.actionType];
      const actorHasCard = requiredChar && currentPlayer.cards.includes(requiredChar);

      if (actorHasCard && requiredChar) {
        // Challenge FAILED - actor had the card, challenger loses influence
        turnEvents.push(
          `Challenge failed! ${currentPlayer.name} reveals ${requiredChar}`
        );
        
        // Actor swaps the revealed card back into deck and draws new one
        this.game.swapRevealedCard(currentIdx, requiredChar);
        
        // Challenger loses a card
        const challenger = this.game.getPlayer(challengerIndex);
        if (challenger && challenger.cards.length > 0) {
          const challengerLlm = this.llmPlayers.get(challengerIndex)!;
          const cardIdx = await challengerLlm.chooseCardToLose(
            this.game.getPublicGameState(challengerIndex),
            challenger.cards
          );
          const lostCard = this.game.applyInfluenceLoss(challengerIndex, cardIdx);
          if (lostCard) {
            turnEvents.push(`💀 P${challengerIndex + 1} loses ${lostCard}`);
          }
        }
        
        // Record challenge analytics
        this.recordChallenge({
          challengerIdx: challengerIndex,
          challengerModel: this.playerConfigs[challengerIndex]!.model,
          targetIdx: currentIdx,
          targetModel: currentModel,
          claimedCharacter: action.claimedCharacter ?? "unknown",
          challengeSuccess: false,
          isBlockChallenge: false,
        });
        
        challengeSucceeded = false;
      } else {
        // Challenge SUCCEEDED - actor was bluffing, actor loses influence
        turnEvents.push(
          `Challenge succeeded! ${currentPlayer.name} was bluffing`
        );
        challengeSucceeded = true;
        
        // Actor loses a card
        if (currentPlayer.cards.length > 0) {
          const actorLlm = this.llmPlayers.get(currentIdx)!;
          const cardIdx = await actorLlm.chooseCardToLose(
            this.game.getPublicGameState(currentIdx),
            currentPlayer.cards
          );
          const lostCard = this.game.applyInfluenceLoss(currentIdx, cardIdx);
          if (lostCard) {
            turnEvents.push(`💀 P${currentIdx + 1} loses ${lostCard}`);
          }
        }
        
        // Assassinate costs coins even if challenged successfully
        if (action.actionType === "assassinate") {
          this.game.deductCoins(currentIdx, GAME_CONFIG.ASSASSINATE_COST);
          turnEvents.push(`${currentPlayer.name} still pays 3 coins for failed assassination`);
        }
        
        // Record challenge analytics
        this.recordChallenge({
          challengerIdx: challengerIndex,
          challengerModel: this.playerConfigs[challengerIndex]!.model,
          targetIdx: currentIdx,
          targetModel: currentModel,
          claimedCharacter: action.claimedCharacter ?? "unknown",
          challengeSuccess: true,
          isBlockChallenge: false,
        });
        
        // Action fails - skip to end of turn
        turnData.events = turnEvents;
        turnData.challenged = true;
        turnData.blocked = false;
        turnData.resultSuccess = false;
        this.turnHistory.push(turnData);
        
        turnEvents.push("✗ Action failed (caught bluffing)");
        
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
    }

    // ============================================
    // PHASE 3: Block opportunity (only if action wasn't stopped by challenge)
    // ============================================
    let blocked = false;
    let blockerIndex: number | undefined;
    let blockCharacter: Character | undefined;

    const blockers = this.game.getBlockers(action);
    
    // Only offer block if there are valid blockers and action is proceeding
    if (blockers.length > 0) {
      if (action.targetIndex !== null) {
        // Targeted action - only target can block
        const targetPlayer = this.game.getPlayer(action.targetIndex);
        // Check if target is still alive (may have been eliminated if they challenged and lost)
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
        // Foreign Aid - any player with Duke can block
        const otherPlayers = this.getShuffledAlivePlayers(currentIdx);
        
        for (const { index: i } of otherPlayers) {
          const player = this.game.getPlayer(i);
          if (!player || player.cards.length === 0) continue; // Skip eliminated players
          
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

    // ============================================
    // PHASE 4: Challenge opportunity on the block
    // ============================================
    let blockChallenged = false;
    let blockChallengerIndex: number | undefined;
    let blockChallengeSucceeded = false;

    if (blocked && blockCharacter && blockerIndex !== undefined) {
      const otherPlayers = this.getShuffledAlivePlayers(blockerIndex);
      
      for (const { index: i } of otherPlayers) {
        const player = this.game.getPlayer(i);
        if (!player || player.cards.length === 0) continue; // Skip eliminated players
        
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

    // ============================================
    // PHASE 5: Resolve block challenge if it happened
    // ============================================
    if (blockChallenged && blockChallengerIndex !== undefined && blockerIndex !== undefined) {
      const blocker = this.game.getPlayer(blockerIndex)!;
      const blockerHasCard = blockCharacter && blocker.cards.includes(blockCharacter);

      if (blockerHasCard && blockCharacter) {
        // Block challenge FAILED - blocker had the card, block stands
        turnEvents.push(
          `Block challenge failed! ${blocker.name} reveals ${blockCharacter}`
        );
        
        // Blocker swaps the revealed card
        this.game.swapRevealedCard(blockerIndex, blockCharacter);
        
        // Block challenger loses a card
        const blockChallenger = this.game.getPlayer(blockChallengerIndex);
        if (blockChallenger && blockChallenger.cards.length > 0) {
          const challengerLlm = this.llmPlayers.get(blockChallengerIndex)!;
          const cardIdx = await challengerLlm.chooseCardToLose(
            this.game.getPublicGameState(blockChallengerIndex),
            blockChallenger.cards
          );
          const lostCard = this.game.applyInfluenceLoss(blockChallengerIndex, cardIdx);
          if (lostCard) {
            turnEvents.push(`💀 P${blockChallengerIndex + 1} loses ${lostCard}`);
          }
        }
        
        // Record block challenge analytics
        this.recordChallenge({
          challengerIdx: blockChallengerIndex,
          challengerModel: this.playerConfigs[blockChallengerIndex]!.model,
          targetIdx: blockerIndex,
          targetModel: this.playerConfigs[blockerIndex]!.model,
          claimedCharacter: blockCharacter,
          challengeSuccess: false,
          isBlockChallenge: true,
        });
        
        blockChallengeSucceeded = false;
        // Block remains valid, action fails
      } else {
        // Block challenge SUCCEEDED - blocker was bluffing
        turnEvents.push(
          `Block challenge succeeded! ${blocker.name} was bluffing`
        );
        blockChallengeSucceeded = true;
        
        // Blocker loses a card
        if (blocker.cards.length > 0) {
          const blockerLlm = this.llmPlayers.get(blockerIndex)!;
          const cardIdx = await blockerLlm.chooseCardToLose(
            this.game.getPublicGameState(blockerIndex),
            blocker.cards
          );
          const lostCard = this.game.applyInfluenceLoss(blockerIndex, cardIdx);
          if (lostCard) {
            turnEvents.push(`💀 P${blockerIndex + 1} loses ${lostCard}`);
          }
        }
        
        // Record block challenge analytics
        this.recordChallenge({
          challengerIdx: blockChallengerIndex,
          challengerModel: this.playerConfigs[blockChallengerIndex]!.model,
          targetIdx: blockerIndex,
          targetModel: this.playerConfigs[blockerIndex]!.model,
          claimedCharacter: blockCharacter,
          challengeSuccess: true,
          isBlockChallenge: true,
        });
        
        // Block fails, action will proceed
        blocked = false;
      }
    }

    // ============================================
    // PHASE 6: Execute the action (if not blocked)
    // ============================================
    let actionSuccess = true;
    
    // Record block analytics
    if (blockerIndex !== undefined && blockCharacter) {
      const blockerPlayer = this.game.getPlayer(blockerIndex);
      const hadBlockCard = blockerPlayer ? blockerPlayer.cards.includes(blockCharacter) : false;
      const blockSuccess = blocked && (!blockChallenged || !blockChallengeSucceeded);

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
    
    if (blocked && !blockChallengeSucceeded) {
      // Block succeeded - action fails
      actionSuccess = false;
      turnEvents.push("✗ Action blocked");
      
      // Assassinate costs coins even if blocked
      if (action.actionType === "assassinate") {
        this.game.deductCoins(currentIdx, GAME_CONFIG.ASSASSINATE_COST);
      }
    } else {
      // Execute the action
      switch (action.actionType) {
        case "income":
          this.game.addCoins(currentIdx, 1);
          turnEvents.push(`${currentPlayer.name} takes Income (+1 coin, now has ${this.game.getPlayer(currentIdx)!.coins})`);
          break;

        case "foreign_aid":
          this.game.addCoins(currentIdx, 2);
          turnEvents.push(`${currentPlayer.name} takes Foreign Aid (+2 coins, now has ${this.game.getPlayer(currentIdx)!.coins})`);
          break;

        case "tax":
          this.game.addCoins(currentIdx, 3);
          turnEvents.push(`${currentPlayer.name} uses Tax (+3 coins, now has ${this.game.getPlayer(currentIdx)!.coins})`);
          break;

        case "coup": {
          this.game.deductCoins(currentIdx, GAME_CONFIG.COUP_COST);
          const target = this.game.getPlayer(action.targetIndex!)!;
          turnEvents.push(`${currentPlayer.name} pays 7 coins to Coup ${target.name}`);
          
          // Target loses influence
          if (target.cards.length > 0) {
            const targetLlm = this.llmPlayers.get(action.targetIndex!)!;
            const cardIdx = await targetLlm.chooseCardToLose(
              this.game.getPublicGameState(action.targetIndex!),
              target.cards
            );
            const lostCard = this.game.applyInfluenceLoss(action.targetIndex!, cardIdx);
            if (lostCard) {
              turnEvents.push(`💀 P${action.targetIndex! + 1} loses ${lostCard}`);
            }
          }
          break;
        }

        case "assassinate": {
          this.game.deductCoins(currentIdx, GAME_CONFIG.ASSASSINATE_COST);
          const target = this.game.getPlayer(action.targetIndex!)!;
          turnEvents.push(`${currentPlayer.name} pays 3 coins to Assassinate ${target.name}`);
          
          // Target loses influence (if still alive)
          if (target.cards.length > 0) {
            const targetLlm = this.llmPlayers.get(action.targetIndex!)!;
            const cardIdx = await targetLlm.chooseCardToLose(
              this.game.getPublicGameState(action.targetIndex!),
              target.cards
            );
            const lostCard = this.game.applyInfluenceLoss(action.targetIndex!, cardIdx);
            if (lostCard) {
              turnEvents.push(`💀 P${action.targetIndex! + 1} loses ${lostCard}`);
            }
          }
          break;
        }

        case "steal": {
          const target = this.game.getPlayer(action.targetIndex!)!;
          const stealAmount = this.game.transferCoins(action.targetIndex!, currentIdx, GAME_CONFIG.MAX_STEAL_AMOUNT);
          turnEvents.push(
            `${currentPlayer.name} steals ${stealAmount} coins from ${target.name} (now has ${this.game.getPlayer(currentIdx)!.coins})`
          );
          break;
        }

        case "exchange": {
          // Draw 2 cards, choose which to keep
          const llmPlayer = this.llmPlayers.get(currentIdx)!;
          
          // For exchange, we need to work with the game's internal deck
          // Use a simplified approach - execute via game engine
          const exchangeResult = this.game.executeAction(action, {
            challenged: false,
            blocked: false,
          });
          
          if (exchangeResult.needsExchangeSelection && exchangeResult.exchangeCards && exchangeResult.cardsToKeep !== undefined) {
            const keptIndices = await llmPlayer.chooseExchangeCards(
              this.game.getPublicGameState(currentIdx),
              exchangeResult.exchangeCards,
              exchangeResult.cardsToKeep
            );
            this.game.applyExchange(currentIdx, keptIndices, exchangeResult.exchangeCards);
            turnEvents.push(`🔄 P${currentIdx + 1} completes exchange`);
          }
          break;
        }
      }
      
      turnEvents.push("✓ Action successful");
    }

    // ============================================
    // PHASE 7: Record bluff analytics (if actor claimed a character they don't have)
    // ============================================
    if (action.claimedCharacter && this.game.canChallengeAction(action)) {
      // Check original hand (before any swaps)
      const originalCards = turnData.playerCards;
      const hadCard = originalCards.includes(action.claimedCharacter);
      const wasBluff = !hadCard;
      
      if (wasBluff) {
        const bluffSuccess = !challenged; // Got away with it if not challenged
        
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

    // ============================================
    // Finalize turn data and advance
    // ============================================
    turnData.events = turnEvents;
    turnData.challenged = challenged;
    turnData.blocked = blocked && !blockChallengeSucceeded;
    turnData.resultSuccess = actionSuccess;
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

