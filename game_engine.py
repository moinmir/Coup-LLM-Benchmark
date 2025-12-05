import random
from enum import Enum
from dataclasses import dataclass, field
from typing import Optional
import copy


class Character(Enum):
    DUKE = "Duke"
    ASSASSIN = "Assassin"
    CAPTAIN = "Captain"
    AMBASSADOR = "Ambassador"
    CONTESSA = "Contessa"


class ActionType(Enum):
    INCOME = "income"
    FOREIGN_AID = "foreign_aid"
    COUP = "coup"
    TAX = "tax"
    ASSASSINATE = "assassinate"
    STEAL = "steal"
    EXCHANGE = "exchange"


@dataclass
class Action:
    action_type: ActionType
    player_index: int
    target_index: Optional[int] = None
    claimed_character: Optional[Character] = None
    
    def __str__(self):
        if self.action_type == ActionType.INCOME:
            return "Income (take 1 coin)"
        elif self.action_type == ActionType.FOREIGN_AID:
            return "Foreign Aid (take 2 coins)"
        elif self.action_type == ActionType.COUP:
            return f"Coup (target player {self.target_index})"
        elif self.action_type == ActionType.TAX:
            return "Tax (Duke - take 3 coins)"
        elif self.action_type == ActionType.ASSASSINATE:
            return f"Assassinate (target player {self.target_index})"
        elif self.action_type == ActionType.STEAL:
            return f"Steal (Captain - from player {self.target_index})"
        elif self.action_type == ActionType.EXCHANGE:
            return "Exchange (Ambassador)"
        return str(self.action_type)


@dataclass
class Player:
    name: str
    model: str
    coins: int = 2
    cards: list = field(default_factory=list)
    revealed_cards: list = field(default_factory=list)
    
    def is_alive(self) -> bool:
        return len(self.cards) > 0
    
    def influence_count(self) -> int:
        return len(self.cards)
    
    def total_cards(self) -> int:
        return len(self.cards) + len(self.revealed_cards)
    
    def lose_influence(self, card_index: int = 0) -> Character:
        if self.cards:
            card = self.cards.pop(card_index)
            self.revealed_cards.append(card)
            return card
        return None
    
    def get_visible_state(self) -> dict:
        return {
            "name": self.name,
            "model": self.model,
            "coins": self.coins,
            "influence_count": len(self.cards),
            "revealed_cards": [c.value for c in self.revealed_cards]
        }


@dataclass
class GameEvent:
    event_type: str
    player_index: int
    description: str
    details: dict = field(default_factory=dict)
    
    def __str__(self):
        return self.description


class CoupGame:
    CHARACTER_ACTIONS = {
        ActionType.TAX: Character.DUKE,
        ActionType.ASSASSINATE: Character.ASSASSIN,
        ActionType.STEAL: Character.CAPTAIN,
        ActionType.EXCHANGE: Character.AMBASSADOR
    }
    
    ACTION_BLOCKERS = {
        ActionType.FOREIGN_AID: [Character.DUKE],
        ActionType.ASSASSINATE: [Character.CONTESSA],
        ActionType.STEAL: [Character.CAPTAIN, Character.AMBASSADOR]
    }
    
    def __init__(self, player_configs: list[dict]):
        self.players: list[Player] = []
        self.deck: list[Character] = []
        self.current_player_index: int = 0
        self.game_over: bool = False
        self.winner: Optional[int] = None
        self.turn_number: int = 0
        self.event_log: list[GameEvent] = []
        
        self._setup_game(player_configs)
    
    def _setup_game(self, player_configs: list[dict]):
        self.deck = []
        for char in Character:
            self.deck.extend([char] * 3)
        random.shuffle(self.deck)
        
        for i, config in enumerate(player_configs):
            player = Player(
                name=config.get("name", f"Player {i+1}"),
                model=config.get("model", "unknown"),
                coins=2,
                cards=[self.deck.pop(), self.deck.pop()],
                revealed_cards=[]
            )
            self.players.append(player)
        
        self._log_event("game_start", -1, f"Game started with {len(self.players)} players")
    
    def _log_event(self, event_type: str, player_index: int, description: str, details: dict = None):
        event = GameEvent(event_type, player_index, description, details or {})
        self.event_log.append(event)
        return event
    
    def get_game_state(self, for_player_index: int = None) -> dict:
        state = {
            "turn_number": self.turn_number,
            "current_player_index": self.current_player_index,
            "game_over": self.game_over,
            "winner": self.winner,
            "players": [],
            "deck_size": len(self.deck),
            "recent_events": [str(e) for e in self.event_log[-10:]]
        }
        
        for i, player in enumerate(self.players):
            if for_player_index is not None and i == for_player_index:
                state["players"].append({
                    "index": i,
                    "name": player.name,
                    "model": player.model,
                    "coins": player.coins,
                    "cards": [c.value for c in player.cards],
                    "revealed_cards": [c.value for c in player.revealed_cards],
                    "is_alive": player.is_alive()
                })
            else:
                state["players"].append({
                    "index": i,
                    "name": player.name,
                    "model": player.model,
                    "coins": player.coins,
                    "influence_count": player.influence_count(),
                    "revealed_cards": [c.value for c in player.revealed_cards],
                    "is_alive": player.is_alive()
                })
        
        return state
    
    def get_valid_actions(self, player_index: int) -> list[dict]:
        player = self.players[player_index]
        actions = []
        
        if player.coins >= 10:
            alive_opponents = [i for i, p in enumerate(self.players) if p.is_alive() and i != player_index]
            for target in alive_opponents:
                actions.append({
                    "action_type": ActionType.COUP.value,
                    "target_index": target,
                    "description": f"Coup player {target} ({self.players[target].name}) - MANDATORY with 10+ coins"
                })
            return actions
        
        actions.append({
            "action_type": ActionType.INCOME.value,
            "target_index": None,
            "description": "Income: Take 1 coin (cannot be blocked or challenged)"
        })
        
        actions.append({
            "action_type": ActionType.FOREIGN_AID.value,
            "target_index": None,
            "description": "Foreign Aid: Take 2 coins (can be blocked by Duke)"
        })
        
        if player.coins >= 7:
            alive_opponents = [i for i, p in enumerate(self.players) if p.is_alive() and i != player_index]
            for target in alive_opponents:
                actions.append({
                    "action_type": ActionType.COUP.value,
                    "target_index": target,
                    "description": f"Coup player {target} ({self.players[target].name}): Pay 7 coins, target loses influence"
                })
        
        actions.append({
            "action_type": ActionType.TAX.value,
            "target_index": None,
            "description": "Tax (Duke): Take 3 coins (can be challenged)"
        })
        
        if player.coins >= 3:
            alive_opponents = [i for i, p in enumerate(self.players) if p.is_alive() and i != player_index]
            for target in alive_opponents:
                actions.append({
                    "action_type": ActionType.ASSASSINATE.value,
                    "target_index": target,
                    "description": f"Assassinate player {target} ({self.players[target].name}): Pay 3 coins, target loses influence (can be blocked by Contessa, can be challenged)"
                })
        
        alive_opponents = [i for i, p in enumerate(self.players) if p.is_alive() and i != player_index and p.coins > 0]
        for target in alive_opponents:
            actions.append({
                "action_type": ActionType.STEAL.value,
                "target_index": target,
                "description": f"Steal from player {target} ({self.players[target].name}): Take up to 2 coins (can be blocked by Captain/Ambassador, can be challenged)"
            })
        
        actions.append({
            "action_type": ActionType.EXCHANGE.value,
            "target_index": None,
            "description": "Exchange (Ambassador): Draw 2 cards, choose which to keep (can be challenged)"
        })
        
        return actions
    
    def get_alive_players(self) -> list[int]:
        return [i for i, p in enumerate(self.players) if p.is_alive()]
    
    def check_game_over(self) -> bool:
        alive = self.get_alive_players()
        if len(alive) <= 1:
            self.game_over = True
            self.winner = alive[0] if alive else None
            if self.winner is not None:
                self._log_event("game_over", self.winner, f"{self.players[self.winner].name} wins the game!")
            return True
        return False
    
    def advance_turn(self):
        if self.check_game_over():
            return
        
        self.turn_number += 1
        next_player = (self.current_player_index + 1) % len(self.players)
        while not self.players[next_player].is_alive():
            next_player = (next_player + 1) % len(self.players)
        self.current_player_index = next_player
    
    def validate_action(self, action: Action) -> tuple[bool, str]:
        player = self.players[action.player_index]
        
        if player.coins >= 10:
            if action.action_type != ActionType.COUP:
                return False, "Must coup when you have 10+ coins"
        
        if action.action_type == ActionType.COUP:
            if player.coins < 7:
                return False, "Not enough coins to coup (need 7)"
            if action.target_index is None:
                return False, "Coup requires a target"
            if not self.players[action.target_index].is_alive():
                return False, "Cannot target eliminated player"
        
        if action.action_type == ActionType.ASSASSINATE:
            if player.coins < 3:
                return False, "Not enough coins to assassinate (need 3)"
            if action.target_index is None:
                return False, "Assassinate requires a target"
            if not self.players[action.target_index].is_alive():
                return False, "Cannot target eliminated player"
        
        if action.action_type == ActionType.STEAL:
            if action.target_index is None:
                return False, "Steal requires a target"
            if not self.players[action.target_index].is_alive():
                return False, "Cannot target eliminated player"
        
        return True, ""

    def execute_action(self, action: Action, challenged: bool = False, challenger_index: int = None,
                       blocked: bool = False, blocker_index: int = None, block_character: Character = None,
                       block_challenged: bool = False, block_challenger_index: int = None) -> dict:
        
        player = self.players[action.player_index]
        result = {
            "success": True,
            "action": action,
            "events": [],
            "needs_card_selection": False,
            "exchange_cards": None
        }
        
        valid, error = self.validate_action(action)
        if not valid:
            result["success"] = False
            result["error"] = error
            result["events"].append(self._log_event(
                "invalid_action", action.player_index,
                f"Invalid action: {error}"
            ))
            return result
        
        if action.action_type == ActionType.INCOME:
            player.coins += 1
            result["events"].append(self._log_event(
                "action", action.player_index,
                f"{player.name} takes Income (+1 coin, now has {player.coins})"
            ))
            return result
        
        if action.action_type == ActionType.COUP:
            player.coins -= 7
            target = self.players[action.target_index]
            result["events"].append(self._log_event(
                "action", action.player_index,
                f"{player.name} pays 7 coins to Coup {target.name}"
            ))
            result["needs_card_selection"] = True
            result["target_loses_influence"] = action.target_index
            return result
        
        if challenged:
            required_char = self.CHARACTER_ACTIONS.get(action.action_type)
            if required_char and required_char in player.cards:
                result["events"].append(self._log_event(
                    "challenge_failed", challenger_index,
                    f"{self.players[challenger_index].name} challenged {player.name} - FAILED! {player.name} reveals {required_char.value}"
                ))
                
                player.cards.remove(required_char)
                self.deck.append(required_char)
                random.shuffle(self.deck)
                player.cards.append(self.deck.pop())
                
                result["challenger_loses_influence"] = challenger_index
                result["needs_card_selection"] = True
            else:
                result["events"].append(self._log_event(
                    "challenge_success", challenger_index,
                    f"{self.players[challenger_index].name} challenged {player.name} - SUCCESS! {player.name} was bluffing"
                ))
                result["action_fails"] = True
                result["actor_loses_influence"] = action.player_index
                result["needs_card_selection"] = True
                result["success"] = False
                
                if action.action_type == ActionType.ASSASSINATE:
                    player.coins -= 3
                
                return result
        
        if blocked and not block_challenged:
            result["events"].append(self._log_event(
                "block", blocker_index,
                f"{self.players[blocker_index].name} blocks with {block_character.value}"
            ))
            result["success"] = False
            
            if action.action_type == ActionType.ASSASSINATE:
                player.coins -= 3
            
            return result
        
        if block_challenged:
            blocker = self.players[blocker_index]
            if block_character in blocker.cards:
                result["events"].append(self._log_event(
                    "block_challenge_failed", block_challenger_index,
                    f"{self.players[block_challenger_index].name} challenged the block - FAILED! {blocker.name} reveals {block_character.value}"
                ))
                
                blocker.cards.remove(block_character)
                self.deck.append(block_character)
                random.shuffle(self.deck)
                blocker.cards.append(self.deck.pop())
                
                result["block_challenger_loses_influence"] = block_challenger_index
                result["needs_card_selection"] = True
                result["success"] = False
                
                if action.action_type == ActionType.ASSASSINATE:
                    player.coins -= 3
                
                return result
            else:
                result["events"].append(self._log_event(
                    "block_challenge_success", block_challenger_index,
                    f"{self.players[block_challenger_index].name} challenged the block - SUCCESS! {blocker.name} was bluffing"
                ))
                result["blocker_loses_influence"] = blocker_index
                result["needs_card_selection"] = True
        
        if action.action_type == ActionType.FOREIGN_AID:
            player.coins += 2
            result["events"].append(self._log_event(
                "action", action.player_index,
                f"{player.name} takes Foreign Aid (+2 coins, now has {player.coins})"
            ))
        
        elif action.action_type == ActionType.TAX:
            player.coins += 3
            result["events"].append(self._log_event(
                "action", action.player_index,
                f"{player.name} uses Tax (Duke) (+3 coins, now has {player.coins})"
            ))
        
        elif action.action_type == ActionType.ASSASSINATE:
            player.coins -= 3
            target = self.players[action.target_index]
            result["events"].append(self._log_event(
                "action", action.player_index,
                f"{player.name} pays 3 coins to Assassinate {target.name}"
            ))
            result["needs_card_selection"] = True
            result["target_loses_influence"] = action.target_index
        
        elif action.action_type == ActionType.STEAL:
            target = self.players[action.target_index]
            steal_amount = min(2, target.coins)
            target.coins -= steal_amount
            player.coins += steal_amount
            result["events"].append(self._log_event(
                "action", action.player_index,
                f"{player.name} steals {steal_amount} coins from {target.name} (now has {player.coins})"
            ))
        
        elif action.action_type == ActionType.EXCHANGE:
            cards_to_draw = min(2, len(self.deck))
            draw_cards = [self.deck.pop() for _ in range(cards_to_draw)]
            original_hand_size = len(player.cards)
            all_cards = list(player.cards) + draw_cards
            player.cards = []
            result["events"].append(self._log_event(
                "action", action.player_index,
                f"{player.name} uses Exchange (Ambassador)"
            ))
            result["exchange_cards"] = all_cards
            result["needs_exchange_selection"] = True
            result["cards_to_keep"] = original_hand_size
        
        return result
    
    def apply_influence_loss(self, player_index: int, card_index: int = 0) -> Character:
        player = self.players[player_index]
        if card_index < len(player.cards):
            card = player.lose_influence(card_index)
            self._log_event(
                "lose_influence", player_index,
                f"{player.name} loses {card.value} (revealed)"
            )
            self.check_game_over()
            return card
        return None
    
    def apply_exchange(self, player_index: int, kept_card_indices: list[int], all_cards: list[Character]):
        player = self.players[player_index]
        new_hand = [all_cards[i] for i in kept_card_indices]
        returned_cards = [all_cards[i] for i in range(len(all_cards)) if i not in kept_card_indices]
        
        player.cards = new_hand
        self.deck.extend(returned_cards)
        random.shuffle(self.deck)
        
        self._log_event(
            "exchange_complete", player_index,
            f"{player.name} completes exchange"
        )
    
    def can_challenge_action(self, action: Action) -> bool:
        return action.action_type in self.CHARACTER_ACTIONS
    
    def can_block_action(self, action: Action) -> list[Character]:
        return self.ACTION_BLOCKERS.get(action.action_type, [])
    
    def get_game_summary(self) -> dict:
        return {
            "total_turns": self.turn_number,
            "winner": self.winner,
            "winner_name": self.players[self.winner].name if self.winner is not None else None,
            "winner_model": self.players[self.winner].model if self.winner is not None else None,
            "players": [{
                "name": p.name,
                "model": p.model,
                "final_coins": p.coins,
                "survived": p.is_alive(),
                "revealed_cards": [c.value for c in p.revealed_cards]
            } for p in self.players],
            "event_count": len(self.event_log)
        }
