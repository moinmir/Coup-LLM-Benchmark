import os
import json
import re
import random
from openai import OpenAI
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception
from game_engine import ActionType, Character, Action, CoupGame


AI_INTEGRATIONS_OPENROUTER_API_KEY = os.environ.get("AI_INTEGRATIONS_OPENROUTER_API_KEY")
AI_INTEGRATIONS_OPENROUTER_BASE_URL = os.environ.get("AI_INTEGRATIONS_OPENROUTER_BASE_URL")

openrouter = OpenAI(
    api_key=AI_INTEGRATIONS_OPENROUTER_API_KEY,
    base_url=AI_INTEGRATIONS_OPENROUTER_BASE_URL
)


def is_rate_limit_error(exception: BaseException) -> bool:
    error_msg = str(exception)
    return (
        "429" in error_msg
        or "RATELIMIT_EXCEEDED" in error_msg
        or "quota" in error_msg.lower()
        or "rate limit" in error_msg.lower()
        or (hasattr(exception, "status_code") and exception.status_code == 429)
    )


COUP_RULES = """
COUP GAME RULES:
You are playing Coup, a bluffing card game. Each player has 2 hidden character cards (influence) and starts with 2 coins.
Last player with influence wins.

CHARACTERS (3 of each in deck):
- Duke: Can Tax (take 3 coins), Can block Foreign Aid
- Assassin: Can Assassinate (pay 3 coins, target loses influence)
- Captain: Can Steal (take 2 coins from player), Can block Stealing
- Ambassador: Can Exchange (draw 2 cards, swap any), Can block Stealing
- Contessa: Can block Assassination

ACTIONS:
- Income: Take 1 coin (cannot be blocked or challenged)
- Foreign Aid: Take 2 coins (can be blocked by Duke)
- Coup: Pay 7 coins, target loses influence (cannot be blocked or challenged). MANDATORY if you have 10+ coins.
- Tax (Duke): Take 3 coins
- Assassinate (Assassin): Pay 3 coins, target loses influence (can be blocked by Contessa)
- Steal (Captain): Take up to 2 coins from a player (can be blocked by Captain/Ambassador)
- Exchange (Ambassador): Draw 2 cards from deck, may swap with your cards

BLUFFING: You can claim ANY character's action even if you don't have it.
CHALLENGES: Any player can challenge a character claim. If caught bluffing, you lose influence. If wrongly challenged, challenger loses influence.
BLOCKING: Blocks can also be challenged.
"""


class LLMPlayer:
    def __init__(self, model: str, player_name: str):
        self.model = model
        self.player_name = player_name
        self.decision_history = []
    
    @retry(
        stop=stop_after_attempt(5),
        wait=wait_exponential(multiplier=1, min=2, max=60),
        retry=retry_if_exception(is_rate_limit_error),
        reraise=True
    )
    def _call_llm(self, messages: list, max_tokens: int = 1024) -> str:
        response = openrouter.chat.completions.create(
            model=self.model,
            messages=messages,
            max_tokens=max_tokens,
            temperature=0.7
        )
        return response.choices[0].message.content or ""
    
    def choose_action(self, game_state: dict, valid_actions: list) -> dict:
        prompt = self._build_action_prompt(game_state, valid_actions)
        
        messages = [
            {"role": "system", "content": COUP_RULES + "\n\nYou are playing as " + self.player_name + ". Think strategically and make decisions to win."},
            {"role": "user", "content": prompt}
        ]
        
        try:
            response = self._call_llm(messages)
            action = self._parse_action_response(response, valid_actions)
            self.decision_history.append({
                "type": "action",
                "prompt": prompt,
                "response": response,
                "parsed_action": action
            })
            return action
        except Exception as e:
            return valid_actions[0]
    
    def decide_challenge(self, game_state: dict, action_description: str, actor_name: str, claimed_character: str) -> bool:
        prompt = f"""
Current game state:
{self._format_game_state(game_state)}

{actor_name} is claiming to have {claimed_character} to perform: {action_description}

Should you challenge this claim? Consider:
- What cards have been revealed already?
- Is this player likely bluffing based on their behavior?
- What are the risks if you're wrong?

Respond with EXACTLY one word: CHALLENGE or ALLOW
"""
        
        messages = [
            {"role": "system", "content": COUP_RULES + f"\n\nYou are {self.player_name}. Decide whether to challenge."},
            {"role": "user", "content": prompt}
        ]
        
        try:
            response = self._call_llm(messages, max_tokens=50)
            decision = "CHALLENGE" in response.upper()
            self.decision_history.append({
                "type": "challenge_decision",
                "against": actor_name,
                "claimed": claimed_character,
                "decision": decision,
                "response": response
            })
            return decision
        except Exception:
            return False
    
    def decide_block(self, game_state: dict, action_description: str, actor_name: str, available_blockers: list) -> tuple:
        blocker_str = ", ".join([c.value for c in available_blockers])
        prompt = f"""
Current game state:
{self._format_game_state(game_state)}

{actor_name} is targeting you with: {action_description}

You can block by claiming one of: {blocker_str}

Should you block? You can bluff even if you don't have the blocking character.

Respond in this EXACT format:
BLOCK: [character name] or NO_BLOCK

Example: BLOCK: Contessa
Example: NO_BLOCK
"""
        
        messages = [
            {"role": "system", "content": COUP_RULES + f"\n\nYou are {self.player_name}. Decide whether to block."},
            {"role": "user", "content": prompt}
        ]
        
        try:
            response = self._call_llm(messages, max_tokens=100)
            should_block, block_char = self._parse_block_response(response, available_blockers)
            self.decision_history.append({
                "type": "block_decision",
                "against": actor_name,
                "action": action_description,
                "decision": should_block,
                "character": block_char.value if block_char else None,
                "response": response
            })
            return should_block, block_char
        except Exception:
            return False, None
    
    def choose_card_to_lose(self, game_state: dict, cards: list) -> int:
        if len(cards) <= 1:
            return 0
        
        cards_str = ", ".join([f"{i}: {c.value}" for i, c in enumerate(cards)])
        prompt = f"""
Current game state:
{self._format_game_state(game_state)}

You must lose one of your cards. Your cards are:
{cards_str}

Which card index do you want to lose? Consider which card is more valuable for the rest of the game.

Respond with EXACTLY one number: 0 or 1
"""
        
        messages = [
            {"role": "system", "content": COUP_RULES + f"\n\nYou are {self.player_name}. Choose which card to reveal."},
            {"role": "user", "content": prompt}
        ]
        
        try:
            response = self._call_llm(messages, max_tokens=20)
            match = re.search(r'\d+', response)
            if match:
                idx = int(match.group())
                if 0 <= idx < len(cards):
                    return idx
            return 0
        except Exception:
            return 0
    
    def choose_exchange_cards(self, game_state: dict, all_cards: list, num_to_keep: int) -> list:
        cards_str = ", ".join([f"{i}: {c.value}" for i, c in enumerate(all_cards)])
        prompt = f"""
Current game state:
{self._format_game_state(game_state)}

You are exchanging cards. Available cards are:
{cards_str}

You must keep exactly {num_to_keep} cards and return the rest to the deck.

Which card indices do you want to KEEP? Consider which combination is strongest.

Respond with exactly {num_to_keep} numbers separated by commas. Example: 0, 2
"""
        
        messages = [
            {"role": "system", "content": COUP_RULES + f"\n\nYou are {self.player_name}. Choose which cards to keep."},
            {"role": "user", "content": prompt}
        ]
        
        try:
            response = self._call_llm(messages, max_tokens=50)
            numbers = re.findall(r'\d+', response)
            indices = [int(n) for n in numbers if int(n) < len(all_cards)]
            if len(indices) >= num_to_keep:
                return indices[:num_to_keep]
            return list(range(num_to_keep))
        except Exception:
            return list(range(num_to_keep))
    
    def _build_action_prompt(self, game_state: dict, valid_actions: list) -> str:
        state_str = self._format_game_state(game_state)
        actions_str = "\n".join([f"{i}: {a['description']}" for i, a in enumerate(valid_actions)])
        
        return f"""
Current game state:
{state_str}

Your valid actions:
{actions_str}

Choose your action by responding with the action number and a brief reason.
Format: ACTION: [number]
Example: ACTION: 0

Think about:
- Your current coins and cards
- What other players might be holding
- Bluffing opportunities
- Risk of being challenged
"""
    
    def _format_game_state(self, game_state: dict) -> str:
        lines = [f"Turn {game_state['turn_number']}"]
        
        for player in game_state['players']:
            status = "ELIMINATED" if not player['is_alive'] else f"{player['coins']} coins"
            if 'cards' in player:
                cards = ", ".join(player['cards'])
                lines.append(f"  {player['name']} (YOU): {status}, Cards: [{cards}], Revealed: {player['revealed_cards']}")
            else:
                lines.append(f"  {player['name']}: {status}, {player['influence_count']} influence, Revealed: {player['revealed_cards']}")
        
        if game_state.get('recent_events'):
            lines.append("\nRecent events:")
            for event in game_state['recent_events'][-5:]:
                lines.append(f"  - {event}")
        
        return "\n".join(lines)
    
    def _parse_action_response(self, response: str, valid_actions: list) -> dict:
        match = re.search(r'ACTION:\s*(\d+)', response, re.IGNORECASE)
        if match:
            idx = int(match.group(1))
            if 0 <= idx < len(valid_actions):
                return valid_actions[idx]
        
        numbers = re.findall(r'\d+', response)
        for num_str in numbers:
            idx = int(num_str)
            if 0 <= idx < len(valid_actions):
                return valid_actions[idx]
        
        return valid_actions[0]
    
    def _parse_block_response(self, response: str, available_blockers: list) -> tuple:
        if "NO_BLOCK" in response.upper():
            return False, None
        
        if "BLOCK" in response.upper():
            for char in available_blockers:
                if char.value.upper() in response.upper():
                    return True, char
            return True, available_blockers[0]
        
        return False, None


class GameAnalytics:
    def __init__(self):
        self.bluff_attempts = []
        self.challenges = []
        self.blocks = []
        self.action_counts = {}
        self.turn_history = []
    
    def record_bluff(self, player_idx: int, model: str, claimed_char: str, had_card: bool, was_challenged: bool, success: bool):
        self.bluff_attempts.append({
            "player_idx": player_idx,
            "model": model,
            "claimed_character": claimed_char,
            "had_card": had_card,
            "was_challenged": was_challenged,
            "bluff_success": success
        })
    
    def record_challenge(self, challenger_idx: int, challenger_model: str, target_idx: int, target_model: str, 
                         claimed_char: str, challenge_success: bool, is_block_challenge: bool = False):
        self.challenges.append({
            "challenger_idx": challenger_idx,
            "challenger_model": challenger_model,
            "target_idx": target_idx,
            "target_model": target_model,
            "claimed_character": claimed_char,
            "challenge_success": challenge_success,
            "is_block_challenge": is_block_challenge
        })
    
    def record_block(self, blocker_idx: int, blocker_model: str, blocking_char: str, 
                     against_action: str, had_card: bool, was_challenged: bool, block_success: bool):
        self.blocks.append({
            "blocker_idx": blocker_idx,
            "blocker_model": blocker_model,
            "blocking_character": blocking_char,
            "against_action": against_action,
            "had_card": had_card,
            "was_challenged": was_challenged,
            "block_success": block_success
        })
    
    def record_action(self, player_idx: int, model: str, action_type: str):
        key = (model, action_type)
        self.action_counts[key] = self.action_counts.get(key, 0) + 1
    
    def record_turn(self, turn_data: dict):
        self.turn_history.append(turn_data)
    
    def get_summary(self) -> dict:
        bluff_stats = {}
        for bluff in self.bluff_attempts:
            model = bluff["model"]
            if model not in bluff_stats:
                bluff_stats[model] = {"total": 0, "successful": 0, "caught": 0}
            bluff_stats[model]["total"] += 1
            if bluff["bluff_success"]:
                bluff_stats[model]["successful"] += 1
            if bluff["was_challenged"] and not bluff["had_card"]:
                bluff_stats[model]["caught"] += 1
        
        challenge_stats = {}
        for challenge in self.challenges:
            model = challenge["challenger_model"]
            if model not in challenge_stats:
                challenge_stats[model] = {"total": 0, "successful": 0}
            challenge_stats[model]["total"] += 1
            if challenge["challenge_success"]:
                challenge_stats[model]["successful"] += 1
        
        block_stats = {}
        for block in self.blocks:
            model = block["blocker_model"]
            if model not in block_stats:
                block_stats[model] = {"total": 0, "successful": 0, "bluffs": 0}
            block_stats[model]["total"] += 1
            if block["block_success"]:
                block_stats[model]["successful"] += 1
            if not block["had_card"]:
                block_stats[model]["bluffs"] += 1
        
        return {
            "bluff_stats": bluff_stats,
            "challenge_stats": challenge_stats,
            "block_stats": block_stats,
            "action_counts": {f"{k[0]}|{k[1]}": v for k, v in self.action_counts.items()},
            "total_turns": len(self.turn_history),
            "turn_history": self.turn_history
        }


class GameRunner:
    def __init__(self, player_configs: list[dict], max_turns: int = 100):
        self.game = CoupGame(player_configs)
        self.llm_players: dict[int, LLMPlayer] = {}
        self.max_turns = max_turns
        self.analytics = GameAnalytics()
        self.player_configs = player_configs
        
        for i, config in enumerate(player_configs):
            self.llm_players[i] = LLMPlayer(config["model"], config["name"])
    
    def run_turn(self) -> dict:
        if self.game.game_over:
            return {"game_over": True, "summary": self.game.get_game_summary()}
        
        current_idx = self.game.current_player_index
        current_player = self.game.players[current_idx]
        current_model = self.player_configs[current_idx]["model"]
        llm_player = self.llm_players[current_idx]
        
        turn_events = []
        turn_data = {"turn": self.game.turn_number + 1, "player": current_player.name, "model": current_model, "events": []}
        turn_events.append(f"Turn {self.game.turn_number + 1}: {current_player.name}'s turn")
        
        game_state = self.game.get_game_state(for_player_index=current_idx)
        valid_actions = self.game.get_valid_actions(current_idx)
        
        if current_player.coins >= 10:
            chosen_action_dict = valid_actions[0]
            turn_events.append(f"{current_player.name} must Coup (10+ coins)")
        else:
            chosen_action_dict = llm_player.choose_action(game_state, valid_actions)
        
        action = Action(
            action_type=ActionType(chosen_action_dict["action_type"]),
            player_index=current_idx,
            target_index=chosen_action_dict.get("target_index"),
            claimed_character=self.game.CHARACTER_ACTIONS.get(ActionType(chosen_action_dict["action_type"]))
        )
        
        self.analytics.record_action(current_idx, current_model, action.action_type.value)
        turn_data["action"] = action.action_type.value
        turn_data["target"] = action.target_index
        
        turn_events.append(f"{current_player.name} chooses: {action}")
        
        challenged = False
        challenger_index = None
        
        if self.game.can_challenge_action(action):
            other_players = [(i, p) for i, p in enumerate(self.game.players) if i != current_idx and p.is_alive()]
            random.shuffle(other_players)
            
            for i, p in other_players:
                opponent_llm = self.llm_players[i]
                game_state_for_opponent = self.game.get_game_state(for_player_index=i)
                
                if opponent_llm.decide_challenge(
                    game_state_for_opponent,
                    str(action),
                    current_player.name,
                    action.claimed_character.value if action.claimed_character else "unknown"
                ):
                    challenged = True
                    challenger_index = i
                    turn_events.append(f"{p.name} challenges!")
                    break
        
        blocked = False
        blocker_index = None
        block_character = None
        
        if not challenged or (challenged and action.claimed_character in current_player.cards):
            blockers = self.game.can_block_action(action)
            if blockers and action.target_index is not None:
                target_player = self.game.players[action.target_index]
                if target_player.is_alive():
                    target_llm = self.llm_players[action.target_index]
                    game_state_for_target = self.game.get_game_state(for_player_index=action.target_index)
                    
                    should_block, block_char = target_llm.decide_block(
                        game_state_for_target,
                        str(action),
                        current_player.name,
                        blockers
                    )
                    
                    if should_block:
                        blocked = True
                        blocker_index = action.target_index
                        block_character = block_char
                        turn_events.append(f"{target_player.name} blocks with {block_char.value}!")
            
            elif blockers and action.action_type == ActionType.FOREIGN_AID:
                other_players = [(i, p) for i, p in enumerate(self.game.players) if i != current_idx and p.is_alive()]
                random.shuffle(other_players)
                
                for i, p in other_players:
                    opponent_llm = self.llm_players[i]
                    game_state_for_opponent = self.game.get_game_state(for_player_index=i)
                    
                    should_block, block_char = opponent_llm.decide_block(
                        game_state_for_opponent,
                        str(action),
                        current_player.name,
                        blockers
                    )
                    
                    if should_block:
                        blocked = True
                        blocker_index = i
                        block_character = block_char
                        turn_events.append(f"{p.name} blocks Foreign Aid with Duke!")
                        break
        
        block_challenged = False
        block_challenger_index = None
        
        if blocked:
            if block_character:
                other_players = [(i, p) for i, p in enumerate(self.game.players) if i != blocker_index and p.is_alive()]
                random.shuffle(other_players)
                
                for i, p in other_players:
                    opponent_llm = self.llm_players[i]
                    game_state_for_opponent = self.game.get_game_state(for_player_index=i)
                    
                    if opponent_llm.decide_challenge(
                        game_state_for_opponent,
                        f"blocking with {block_character.value}",
                        self.game.players[blocker_index].name,
                        block_character.value
                    ):
                        block_challenged = True
                        block_challenger_index = i
                        turn_events.append(f"{p.name} challenges the block!")
                        break
        
        result = self.game.execute_action(
            action,
            challenged=challenged,
            challenger_index=challenger_index,
            blocked=blocked,
            blocker_index=blocker_index,
            block_character=block_character,
            block_challenged=block_challenged,
            block_challenger_index=block_challenger_index
        )
        
        for event in result.get("events", []):
            turn_events.append(str(event))
        
        if result.get("challenger_loses_influence"):
            loser_idx = result["challenger_loses_influence"]
            loser = self.game.players[loser_idx]
            if loser.is_alive():
                card_idx = self.llm_players[loser_idx].choose_card_to_lose(
                    self.game.get_game_state(for_player_index=loser_idx),
                    loser.cards
                )
                self.game.apply_influence_loss(loser_idx, card_idx)
        
        if result.get("actor_loses_influence"):
            loser_idx = result["actor_loses_influence"]
            loser = self.game.players[loser_idx]
            if loser.is_alive():
                card_idx = self.llm_players[loser_idx].choose_card_to_lose(
                    self.game.get_game_state(for_player_index=loser_idx),
                    loser.cards
                )
                self.game.apply_influence_loss(loser_idx, card_idx)
        
        if result.get("blocker_loses_influence"):
            loser_idx = result["blocker_loses_influence"]
            loser = self.game.players[loser_idx]
            if loser.is_alive():
                card_idx = self.llm_players[loser_idx].choose_card_to_lose(
                    self.game.get_game_state(for_player_index=loser_idx),
                    loser.cards
                )
                self.game.apply_influence_loss(loser_idx, card_idx)
        
        if result.get("block_challenger_loses_influence"):
            loser_idx = result["block_challenger_loses_influence"]
            loser = self.game.players[loser_idx]
            if loser.is_alive():
                card_idx = self.llm_players[loser_idx].choose_card_to_lose(
                    self.game.get_game_state(for_player_index=loser_idx),
                    loser.cards
                )
                self.game.apply_influence_loss(loser_idx, card_idx)
        
        if result.get("target_loses_influence") and result.get("success", True):
            loser_idx = result["target_loses_influence"]
            loser = self.game.players[loser_idx]
            if loser.is_alive():
                card_idx = self.llm_players[loser_idx].choose_card_to_lose(
                    self.game.get_game_state(for_player_index=loser_idx),
                    loser.cards
                )
                self.game.apply_influence_loss(loser_idx, card_idx)
        
        if result.get("needs_exchange_selection"):
            all_cards = result["exchange_cards"]
            num_to_keep = result["cards_to_keep"]
            kept_indices = llm_player.choose_exchange_cards(
                self.game.get_game_state(for_player_index=current_idx),
                all_cards,
                num_to_keep
            )
            self.game.apply_exchange(current_idx, kept_indices, all_cards)
        
        if action.claimed_character and self.game.can_challenge_action(action):
            had_card = action.claimed_character in current_player.cards
            was_bluff = not had_card
            bluff_success = result.get("success", True) or (challenged and had_card)
            self.analytics.record_bluff(
                current_idx, current_model,
                action.claimed_character.value if action.claimed_character else "unknown",
                had_card, challenged, bluff_success if was_bluff else True
            )
        
        if challenged and challenger_index is not None:
            challenge_success = result.get("actor_loses_influence") is not None
            self.analytics.record_challenge(
                challenger_index, self.player_configs[challenger_index]["model"],
                current_idx, current_model,
                action.claimed_character.value if action.claimed_character else "unknown",
                challenge_success, is_block_challenge=False
            )
        
        if blocked and blocker_index is not None and block_character:
            blocker_player = self.game.players[blocker_index]
            had_block_card = block_character in blocker_player.cards
            block_success = not block_challenged or (block_challenged and had_block_card)
            self.analytics.record_block(
                blocker_index, self.player_configs[blocker_index]["model"],
                block_character.value,
                action.action_type.value,
                had_block_card, block_challenged, block_success
            )
        
        if block_challenged and block_challenger_index is not None and block_character:
            block_challenge_success = result.get("blocker_loses_influence") is not None
            self.analytics.record_challenge(
                block_challenger_index, self.player_configs[block_challenger_index]["model"],
                blocker_index, self.player_configs[blocker_index]["model"],
                block_character.value,
                block_challenge_success, is_block_challenge=True
            )
        
        turn_data["events"] = turn_events
        turn_data["challenged"] = challenged
        turn_data["blocked"] = blocked
        turn_data["result_success"] = result.get("success", True)
        self.analytics.record_turn(turn_data)
        
        self.game.advance_turn()
        
        return {
            "game_over": self.game.game_over,
            "turn_events": turn_events,
            "game_state": self.game.get_game_state(),
            "summary": self.game.get_game_summary() if self.game.game_over else None,
            "turn_data": turn_data
        }
    
    def run_full_game(self, on_turn_complete=None) -> dict:
        while not self.game.game_over and self.game.turn_number < self.max_turns:
            result = self.run_turn()
            if on_turn_complete:
                on_turn_complete(result)
            if result["game_over"]:
                break
        
        game_summary = self.game.get_game_summary()
        game_summary["analytics"] = self.analytics.get_summary()
        return game_summary
