/**
 * LLM Prompt templates for Coup game decisions
 * 
 * Based on the official Coup rules. Prompts are neutral and informative,
 * letting the LLM decide strategy independently.
 * 
 * FORMAT INSTRUCTIONS are placed at the END of prompts (recency bias)
 * and use explicit "RESPOND WITH ONLY" language for better compliance.
 */

export const GAME_RULES_PROMPT = `# COUP - Official Rules

## OBJECTIVE
Eliminate all other players' influence and be the last player remaining.

## SETUP
- Each player starts with 2 coins and 2 face-down character cards (influence)
- The deck contains 3 copies each of 5 characters (15 cards total)
- Your cards are hidden from other players

## THE 5 CHARACTERS

| Character | Action | Counteraction |
|-----------|--------|---------------|
| Duke | Tax: Take 3 coins from treasury | Blocks Foreign Aid |
| Assassin | Assassinate: Pay 3 coins, choose player to lose influence | None |
| Captain | Steal: Take 2 coins from another player | Blocks stealing |
| Ambassador | Exchange: Draw 2 cards from deck, choose which to keep | Blocks stealing |
| Contessa | None | Blocks assassination |

## ACTIONS ON YOUR TURN

**General Actions (always available):**
- Income: Take 1 coin (cannot be challenged or blocked)
- Foreign Aid: Take 2 coins (can be blocked by Duke)
- Coup: Pay 7 coins, choose player to lose influence (cannot be challenged or blocked)

**Character Actions (can be challenged):**
- Tax (Duke): Take 3 coins
- Assassinate (Assassin): Pay 3 coins, target loses influence
- Steal (Captain): Take 2 coins from another player
- Exchange (Ambassador): Draw 2 cards, return 2 to deck

**Mandatory Rule:** If you have 10+ coins, you MUST coup.

## CHALLENGES
- Any character claim can be challenged by any player
- If challenged and you HAVE the card: Challenger loses 1 influence
- If challenged and you DON'T have the card: You lose 1 influence, action fails

## COUNTERACTIONS (BLOCKING)
- Blocks can be challenged like any other character claim

## BLUFFING
You may claim ANY character, even without the card. If no one challenges, the action succeeds.`;

export function buildActionPrompt(
  gameState: string,
  validActions: string,
  playerCards: string[]
): string {
  return `${GAME_RULES_PROMPT}

---

CURRENT GAME STATE:
${gameState}

YOUR CARDS: ${playerCards.join(", ")}

AVAILABLE ACTIONS:
${validActions}

---

YOUR TURN: Choose one action from the list above.

RESPOND WITH ONLY A NUMBER (0, 1, 2, etc.) - nothing else.`;
}

export function buildChallengePrompt(
  gameState: string,
  actorName: string,
  claimedCharacter: string,
  actionDescription: string,
  revealedCards: string[]
): string {
  const revealedInfo = revealedCards.length > 0 
    ? `Cards revealed so far: ${revealedCards.join(", ")}`
    : "No cards have been revealed yet.";

  return `${GAME_RULES_PROMPT}

---

CURRENT GAME STATE:
${gameState}

${revealedInfo}

---

${actorName} claims ${claimedCharacter} to perform: ${actionDescription}

Do you want to CHALLENGE this claim?
- If you challenge and they're bluffing: THEY lose influence
- If you challenge and they have it: YOU lose influence

RESPOND WITH ONLY ONE WORD: CHALLENGE or ALLOW`;
}

export function buildBlockPrompt(
  gameState: string,
  actorName: string,
  actionDescription: string,
  availableBlockers: string,
  yourCards: string[]
): string {
  return `${GAME_RULES_PROMPT}

---

CURRENT GAME STATE:
${gameState}

YOUR CARDS: ${yourCards.join(", ")}

---

${actorName} is targeting you with: ${actionDescription}

You can block by claiming: ${availableBlockers}
(You may bluff a character you don't have, but can be challenged)

Do you want to block?

RESPOND WITH ONLY: "BLOCK [character]" or "PASS"
Examples: "BLOCK Contessa" or "BLOCK Captain" or "PASS"`;
}

export function buildCardLossPrompt(
  gameState: string,
  cards: string[]
): string {
  return `You must lose one card. Your cards are:
${cards.map((c, i) => `${i}: ${c}`).join("\n")}

Which card do you want to lose?

RESPOND WITH ONLY A NUMBER: ${cards.map((_, i) => i).join(" or ")}`;
}

export function buildExchangePrompt(
  gameState: string,
  allCards: string[],
  numToKeep: number
): string {
  return `Exchange: Choose ${numToKeep} card(s) to KEEP from:
${allCards.map((c, i) => `${i}: ${c}`).join("\n")}

RESPOND WITH ONLY ${numToKeep} NUMBER(S) separated by comma: e.g., "0, 2"`;
}
