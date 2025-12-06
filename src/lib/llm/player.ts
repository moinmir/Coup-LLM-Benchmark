/**
 * LLM Player - Makes decisions using OpenRouter API
 * 
 * Features:
 * - Neutral prompts - LLM decides strategy independently
 * - Retry logic - one retry on parse failure
 * - Invalid response tracking for analytics
 */

import type { Character, PublicGameState, ValidAction } from "../game/types";
import { callOpenRouter } from "./openrouter";
import {
  buildActionPrompt,
  buildChallengePrompt,
  buildBlockPrompt,
  buildCardLossPrompt,
  buildExchangePrompt,
  GAME_RULES_PROMPT,
} from "./prompts";

export interface DecisionRecord {
  type: string;
  prompt: string;
  response: string;
  parsed: unknown;
  timestamp: number;
  wasRetry?: boolean;
}

export interface InvalidResponseRecord {
  type: string;
  response: string;
  reason: string;
  timestamp: number;
}

export class LLMPlayer {
  private model: string;
  private playerName: string;
  private decisionHistory: DecisionRecord[] = [];
  private invalidResponses: InvalidResponseRecord[] = [];

  constructor(model: string, playerName: string) {
    this.model = model;
    this.playerName = playerName;
  }

  getInvalidResponses(): InvalidResponseRecord[] {
    return [...this.invalidResponses];
  }

  private trackInvalidResponse(type: string, response: string, reason: string): void {
    this.invalidResponses.push({
      type,
      response: response.slice(0, 500),
      reason,
      timestamp: Date.now(),
    });
    console.warn(`[${this.playerName}] Invalid ${type} response: "${response.slice(0, 100)}..." - ${reason}`);
  }

  private formatGameState(gameState: PublicGameState): string {
    const lines: string[] = [];
    lines.push(`Turn: ${gameState.turnNumber}`);
    lines.push(`Current Player: ${gameState.players[gameState.currentPlayerIndex]?.name}`);
    lines.push("");
    lines.push("Players:");

    for (const player of gameState.players) {
      const status = !player.isAlive
        ? "ELIMINATED"
        : `${player.coins} coins, ${player.influenceCount} influence`;
      
      const revealed = player.revealedCards.length > 0 
        ? `, revealed: [${player.revealedCards.join(", ")}]`
        : "";
      
      const marker = "cards" in player && player.cards ? " (you)" : "";
      lines.push(`  - ${player.name}${marker}: ${status}${revealed}`);
    }

    if (gameState.recentEvents.length > 0) {
      lines.push("");
      lines.push("Recent Events:");
      for (const event of gameState.recentEvents.slice(-5)) {
        lines.push(`  ${event}`);
      }
    }

    return lines.join("\n");
  }

  private getPlayerCards(gameState: PublicGameState): string[] {
    for (const player of gameState.players) {
      if ("cards" in player && player.cards) {
        return player.cards;
      }
    }
    return [];
  }

  private getAllRevealedCards(gameState: PublicGameState): string[] {
    const revealed: string[] = [];
    for (const player of gameState.players) {
      revealed.push(...player.revealedCards);
    }
    return revealed;
  }

  async chooseAction(
    gameState: PublicGameState,
    validActions: ValidAction[]
  ): Promise<ValidAction> {
    const stateStr = this.formatGameState(gameState);
    const playerCards = this.getPlayerCards(gameState);
    const actionsStr = validActions
      .map((a, i) => `${i}: ${a.description}`)
      .join("\n");

    const prompt = buildActionPrompt(stateStr, actionsStr, playerCards);

    const messages = [
      {
        role: "system" as const,
        content: `You are playing Coup as "${this.playerName}". ${GAME_RULES_PROMPT}`,
      },
      { role: "user" as const, content: prompt },
    ];

    // First attempt
    let response = await callOpenRouter(this.model, messages, 128);
    let action = this.tryParseActionResponse(response, validActions);
    
    // Retry once if parse failed
    if (!action) {
      this.trackInvalidResponse("action", response, "Could not parse action number");
      
      // Make a simpler retry request
      const retryMessages: { role: "system" | "user"; content: string }[] = [
        {
          role: "system",
          content: `You are playing Coup. The previous response "${response.slice(0, 100)}" was invalid.`,
        },
        { 
          role: "user", 
          content: `Choose one action:\n${validActions.map((a, i) => `${i}: ${a.description}`).join("\n")}\n\nRespond with ONLY a number.` 
        },
      ];
      
      response = await callOpenRouter(this.model, retryMessages, 32);
      action = this.tryParseActionResponse(response, validActions);
      
      if (!action) {
        this.trackInvalidResponse("action_retry", response, "Second attempt also failed to parse");
        // After two failures, throw error - this player has a problem
        throw new Error(`[${this.playerName}] Failed to get valid action after retry. Last response: "${response.slice(0, 100)}"`);
      }
    }

    this.decisionHistory.push({
      type: "action",
      prompt,
      response,
      parsed: { 
        actionType: action.actionType, 
        targetIndex: action.targetIndex,
        description: action.description 
      },
      timestamp: Date.now(),
    });

    console.log(`[${this.playerName}] Chose: ${action.description}`);
    return action;
  }

  async decideChallenge(
    gameState: PublicGameState,
    actionDescription: string,
    actorName: string,
    claimedCharacter: string
  ): Promise<boolean> {
    const stateStr = this.formatGameState(gameState);
    const revealedCards = this.getAllRevealedCards(gameState);
    const prompt = buildChallengePrompt(
      stateStr,
      actorName,
      claimedCharacter,
      actionDescription,
      revealedCards
    );

    const messages = [
      {
        role: "system" as const,
        content: `You are playing Coup as "${this.playerName}".`,
      },
      { role: "user" as const, content: prompt },
    ];

    const response = await callOpenRouter(this.model, messages, 32);
    const decision = this.parseChallengeResponse(response);

    this.decisionHistory.push({
      type: "challenge_decision",
      prompt,
      response,
      parsed: { decision, actorName, claimedCharacter },
      timestamp: Date.now(),
    });

    console.log(`[${this.playerName}] Challenge ${actorName}'s ${claimedCharacter}? -> ${decision ? "CHALLENGE" : "ALLOW"}`);
    return decision;
  }

  async decideBlock(
    gameState: PublicGameState,
    actionDescription: string,
    actorName: string,
    availableBlockers: Character[]
  ): Promise<{ shouldBlock: boolean; blockCharacter: Character | null }> {
    const stateStr = this.formatGameState(gameState);
    const blockerStr = availableBlockers.join(", ");
    const yourCards = this.getPlayerCards(gameState);
    const prompt = buildBlockPrompt(stateStr, actorName, actionDescription, blockerStr, yourCards);

    const messages = [
      {
        role: "system" as const,
        content: `You are playing Coup as "${this.playerName}".`,
      },
      { role: "user" as const, content: prompt },
    ];

    const response = await callOpenRouter(this.model, messages, 64);
    const { shouldBlock, blockCharacter } = this.parseBlockResponse(response, availableBlockers);

    this.decisionHistory.push({
      type: "block_decision",
      prompt,
      response,
      parsed: { shouldBlock, blockCharacter, actorName },
      timestamp: Date.now(),
    });

    console.log(`[${this.playerName}] Block ${actorName}? -> ${shouldBlock ? `BLOCK with ${blockCharacter}` : "PASS"}`);
    return { shouldBlock, blockCharacter };
  }

  async chooseCardToLose(
    gameState: PublicGameState,
    cards: Character[]
  ): Promise<number> {
    if (cards.length <= 1) return 0;

    const stateStr = this.formatGameState(gameState);
    const prompt = buildCardLossPrompt(stateStr, cards);

    const messages = [
      {
        role: "system" as const,
        content: `You are playing Coup as "${this.playerName}". You must choose a card to lose.`,
      },
      { role: "user" as const, content: prompt },
    ];

    // First attempt
    let response = await callOpenRouter(this.model, messages, 32);
    let idx = this.tryParseCardIndex(response, cards.length);
    
    // Retry once if parse failed
    if (idx === null) {
      this.trackInvalidResponse("card_loss", response, "Could not parse card index");
      
      const retryMessages: { role: "system" | "user"; content: string }[] = [
        { role: "system", content: `Choose a card to lose. Previous response "${response}" was invalid.` },
        { role: "user", content: `Respond with ONLY: ${cards.map((_, i) => i).join(" or ")}` },
      ];
      
      response = await callOpenRouter(this.model, retryMessages, 16);
      idx = this.tryParseCardIndex(response, cards.length);
      
      if (idx === null) {
        this.trackInvalidResponse("card_loss_retry", response, "Second attempt failed, defaulting to 0");
        idx = 0; // Default to first card after two failures
      }
    }

    console.log(`[${this.playerName}] Loses card ${idx}: ${cards[idx]}`);
    return idx;
  }

  async chooseExchangeCards(
    gameState: PublicGameState,
    allCards: Character[],
    numToKeep: number
  ): Promise<number[]> {
    const stateStr = this.formatGameState(gameState);
    const prompt = buildExchangePrompt(stateStr, allCards, numToKeep);

    const messages = [
      {
        role: "system" as const,
        content: `You are playing Coup as "${this.playerName}". Choose cards to keep.`,
      },
      { role: "user" as const, content: prompt },
    ];

    // First attempt
    let response = await callOpenRouter(this.model, messages, 32);
    let indices = this.tryParseExchangeIndices(response, allCards.length, numToKeep);
    
    // Retry once if parse failed
    if (!indices) {
      this.trackInvalidResponse("exchange", response, "Could not parse card indices");
      
      const retryMessages: { role: "system" | "user"; content: string }[] = [
        { role: "system", content: `Choose ${numToKeep} cards to keep. Previous response "${response}" was invalid.` },
        { role: "user", content: `Respond with ONLY ${numToKeep} numbers separated by comma (e.g., "0, 1")` },
      ];
      
      response = await callOpenRouter(this.model, retryMessages, 16);
      indices = this.tryParseExchangeIndices(response, allCards.length, numToKeep);
      
      if (!indices) {
        this.trackInvalidResponse("exchange_retry", response, "Second attempt failed, keeping first cards");
        indices = Array.from({ length: numToKeep }, (_, i) => i);
      }
    }

    console.log(`[${this.playerName}] Keeps cards: ${indices.map(i => allCards[i]).join(", ")}`);
    return indices;
  }

  private tryParseActionResponse(response: string, validActions: ValidAction[]): ValidAction | null {
    // Try to extract a number from the response
    const cleanResponse = response.trim();
    
    // Direct number match
    const directMatch = /^(\d+)$/.exec(cleanResponse);
    if (directMatch?.[1]) {
      const idx = parseInt(directMatch[1], 10);
      if (idx >= 0 && idx < validActions.length) {
        return validActions[idx]!;
      }
    }

    // Number anywhere in a short response
    if (cleanResponse.length < 50) {
      const numMatch = /(\d+)/.exec(cleanResponse);
      if (numMatch?.[1]) {
        const idx = parseInt(numMatch[1], 10);
        if (idx >= 0 && idx < validActions.length) {
          return validActions[idx]!;
        }
      }
    }

    // Try to match action keywords
    const responseUpper = response.toUpperCase();
    const actionKeywords: Record<string, string> = {
      "INCOME": "income",
      "FOREIGN AID": "foreign_aid",
      "TAX": "tax",
      "COUP": "coup",
      "ASSASSINATE": "assassinate",
      "STEAL": "steal",
      "EXCHANGE": "exchange",
    };

    for (const [keyword, actionType] of Object.entries(actionKeywords)) {
      if (responseUpper.includes(keyword)) {
        const matchingAction = validActions.find(a => a.actionType === actionType);
        if (matchingAction) {
          return matchingAction;
        }
      }
    }

    return null;
  }

  private tryParseCardIndex(response: string, maxIndex: number): number | null {
    const match = /(\d+)/.exec(response.trim());
    if (match?.[1]) {
      const idx = parseInt(match[1], 10);
      if (idx >= 0 && idx < maxIndex) {
        return idx;
      }
    }
    return null;
  }

  private tryParseExchangeIndices(response: string, maxIndex: number, numToKeep: number): number[] | null {
    const numbers = response.match(/\d+/g);
    if (numbers) {
      const indices = numbers
        .map(n => parseInt(n, 10))
        .filter(n => n >= 0 && n < maxIndex);
      
      const uniqueIndices = [...new Set(indices)];
      if (uniqueIndices.length >= numToKeep) {
        return uniqueIndices.slice(0, numToKeep);
      }
    }
    return null;
  }

  private parseChallengeResponse(response: string): boolean {
    const upper = response.toUpperCase().trim();
    
    // Explicit CHALLENGE
    if (upper === "CHALLENGE" || upper.startsWith("CHALLENGE")) {
      return true;
    }
    
    // Explicit ALLOW or PASS
    if (upper === "ALLOW" || upper === "PASS" || upper.startsWith("ALLOW") || upper.startsWith("PASS")) {
      return false;
    }
    
    // Check for challenge intent in longer responses
    if (upper.includes("CHALLENGE") && 
        !upper.includes("NOT CHALLENGE") && 
        !upper.includes("DON'T CHALLENGE") &&
        !upper.includes("WON'T CHALLENGE")) {
      return true;
    }
    
    // Default to not challenging (safer)
    return false;
  }

  private parseBlockResponse(
    response: string,
    availableBlockers: Character[]
  ): { shouldBlock: boolean; blockCharacter: Character | null } {
    const upper = response.toUpperCase().trim();

    // Check for explicit pass/no block
    if (upper === "PASS" || 
        upper === "NO" || 
        upper.startsWith("PASS") ||
        upper.includes("NO BLOCK") ||
        upper.includes("DON'T BLOCK") ||
        upper.includes("NOT BLOCK")) {
      return { shouldBlock: false, blockCharacter: null };
    }

    // Check for block with character
    if (upper.includes("BLOCK")) {
      for (const char of availableBlockers) {
        if (upper.includes(char.toUpperCase())) {
          return { shouldBlock: true, blockCharacter: char };
        }
      }
      // BLOCK without character - use first available
      return { shouldBlock: true, blockCharacter: availableBlockers[0] ?? null };
    }

    // Check if they just named a character
    for (const char of availableBlockers) {
      if (upper.includes(char.toUpperCase())) {
        return { shouldBlock: true, blockCharacter: char };
      }
    }

    // Default to not blocking
    return { shouldBlock: false, blockCharacter: null };
  }

  getDecisionHistory(): DecisionRecord[] {
    return [...this.decisionHistory];
  }
}
