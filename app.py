import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from datetime import datetime
import time
import json

from game_engine import CoupGame, Character, ActionType
from llm_player import GameRunner, LLMPlayer

st.set_page_config(
    page_title="Coup LLM Benchmark",
    page_icon="🎭",
    layout="wide"
)

AVAILABLE_MODELS = [
    "meta-llama/llama-3.3-70b-instruct",
    "meta-llama/llama-3.1-8b-instruct",
    "mistralai/mistral-small-3.1-24b-instruct",
    "qwen/qwen-2.5-72b-instruct",
    "qwen/qwen-2.5-7b-instruct",
    "deepseek/deepseek-chat-v3-0324",
    "google/gemini-2.0-flash-001",
    "microsoft/phi-4",
]

if "experiment_results" not in st.session_state:
    st.session_state.experiment_results = []
if "current_game_log" not in st.session_state:
    st.session_state.current_game_log = []
if "game_running" not in st.session_state:
    st.session_state.game_running = False
if "total_games_played" not in st.session_state:
    st.session_state.total_games_played = 0


def run_single_game(player_configs: list[dict], game_placeholder, log_placeholder, max_turns: int = 100):
    runner = GameRunner(player_configs, max_turns=max_turns)
    game_log = []
    
    def on_turn_complete(result):
        for event in result.get("turn_events", []):
            game_log.append(event)
        
        with log_placeholder.container():
            st.markdown("### Game Log")
            log_text = "\n".join(game_log[-20:])
            st.text_area("Recent Events", log_text, height=200, disabled=True)
        
        with game_placeholder.container():
            display_game_state(result.get("game_state", {}))
    
    summary = runner.run_full_game(on_turn_complete=on_turn_complete)
    return summary, game_log


def display_game_state(game_state: dict):
    if not game_state:
        return
    
    st.markdown(f"**Turn {game_state.get('turn_number', 0)}**")
    
    cols = st.columns(len(game_state.get("players", [])))
    for i, (col, player) in enumerate(zip(cols, game_state.get("players", []))):
        with col:
            is_current = i == game_state.get("current_player_index", -1)
            alive = player.get("is_alive", False)
            
            border_color = "#4CAF50" if is_current and alive else ("#9E9E9E" if not alive else "#2196F3")
            bg_color = "#1a1a2e" if alive else "#2d2d2d"
            
            st.markdown(f"""
            <div style="
                border: 2px solid {border_color};
                border-radius: 10px;
                padding: 10px;
                background-color: {bg_color};
                text-align: center;
            ">
                <h4 style="margin: 0; color: {'#fff' if alive else '#888'};">{player.get('name', 'Player')}</h4>
                <p style="font-size: 0.8em; color: #888; margin: 5px 0;">{player.get('model', 'unknown').split('/')[-1][:20]}</p>
                <p style="font-size: 1.5em; margin: 5px 0;">💰 {player.get('coins', 0)}</p>
                <p style="margin: 5px 0;">{'❌ ELIMINATED' if not alive else f"🎴 {player.get('influence_count', 0)} influence"}</p>
                <p style="font-size: 0.8em; color: #f44336;">Revealed: {', '.join(player.get('revealed_cards', [])) or 'None'}</p>
            </div>
            """, unsafe_allow_html=True)


def display_results_dashboard():
    if not st.session_state.experiment_results:
        st.info("No experiment results yet. Run some games to see statistics!")
        return
    
    results_df = pd.DataFrame(st.session_state.experiment_results)
    
    st.markdown("## Overall Statistics")
    col1, col2, col3 = st.columns(3)
    
    with col1:
        st.metric("Total Games Played", len(results_df))
    with col2:
        avg_turns = results_df["total_turns"].mean()
        st.metric("Average Game Length", f"{avg_turns:.1f} turns")
    with col3:
        unique_winners = results_df["winner_model"].nunique()
        st.metric("Unique Winning Models", unique_winners)
    
    st.markdown("## Win Rates by Model")
    
    win_counts = results_df["winner_model"].value_counts().reset_index()
    win_counts.columns = ["Model", "Wins"]
    
    all_models = []
    for r in st.session_state.experiment_results:
        for p in r.get("players", []):
            all_models.append(p["model"])
    
    model_games = pd.Series(all_models).value_counts().reset_index()
    model_games.columns = ["Model", "Games Played"]
    
    stats_df = model_games.merge(win_counts, on="Model", how="left").fillna(0)
    stats_df["Win Rate"] = (stats_df["Wins"] / stats_df["Games Played"] * 100).round(1)
    stats_df = stats_df.sort_values("Win Rate", ascending=False)
    
    fig = px.bar(
        stats_df,
        x="Model",
        y="Win Rate",
        title="Win Rate by Model (%)",
        color="Win Rate",
        color_continuous_scale="viridis"
    )
    fig.update_layout(xaxis_tickangle=-45)
    st.plotly_chart(fig, use_container_width=True)
    
    st.markdown("## Detailed Statistics")
    display_df = stats_df.copy()
    display_df["Model"] = display_df["Model"].apply(lambda x: x.split("/")[-1] if "/" in x else x)
    st.dataframe(display_df, use_container_width=True)
    
    st.markdown("## Game Length Distribution")
    fig2 = px.histogram(
        results_df,
        x="total_turns",
        nbins=20,
        title="Distribution of Game Lengths (Turns)",
        labels={"total_turns": "Number of Turns"}
    )
    st.plotly_chart(fig2, use_container_width=True)
    
    st.markdown("## Recent Games")
    recent_games = results_df.tail(10)[["winner_name", "winner_model", "total_turns"]].copy()
    recent_games["winner_model"] = recent_games["winner_model"].apply(lambda x: x.split("/")[-1] if x and "/" in x else x)
    st.dataframe(recent_games, use_container_width=True)


def main():
    st.title("🎭 Coup LLM Benchmark")
    st.markdown("*Test different AI models against each other in the game of Coup*")
    
    tab1, tab2, tab3 = st.tabs(["🎮 Run Experiment", "📊 Results Dashboard", "📖 Game Rules"])
    
    with tab1:
        st.markdown("## Configure Experiment")
        
        col1, col2 = st.columns([1, 1])
        
        with col1:
            num_players = st.slider("Number of Players", min_value=3, max_value=6, value=4)
            num_games = st.slider("Number of Games", min_value=1, max_value=20, value=3)
            max_turns = st.slider("Max Turns per Game", min_value=50, max_value=200, value=100)
        
        with col2:
            st.markdown("### Player Configuration")
            player_configs = []
            
            for i in range(num_players):
                with st.expander(f"Player {i+1}", expanded=(i < 2)):
                    model = st.selectbox(
                        f"Model for Player {i+1}",
                        AVAILABLE_MODELS,
                        index=i % len(AVAILABLE_MODELS),
                        key=f"model_{i}"
                    )
                    name = st.text_input(
                        f"Name for Player {i+1}",
                        value=f"Player {i+1}",
                        key=f"name_{i}"
                    )
                    player_configs.append({"model": model, "name": name})
        
        st.markdown("---")
        
        col_btn1, col_btn2 = st.columns(2)
        
        with col_btn1:
            run_button = st.button("🚀 Run Experiment", type="primary", use_container_width=True)
        
        with col_btn2:
            if st.button("🗑️ Clear Results", use_container_width=True):
                st.session_state.experiment_results = []
                st.session_state.total_games_played = 0
                st.rerun()
        
        if run_button:
            st.markdown("---")
            st.markdown("## Experiment Progress")
            
            progress_bar = st.progress(0)
            status_text = st.empty()
            
            game_placeholder = st.empty()
            log_placeholder = st.empty()
            
            for game_num in range(num_games):
                status_text.markdown(f"**Running Game {game_num + 1} of {num_games}...**")
                progress_bar.progress((game_num) / num_games)
                
                try:
                    summary, game_log = run_single_game(
                        player_configs,
                        game_placeholder,
                        log_placeholder,
                        max_turns=max_turns
                    )
                    
                    st.session_state.experiment_results.append(summary)
                    st.session_state.total_games_played += 1
                    
                except Exception as e:
                    st.error(f"Error in game {game_num + 1}: {str(e)}")
                    continue
                
                time.sleep(0.5)
            
            progress_bar.progress(1.0)
            status_text.markdown("**✅ Experiment Complete!**")
            
            if st.session_state.experiment_results:
                last_result = st.session_state.experiment_results[-1]
                st.success(f"Last game winner: {last_result.get('winner_name', 'Unknown')} ({last_result.get('winner_model', 'Unknown').split('/')[-1]})")
    
    with tab2:
        display_results_dashboard()
    
    with tab3:
        st.markdown("""
        ## Coup Game Rules
        
        Coup is a bluffing card game where players try to eliminate each other by making claims about the character cards they hold.
        
        ### Setup
        - Each player starts with **2 coins** and **2 face-down character cards** (influence)
        - There are **5 characters** with 3 copies each in the deck
        
        ### Characters & Abilities
        
        | Character | Action | Block Ability |
        |-----------|--------|---------------|
        | **Duke** | Tax (take 3 coins) | Block Foreign Aid |
        | **Assassin** | Assassinate (pay 3 coins, target loses influence) | — |
        | **Captain** | Steal (take 2 coins from player) | Block stealing |
        | **Ambassador** | Exchange (draw 2, swap any) | Block stealing |
        | **Contessa** | — | Block assassination |
        
        ### Actions
        
        **General Actions** (no character needed):
        1. **Income** – Take 1 coin (cannot be blocked/challenged)
        2. **Foreign Aid** – Take 2 coins (can be blocked by Duke)
        3. **Coup** – Pay 7 coins, target loses influence (MANDATORY with 10+ coins)
        
        **Character Actions** (require claiming a character):
        4. **Tax** (Duke) – Take 3 coins
        5. **Assassinate** (Assassin) – Pay 3 coins, target loses influence
        6. **Steal** (Captain) – Take 2 coins from a player
        7. **Exchange** (Ambassador) – Draw 2 cards, swap with your hand
        
        ### Bluffing & Challenges
        
        - **You can bluff!** Claim any character action even without the card
        - **Challenges**: Any player can challenge a claim
          - If challenged and you HAVE the card: Challenger loses influence
          - If challenged and BLUFFING: You lose influence, action fails
        - **Blocks** can also be challenged
        
        ### Winning
        
        Last player with at least one unrevealed card wins!
        """)


if __name__ == "__main__":
    main()
