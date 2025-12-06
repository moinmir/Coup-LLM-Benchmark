/**
 * Coup Game Engine - Core game mechanics with strict validation
 * 
 * This engine enforces all Coup rules and prevents any cheating:
 * - Validates all actions before execution
 * - Tracks hidden state separately from public state
 * - Logs all events for auditing
 */

import {
  type Action,
  ActionType,
  type ActionResult,
  Character,
  type GameEvent,
  type GameState,
  type GameSummary,
  type Player,
  type PlayerConfig,
  type PublicGameState,
  type PublicPlayerState,
  type PrivatePlayerState,
  type ValidAction,
} from "./types";
import {
  CHARACTER_ACTIONS,
  ACTION_BLOCKERS,
  CHALLENGEABLE_ACTIONS,
  GAME_CONFIG,
} from "./constants";

export class CoupGame {
  private players: Player[] = [];
  private deck: Character[] = [];
  private currentPlayerIndex = 0;
  private gameOver = false;
  private winner: number | null = null;
  private turnNumber = 0;
  private eventLog: GameEvent[] = [];

  constructor(playerConfigs: PlayerConfig[]) {
    this.validatePlayerCount(playerConfigs.length);
    this.setupGame(playerConfigs);
  }

  private validatePlayerCount(count: number): void {
    if (count < GAME_CONFIG.MIN_PLAYERS || count > GAME_CONFIG.MAX_PLAYERS) {
      throw new Error(
        `Invalid player count: ${count}. Must be between ${GAME_CONFIG.MIN_PLAYERS} and ${GAME_CONFIG.MAX_PLAYERS}.`
      );
    }
  }

  private setupGame(playerConfigs: PlayerConfig[]): void {
    this.deck = [];
    for (const char of Object.values(Character)) {
      for (let _ = 0; _ < GAME_CONFIG.CARDS_PER_CHARACTER; _++) {
        this.deck.push(char);
      }
    }
    this.shuffleDeck();

    for (const config of playerConfigs) {
      const cards: Character[] = [];
      for (let j = 0; j < GAME_CONFIG.STARTING_CARDS; j++) {
        const card = this.deck.pop();
        if (card) cards.push(card);
      }

      this.players.push({
        name: config.name,
        model: config.model,
        coins: GAME_CONFIG.STARTING_COINS,
        cards,
        revealedCards: [],
      });
    }

    this.logEvent("game_start", -1, `Game started with ${this.players.length} players`);
  }

  private shuffleDeck(): void {
    for (let i = this.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.deck[i], this.deck[j]] = [this.deck[j]!, this.deck[i]!];
    }
  }

  private logEvent(
    eventType: string,
    playerIndex: number,
    description: string,
    details: Record<string, unknown> = {}
  ): GameEvent {
    const event: GameEvent = {
      eventType,
      playerIndex,
      description,
      details,
      timestamp: Date.now(),
    };
    this.eventLog.push(event);
    return event;
  }

  /** Get full game state (for internal use / truth view) */
  getFullGameState(): GameState {
    return {
      turnNumber: this.turnNumber,
      currentPlayerIndex: this.currentPlayerIndex,
      gameOver: this.gameOver,
      winner: this.winner,
      players: this.players.map((p) => ({ ...p, cards: [...p.cards], revealedCards: [...p.revealedCards] })),
      deckSize: this.deck.length,
      recentEvents: this.eventLog.slice(-10).map((e) => e.description),
    };
  }

  /** Get public game state (what all players can see) */
  getPublicGameState(forPlayerIndex?: number): PublicGameState {
    return {
      turnNumber: this.turnNumber,
      currentPlayerIndex: this.currentPlayerIndex,
      gameOver: this.gameOver,
      winner: this.winner,
      players: this.players.map((player, i): PublicPlayerState | PrivatePlayerState => {
        const isAlive = player.cards.length > 0;
        const base: PublicPlayerState = {
          index: i,
          name: player.name,
          model: player.model,
          coins: player.coins,
          influenceCount: player.cards.length,
          revealedCards: [...player.revealedCards],
          isAlive,
        };

        // If this is the player's own view, include their cards
        if (forPlayerIndex !== undefined && i === forPlayerIndex) {
          return {
            ...base,
            cards: [...player.cards],
          } as PrivatePlayerState;
        }

        return base;
      }),
      deckSize: this.deck.length,
      recentEvents: this.eventLog.slice(-10).map((e) => e.description),
    };
  }

  /** Get valid actions for a player */
  getValidActions(playerIndex: number): ValidAction[] {
    const player = this.players[playerIndex];
    if (!player) return [];

    const actions: ValidAction[] = [];
    const aliveOpponents = this.players
      .map((p, i) => ({ player: p, index: i }))
      .filter((p) => p.player.cards.length > 0 && p.index !== playerIndex);

    // Must coup with 10+ coins
    if (player.coins >= GAME_CONFIG.MANDATORY_COUP_THRESHOLD) {
      for (const opponent of aliveOpponents) {
        actions.push({
          actionType: ActionType.COUP,
          targetIndex: opponent.index,
          description: `Coup ${opponent.player.name} - MANDATORY with 10+ coins`,
        });
      }
      return actions;
    }

    // Income (always available)
    actions.push({
      actionType: ActionType.INCOME,
      targetIndex: null,
      description: "Income: Take 1 coin (cannot be blocked or challenged)",
    });

    // Foreign Aid
    actions.push({
      actionType: ActionType.FOREIGN_AID,
      targetIndex: null,
      description: "Foreign Aid: Take 2 coins (can be blocked by Duke)",
    });

    // Coup (if 7+ coins)
    if (player.coins >= GAME_CONFIG.COUP_COST) {
      for (const opponent of aliveOpponents) {
        actions.push({
          actionType: ActionType.COUP,
          targetIndex: opponent.index,
          description: `Coup ${opponent.player.name}: Pay 7 coins, target loses influence`,
        });
      }
    }

    // Tax (Duke)
    actions.push({
      actionType: ActionType.TAX,
      targetIndex: null,
      description: "Tax (Duke): Take 3 coins (can be challenged)",
    });

    // Assassinate (if 3+ coins)
    if (player.coins >= GAME_CONFIG.ASSASSINATE_COST) {
      for (const opponent of aliveOpponents) {
        actions.push({
          actionType: ActionType.ASSASSINATE,
          targetIndex: opponent.index,
          description: `Assassinate ${opponent.player.name}: Pay 3 coins, target loses influence (can be blocked by Contessa)`,
        });
      }
    }

    // Steal (from opponents with coins)
    const opponentsWithCoins = aliveOpponents.filter((o) => o.player.coins > 0);
    for (const opponent of opponentsWithCoins) {
      actions.push({
        actionType: ActionType.STEAL,
        targetIndex: opponent.index,
        description: `Steal from ${opponent.player.name}: Take up to 2 coins (can be blocked by Captain/Ambassador)`,
      });
    }

    // Exchange (Ambassador)
    actions.push({
      actionType: ActionType.EXCHANGE,
      targetIndex: null,
      description: "Exchange (Ambassador): Draw 2 cards, choose which to keep (can be challenged)",
    });

    return actions;
  }

  /** Validate an action before execution */
  validateAction(action: Action): { valid: boolean; error?: string } {
    const player = this.players[action.playerIndex];
    if (!player) {
      return { valid: false, error: "Invalid player index" };
    }

    if (player.cards.length === 0) {
      return { valid: false, error: "Player is eliminated" };
    }

    // Check mandatory coup
    if (player.coins >= GAME_CONFIG.MANDATORY_COUP_THRESHOLD) {
      if (action.actionType !== ActionType.COUP) {
        return { valid: false, error: "Must coup when you have 10+ coins" };
      }
    }

    // Check coup requirements
    if (action.actionType === ActionType.COUP) {
      if (player.coins < GAME_CONFIG.COUP_COST) {
        return { valid: false, error: "Not enough coins to coup (need 7)" };
      }
      if (action.targetIndex === null) {
        return { valid: false, error: "Coup requires a target" };
      }
      const target = this.players[action.targetIndex];
      if (!target || target.cards.length === 0) {
        return { valid: false, error: "Cannot target eliminated player" };
      }
    }

    // Check assassinate requirements
    if (action.actionType === ActionType.ASSASSINATE) {
      if (player.coins < GAME_CONFIG.ASSASSINATE_COST) {
        return { valid: false, error: "Not enough coins to assassinate (need 3)" };
      }
      if (action.targetIndex === null) {
        return { valid: false, error: "Assassinate requires a target" };
      }
      const target = this.players[action.targetIndex];
      if (!target || target.cards.length === 0) {
        return { valid: false, error: "Cannot target eliminated player" };
      }
    }

    // Check steal requirements
    if (action.actionType === ActionType.STEAL) {
      if (action.targetIndex === null) {
        return { valid: false, error: "Steal requires a target" };
      }
      const target = this.players[action.targetIndex];
      if (!target || target.cards.length === 0) {
        return { valid: false, error: "Cannot target eliminated player" };
      }
    }

    return { valid: true };
  }

  /** Check if an action can be challenged */
  canChallengeAction(action: Action): boolean {
    return CHALLENGEABLE_ACTIONS.includes(action.actionType);
  }

  /** Get characters that can block an action */
  getBlockers(action: Action): Character[] {
    return ACTION_BLOCKERS[action.actionType] ?? [];
  }

  /** Execute an action with challenge/block handling */
  executeAction(
    action: Action,
    options: {
      challenged?: boolean;
      challengerIndex?: number;
      blocked?: boolean;
      blockerIndex?: number;
      blockCharacter?: Character;
      blockChallenged?: boolean;
      blockChallengerIndex?: number;
    } = {}
  ): ActionResult {
    const player = this.players[action.playerIndex];
    if (!player) {
      return {
        success: false,
        events: [],
        error: "Invalid player",
      };
    }

    const result: ActionResult = {
      success: true,
      events: [],
    };

    // Validate action first
    const validation = this.validateAction(action);
    if (!validation.valid) {
      result.success = false;
      result.error = validation.error;
      result.events.push(
        this.logEvent("invalid_action", action.playerIndex, `Invalid action: ${validation.error}`)
      );
      return result;
    }

    // Handle Income (cannot be challenged or blocked)
    if (action.actionType === ActionType.INCOME) {
      player.coins += 1;
      result.events.push(
        this.logEvent("action", action.playerIndex, `${player.name} takes Income (+1 coin, now has ${player.coins})`)
      );
      return result;
    }

    // Handle Coup (cannot be challenged or blocked)
    if (action.actionType === ActionType.COUP) {
      player.coins -= GAME_CONFIG.COUP_COST;
      const target = this.players[action.targetIndex!]!;
      result.events.push(
        this.logEvent("action", action.playerIndex, `${player.name} pays 7 coins to Coup ${target.name}`)
      );
      result.needsCardSelection = true;
      result.targetLosesInfluence = action.targetIndex!;
      return result;
    }

    // Handle challenge on the action
    if (options.challenged && options.challengerIndex !== undefined) {
      const requiredChar = CHARACTER_ACTIONS[action.actionType];
      const hasCard = requiredChar && player.cards.includes(requiredChar);

      if (hasCard && requiredChar) {
        // Challenge failed - challenger loses influence
        result.events.push(
          this.logEvent(
            "challenge_failed",
            options.challengerIndex,
            `${this.players[options.challengerIndex]?.name} challenged ${player.name} - FAILED! ${player.name} reveals ${requiredChar}`
          )
        );

        // Player swaps the revealed card
        const cardIndex = player.cards.indexOf(requiredChar);
        player.cards.splice(cardIndex, 1);
        this.deck.push(requiredChar);
        this.shuffleDeck();
        const newCard = this.deck.pop();
        if (newCard) player.cards.push(newCard);

        result.challengerLosesInfluence = options.challengerIndex;
        result.needsCardSelection = true;
      } else {
        // Challenge succeeded - actor was bluffing
        result.events.push(
          this.logEvent(
            "challenge_success",
            options.challengerIndex,
            `${this.players[options.challengerIndex]?.name} challenged ${player.name} - SUCCESS! ${player.name} was bluffing`
          )
        );
        result.success = false;
        result.actorLosesInfluence = action.playerIndex;
        result.needsCardSelection = true;

        // Assassinate costs coins even if challenged successfully
        if (action.actionType === ActionType.ASSASSINATE) {
          player.coins -= GAME_CONFIG.ASSASSINATE_COST;
        }

        return result;
      }
    }

    // Handle block (without block challenge)
    if (options.blocked && options.blockerIndex !== undefined && !options.blockChallenged) {
      result.events.push(
        this.logEvent(
          "block",
          options.blockerIndex,
          `${this.players[options.blockerIndex]?.name} blocks with ${options.blockCharacter}`
        )
      );
      result.success = false;

      if (action.actionType === ActionType.ASSASSINATE) {
        player.coins -= GAME_CONFIG.ASSASSINATE_COST;
      }

      return result;
    }

    // Handle block challenge
    if (options.blockChallenged && options.blockChallengerIndex !== undefined && options.blockerIndex !== undefined) {
      const blocker = this.players[options.blockerIndex];
      if (!blocker) {
        return { success: false, events: [], error: "Invalid blocker" };
      }

      const hasBlockCard = options.blockCharacter && blocker.cards.includes(options.blockCharacter);

      if (hasBlockCard && options.blockCharacter) {
        // Block challenge failed - block is valid
        result.events.push(
          this.logEvent(
            "block_challenge_failed",
            options.blockChallengerIndex,
            `${this.players[options.blockChallengerIndex]?.name} challenged the block - FAILED! ${blocker.name} reveals ${options.blockCharacter}`
          )
        );

        // Blocker swaps the revealed card
        const cardIndex = blocker.cards.indexOf(options.blockCharacter);
        blocker.cards.splice(cardIndex, 1);
        this.deck.push(options.blockCharacter);
        this.shuffleDeck();
        const newCard = this.deck.pop();
        if (newCard) blocker.cards.push(newCard);

        result.blockChallengerLosesInfluence = options.blockChallengerIndex;
        result.needsCardSelection = true;
        result.success = false;

        if (action.actionType === ActionType.ASSASSINATE) {
          player.coins -= GAME_CONFIG.ASSASSINATE_COST;
        }

        return result;
      } else {
        // Block challenge succeeded - blocker was bluffing, action goes through
        result.events.push(
          this.logEvent(
            "block_challenge_success",
            options.blockChallengerIndex,
            `${this.players[options.blockChallengerIndex]?.name} challenged the block - SUCCESS! ${blocker.name} was bluffing`
          )
        );
        result.blockerLosesInfluence = options.blockerIndex;
        result.needsCardSelection = true;
        // Continue to execute the action below
      }
    }

    // Execute the actual action
    switch (action.actionType) {
      case ActionType.FOREIGN_AID:
        player.coins += 2;
        result.events.push(
          this.logEvent("action", action.playerIndex, `${player.name} takes Foreign Aid (+2 coins, now has ${player.coins})`)
        );
        break;

      case ActionType.TAX:
        player.coins += 3;
        result.events.push(
          this.logEvent("action", action.playerIndex, `${player.name} uses Tax (Duke) (+3 coins, now has ${player.coins})`)
        );
        break;

      case ActionType.ASSASSINATE: {
        player.coins -= GAME_CONFIG.ASSASSINATE_COST;
        const target = this.players[action.targetIndex!]!;
        result.events.push(
          this.logEvent("action", action.playerIndex, `${player.name} pays 3 coins to Assassinate ${target.name}`)
        );
        result.needsCardSelection = true;
        result.targetLosesInfluence = action.targetIndex!;
        break;
      }

      case ActionType.STEAL: {
        const target = this.players[action.targetIndex!]!;
        const stealAmount = Math.min(GAME_CONFIG.MAX_STEAL_AMOUNT, target.coins);
        target.coins -= stealAmount;
        player.coins += stealAmount;
        result.events.push(
          this.logEvent(
            "action",
            action.playerIndex,
            `${player.name} steals ${stealAmount} coins from ${target.name} (now has ${player.coins})`
          )
        );
        break;
      }

      case ActionType.EXCHANGE: {
        const drawCount = Math.min(GAME_CONFIG.EXCHANGE_DRAW_COUNT, this.deck.length);
        const drawnCards: Character[] = [];
        for (let i = 0; i < drawCount; i++) {
          const card = this.deck.pop();
          if (card) drawnCards.push(card);
        }
        const originalHandSize = player.cards.length;
        const allCards = [...player.cards, ...drawnCards];
        player.cards = []; // Will be set by exchange selection

        result.events.push(
          this.logEvent("action", action.playerIndex, `${player.name} uses Exchange (Ambassador)`)
        );
        result.needsExchangeSelection = true;
        result.exchangeCards = allCards;
        result.cardsToKeep = originalHandSize;
        break;
      }
    }

    return result;
  }

  /** Apply influence loss to a player */
  applyInfluenceLoss(playerIndex: number, cardIndex = 0): Character | null {
    const player = this.players[playerIndex];
    if (!player || cardIndex >= player.cards.length) return null;

    const card = player.cards.splice(cardIndex, 1)[0]!;
    player.revealedCards.push(card);

    this.logEvent("lose_influence", playerIndex, `${player.name} loses ${card} (revealed)`);
    this.checkGameOver();

    return card;
  }

  /** 
   * Handle the card swap when a challenge fails (player proves they have the card)
   * Player reveals the card, puts it back in deck, deck shuffles, player draws new card
   */
  swapRevealedCard(playerIndex: number, revealedCard: Character): void {
    const player = this.players[playerIndex];
    if (!player) return;

    const cardIndex = player.cards.indexOf(revealedCard);
    if (cardIndex === -1) return;

    // Remove the card from player's hand
    player.cards.splice(cardIndex, 1);
    
    // Put it back in deck
    this.deck.push(revealedCard);
    
    // Shuffle
    this.shuffleDeck();
    
    // Draw a new card
    const newCard = this.deck.pop();
    if (newCard) {
      player.cards.push(newCard);
    }

    this.logEvent(
      "card_swap",
      playerIndex,
      `${player.name} reveals ${revealedCard}, shuffles it back, draws a new card`
    );
  }

  /** Check if a player is still alive */
  isPlayerAlive(playerIndex: number): boolean {
    const player = this.players[playerIndex];
    return player !== undefined && player.cards.length > 0;
  }

  /** Deduct coins from a player */
  deductCoins(playerIndex: number, amount: number): void {
    const player = this.players[playerIndex];
    if (player) {
      player.coins = Math.max(0, player.coins - amount);
    }
  }

  /** Add coins to a player */
  addCoins(playerIndex: number, amount: number): void {
    const player = this.players[playerIndex];
    if (player) {
      player.coins += amount;
    }
  }

  /** Transfer coins from one player to another */
  transferCoins(fromIndex: number, toIndex: number, amount: number): number {
    const from = this.players[fromIndex];
    const to = this.players[toIndex];
    if (!from || !to) return 0;

    const actualAmount = Math.min(amount, from.coins);
    from.coins -= actualAmount;
    to.coins += actualAmount;
    return actualAmount;
  }

  /** Apply exchange card selection */
  applyExchange(playerIndex: number, keptIndices: number[], allCards: Character[]): void {
    const player = this.players[playerIndex];
    if (!player) return;

    const keptCards = keptIndices.map((i) => allCards[i]!);
    const returnedCards = allCards.filter((_, i) => !keptIndices.includes(i));

    player.cards = keptCards;
    this.deck.push(...returnedCards);
    this.shuffleDeck();

    this.logEvent("exchange_complete", playerIndex, `${player.name} completes exchange`);
  }

  /** Check if game is over */
  checkGameOver(): boolean {
    const alivePlayers = this.players.filter((p) => p.cards.length > 0);
    if (alivePlayers.length <= 1) {
      this.gameOver = true;
      const winnerIndex = this.players.findIndex((p) => p.cards.length > 0);
      this.winner = winnerIndex >= 0 ? winnerIndex : null;
      if (this.winner !== null) {
        this.logEvent("game_over", this.winner, `${this.players[this.winner]?.name} wins the game!`);
      }
      return true;
    }
    return false;
  }

  /** Advance to next turn */
  advanceTurn(): void {
    if (this.checkGameOver()) return;

    this.turnNumber++;
    let nextPlayer = (this.currentPlayerIndex + 1) % this.players.length;
    while (this.players[nextPlayer]!.cards.length === 0) {
      nextPlayer = (nextPlayer + 1) % this.players.length;
    }
    this.currentPlayerIndex = nextPlayer;
  }

  /** Get game summary */
  getGameSummary(): GameSummary {
    return {
      totalTurns: this.turnNumber,
      winner: this.winner,
      winnerName: this.winner !== null ? this.players[this.winner]?.name ?? null : null,
      winnerModel: this.winner !== null ? this.players[this.winner]?.model ?? null : null,
      players: this.players.map((p) => ({
        name: p.name,
        model: p.model,
        finalCoins: p.coins,
        survived: p.cards.length > 0,
        revealedCards: [...p.revealedCards],
      })),
      eventCount: this.eventLog.length,
    };
  }

  /** Getters */
  get isGameOver(): boolean {
    return this.gameOver;
  }

  get currentPlayer(): number {
    return this.currentPlayerIndex;
  }

  get turn(): number {
    return this.turnNumber;
  }

  getPlayer(index: number): Player | undefined {
    return this.players[index];
  }

  getPlayerCount(): number {
    return this.players.length;
  }
}

