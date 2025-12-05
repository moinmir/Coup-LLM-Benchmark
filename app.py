import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from datetime import datetime
import time
import json
import io

from game_engine import CoupGame, Character, ActionType
from llm_player import GameRunner, LLMPlayer, GameAnalytics

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
if "game_replays" not in st.session_state:
    st.session_state.game_replays = []
if "tournament_results" not in st.session_state:
    st.session_state.tournament_results = []


def run_single_game(player_configs: list[dict], game_placeholder, log_placeholder, max_turns: int = 100):
    runner = GameRunner(player_configs, max_turns=max_turns)
    game_log = []
    turn_history = []
    
    def on_turn_complete(result):
        for event in result.get("turn_events", []):
            game_log.append(event)
        
        if result.get("turn_data"):
            turn_history.append(result["turn_data"])
        
        with log_placeholder.container():
            st.markdown("### Game Log")
            log_text = "\n".join(game_log[-20:])
            st.text_area("Recent Events", log_text, height=200, disabled=True)
        
        with game_placeholder.container():
            display_game_state(result.get("game_state", {}))
    
    summary = runner.run_full_game(on_turn_complete=on_turn_complete)
    
    replay_data = {
        "timestamp": datetime.now().isoformat(),
        "players": player_configs,
        "summary": summary,
        "turn_history": turn_history,
        "game_log": game_log
    }
    st.session_state.game_replays.append(replay_data)
    
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


def display_strategy_analysis():
    if not st.session_state.experiment_results:
        st.info("No experiment results yet. Run some games to see strategy analysis!")
        return
    
    st.markdown("## Strategy Analysis")
    
    all_bluff_stats = {}
    all_challenge_stats = {}
    all_block_stats = {}
    all_action_counts = {}
    
    for result in st.session_state.experiment_results:
        analytics = result.get("analytics", {})
        
        for model, stats in analytics.get("bluff_stats", {}).items():
            if model not in all_bluff_stats:
                all_bluff_stats[model] = {"total": 0, "successful": 0, "caught": 0}
            all_bluff_stats[model]["total"] += stats.get("total", 0)
            all_bluff_stats[model]["successful"] += stats.get("successful", 0)
            all_bluff_stats[model]["caught"] += stats.get("caught", 0)
        
        for model, stats in analytics.get("challenge_stats", {}).items():
            if model not in all_challenge_stats:
                all_challenge_stats[model] = {"total": 0, "successful": 0}
            all_challenge_stats[model]["total"] += stats.get("total", 0)
            all_challenge_stats[model]["successful"] += stats.get("successful", 0)
        
        for model, stats in analytics.get("block_stats", {}).items():
            if model not in all_block_stats:
                all_block_stats[model] = {"total": 0, "successful": 0, "bluffs": 0}
            all_block_stats[model]["total"] += stats.get("total", 0)
            all_block_stats[model]["successful"] += stats.get("successful", 0)
            all_block_stats[model]["bluffs"] += stats.get("bluffs", 0)
        
        for key, count in analytics.get("action_counts", {}).items():
            if key not in all_action_counts:
                all_action_counts[key] = 0
            all_action_counts[key] += count
    
    st.markdown("### Bluff Success Rates")
    if all_bluff_stats:
        bluff_data = []
        for model, stats in all_bluff_stats.items():
            success_rate = (stats["successful"] / stats["total"] * 100) if stats["total"] > 0 else 0
            caught_rate = (stats["caught"] / stats["total"] * 100) if stats["total"] > 0 else 0
            bluff_data.append({
                "Model": model.split("/")[-1] if "/" in model else model,
                "Full Model": model,
                "Total Bluffs": stats["total"],
                "Successful": stats["successful"],
                "Caught": stats["caught"],
                "Success Rate (%)": round(success_rate, 1),
                "Caught Rate (%)": round(caught_rate, 1)
            })
        
        bluff_df = pd.DataFrame(bluff_data)
        if not bluff_df.empty:
            fig = px.bar(bluff_df, x="Model", y="Success Rate (%)", 
                        title="Bluff Success Rate by Model",
                        color="Success Rate (%)", color_continuous_scale="RdYlGn")
            st.plotly_chart(fig, use_container_width=True)
            st.dataframe(bluff_df[["Model", "Total Bluffs", "Successful", "Caught", "Success Rate (%)", "Caught Rate (%)"]], 
                        use_container_width=True)
    else:
        st.info("No bluff data available yet.")
    
    st.markdown("### Challenge Accuracy")
    if all_challenge_stats:
        challenge_data = []
        for model, stats in all_challenge_stats.items():
            accuracy = (stats["successful"] / stats["total"] * 100) if stats["total"] > 0 else 0
            challenge_data.append({
                "Model": model.split("/")[-1] if "/" in model else model,
                "Full Model": model,
                "Total Challenges": stats["total"],
                "Successful": stats["successful"],
                "Accuracy (%)": round(accuracy, 1)
            })
        
        challenge_df = pd.DataFrame(challenge_data)
        if not challenge_df.empty:
            fig = px.bar(challenge_df, x="Model", y="Accuracy (%)", 
                        title="Challenge Accuracy by Model",
                        color="Accuracy (%)", color_continuous_scale="RdYlGn")
            st.plotly_chart(fig, use_container_width=True)
            st.dataframe(challenge_df[["Model", "Total Challenges", "Successful", "Accuracy (%)"]], 
                        use_container_width=True)
    else:
        st.info("No challenge data available yet.")
    
    st.markdown("### Block Statistics")
    if all_block_stats:
        block_data = []
        for model, stats in all_block_stats.items():
            success_rate = (stats["successful"] / stats["total"] * 100) if stats["total"] > 0 else 0
            bluff_rate = (stats["bluffs"] / stats["total"] * 100) if stats["total"] > 0 else 0
            block_data.append({
                "Model": model.split("/")[-1] if "/" in model else model,
                "Total Blocks": stats["total"],
                "Successful": stats["successful"],
                "Bluff Blocks": stats["bluffs"],
                "Success Rate (%)": round(success_rate, 1),
                "Bluff Rate (%)": round(bluff_rate, 1)
            })
        
        block_df = pd.DataFrame(block_data)
        if not block_df.empty:
            st.dataframe(block_df, use_container_width=True)
    else:
        st.info("No block data available yet.")
    
    st.markdown("### Action Distribution")
    if all_action_counts:
        action_data = []
        for key, count in all_action_counts.items():
            parts = key.split("|")
            if len(parts) == 2:
                model, action = parts
                action_data.append({
                    "Model": model.split("/")[-1] if "/" in model else model,
                    "Action": action,
                    "Count": count
                })
        
        if action_data:
            action_df = pd.DataFrame(action_data)
            pivot_df = action_df.pivot_table(index="Model", columns="Action", values="Count", fill_value=0)
            
            fig = px.imshow(pivot_df, 
                           title="Action Heatmap by Model",
                           labels=dict(x="Action", y="Model", color="Count"),
                           color_continuous_scale="Blues")
            st.plotly_chart(fig, use_container_width=True)


def display_tournament_mode():
    st.markdown("## Tournament Mode")
    st.markdown("Run bracket-style elimination tournaments between different models.")
    
    col1, col2 = st.columns([1, 1])
    
    with col1:
        st.markdown("### Select Models for Tournament")
        selected_models = st.multiselect(
            "Choose models (4+ recommended)",
            AVAILABLE_MODELS,
            default=AVAILABLE_MODELS[:4]
        )
        
        games_per_match = st.slider("Games per match", 1, 5, 3)
        max_turns = st.slider("Max turns per game", 50, 200, 100)
    
    with col2:
        st.markdown("### Tournament Settings")
        if len(selected_models) < 2:
            st.warning("Select at least 2 models for a tournament")
        else:
            st.info(f"Tournament with {len(selected_models)} models")
            st.info(f"Each match: Best of {games_per_match} games")
    
    if st.button("Start Tournament", type="primary", disabled=len(selected_models) < 2):
        run_tournament(selected_models, games_per_match, max_turns)
    
    if st.session_state.tournament_results:
        st.markdown("### Tournament History")
        for i, tournament in enumerate(st.session_state.tournament_results):
            with st.expander(f"Tournament {i+1} - Winner: {tournament.get('winner', 'Unknown').split('/')[-1]}"):
                st.json(tournament)


def run_tournament(models: list, games_per_match: int, max_turns: int):
    st.markdown("### Tournament Progress")
    
    import random
    participants = models.copy()
    random.shuffle(participants)
    
    round_num = 1
    results = {"rounds": [], "winner": None}
    
    while len(participants) > 1:
        st.markdown(f"#### Round {round_num}")
        round_results = []
        next_round = []
        
        for i in range(0, len(participants), 2):
            if i + 1 >= len(participants):
                next_round.append(participants[i])
                st.info(f"{participants[i].split('/')[-1]} gets a bye")
                continue
            
            model_a = participants[i]
            model_b = participants[i + 1]
            
            st.markdown(f"**Match: {model_a.split('/')[-1]} vs {model_b.split('/')[-1]}**")
            
            wins_a = 0
            wins_b = 0
            
            progress = st.progress(0)
            
            for game_num in range(games_per_match):
                progress.progress((game_num) / games_per_match)
                
                player_configs = [
                    {"model": model_a, "name": "Player A"},
                    {"model": model_b, "name": "Player B"},
                    {"model": model_a, "name": "Player C"},
                    {"model": model_b, "name": "Player D"}
                ]
                
                try:
                    runner = GameRunner(player_configs, max_turns=max_turns)
                    summary = runner.run_full_game()
                    
                    if summary.get("winner_model") == model_a:
                        wins_a += 1
                    else:
                        wins_b += 1
                except Exception as e:
                    st.error(f"Game error: {str(e)}")
            
            progress.progress(1.0)
            
            winner = model_a if wins_a > wins_b else model_b
            next_round.append(winner)
            
            round_results.append({
                "model_a": model_a,
                "model_b": model_b,
                "wins_a": wins_a,
                "wins_b": wins_b,
                "winner": winner
            })
            
            st.success(f"Winner: {winner.split('/')[-1]} ({wins_a}-{wins_b})")
        
        results["rounds"].append({"round": round_num, "matches": round_results})
        participants = next_round
        round_num += 1
    
    if participants:
        results["winner"] = participants[0]
        st.balloons()
        st.success(f"🏆 Tournament Winner: {participants[0].split('/')[-1]}")
    
    st.session_state.tournament_results.append(results)


def display_game_replay():
    st.markdown("## Game Replay")
    
    if not st.session_state.game_replays:
        st.info("No game replays available. Play some games first!")
        return
    
    replay_options = [f"Game {i+1} - {r['timestamp'][:19]} - Winner: {r['summary'].get('winner_name', 'Unknown')}" 
                     for i, r in enumerate(st.session_state.game_replays)]
    
    selected_replay = st.selectbox("Select a game to replay", replay_options)
    
    if selected_replay:
        replay_idx = replay_options.index(selected_replay)
        replay = st.session_state.game_replays[replay_idx]
        
        st.markdown("### Game Summary")
        col1, col2, col3 = st.columns(3)
        with col1:
            st.metric("Winner", replay["summary"].get("winner_name", "Unknown"))
        with col2:
            st.metric("Total Turns", replay["summary"].get("total_turns", 0))
        with col3:
            winner_model = replay["summary"].get("winner_model", "Unknown")
            st.metric("Winning Model", winner_model.split("/")[-1] if "/" in winner_model else winner_model)
        
        st.markdown("### Players")
        player_cols = st.columns(len(replay["players"]))
        for i, (col, player) in enumerate(zip(player_cols, replay["players"])):
            with col:
                model_short = player["model"].split("/")[-1] if "/" in player["model"] else player["model"]
                st.markdown(f"**{player['name']}**")
                st.caption(model_short)
        
        st.markdown("### Turn-by-Turn Replay")
        
        turn_history = replay.get("turn_history", [])
        
        if turn_history:
            turn_num = st.slider("Select Turn", 1, len(turn_history), 1)
            
            turn = turn_history[turn_num - 1]
            
            st.markdown(f"**Turn {turn['turn']}**: {turn['player']}")
            st.markdown(f"- Action: **{turn.get('action', 'Unknown')}**")
            if turn.get("target") is not None:
                st.markdown(f"- Target: Player {turn['target']}")
            st.markdown(f"- Challenged: {'Yes' if turn.get('challenged') else 'No'}")
            st.markdown(f"- Blocked: {'Yes' if turn.get('blocked') else 'No'}")
            st.markdown(f"- Success: {'Yes' if turn.get('result_success') else 'No'}")
            
            with st.expander("Turn Events"):
                for event in turn.get("events", []):
                    st.text(event)
        
        st.markdown("### Full Game Log")
        with st.expander("View Complete Log"):
            for event in replay.get("game_log", []):
                st.text(event)


def display_export():
    st.markdown("## Export Data")
    
    if not st.session_state.experiment_results:
        st.info("No experiment results to export. Run some games first!")
        return
    
    st.markdown("### Export Options")
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.markdown("#### JSON Export")
        export_data = {
            "export_date": datetime.now().isoformat(),
            "total_games": len(st.session_state.experiment_results),
            "results": st.session_state.experiment_results
        }
        
        json_str = json.dumps(export_data, indent=2, default=str)
        st.download_button(
            label="Download JSON",
            data=json_str,
            file_name=f"coup_benchmark_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json",
            mime="application/json"
        )
    
    with col2:
        st.markdown("#### CSV Export")
        
        csv_data = []
        for result in st.session_state.experiment_results:
            row = {
                "winner_name": result.get("winner_name"),
                "winner_model": result.get("winner_model"),
                "total_turns": result.get("total_turns"),
                "event_count": result.get("event_count")
            }
            
            for i, player in enumerate(result.get("players", [])):
                row[f"player_{i+1}_name"] = player.get("name")
                row[f"player_{i+1}_model"] = player.get("model")
                row[f"player_{i+1}_survived"] = player.get("survived")
            
            csv_data.append(row)
        
        csv_df = pd.DataFrame(csv_data)
        csv_str = csv_df.to_csv(index=False)
        
        st.download_button(
            label="Download CSV",
            data=csv_str,
            file_name=f"coup_benchmark_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
            mime="text/csv"
        )
    
    st.markdown("### Data Preview")
    
    with st.expander("View Raw Results"):
        st.json(st.session_state.experiment_results[-5:] if len(st.session_state.experiment_results) > 5 else st.session_state.experiment_results)


def main():
    st.title("🎭 Coup LLM Benchmark")
    st.markdown("*Test different AI models against each other in the game of Coup*")
    
    tabs = st.tabs([
        "🎮 Run Experiment", 
        "📊 Results Dashboard", 
        "🧠 Strategy Analysis",
        "🏆 Tournament Mode",
        "🔄 Game Replay",
        "📤 Export Data",
        "📖 Game Rules"
    ])
    
    with tabs[0]:
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
                st.session_state.game_replays = []
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
    
    with tabs[1]:
        display_results_dashboard()
    
    with tabs[2]:
        display_strategy_analysis()
    
    with tabs[3]:
        display_tournament_mode()
    
    with tabs[4]:
        display_game_replay()
    
    with tabs[5]:
        display_export()
    
    with tabs[6]:
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
