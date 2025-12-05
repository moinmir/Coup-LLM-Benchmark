# Coup LLM Benchmark

A Python-based game engine for the Coup card game that allows different LLM models to play against each other, with a Streamlit UI for running experiments and viewing results.

## Overview

This project implements the complete Coup card game rules and allows AI models (via OpenRouter) to compete against each other. It's designed as a benchmark to compare different LLM models' strategic reasoning and bluffing capabilities.

## Project Structure

- `app.py` - Streamlit UI for configuring and running experiments
- `game_engine.py` - Core Coup game mechanics (characters, actions, challenges, blocks)
- `llm_player.py` - LLM player interface using OpenRouter for AI decision-making

## Features

- Complete Coup game rules implementation
- Support for 3-6 LLM players with configurable models
- Real-time game visualization
- Results dashboard with win rates and statistics
- Model comparison charts

## Game Rules Implemented

### Characters
- Duke: Tax (3 coins), Block Foreign Aid
- Assassin: Assassinate (pay 3 coins)
- Captain: Steal (2 coins), Block Stealing
- Ambassador: Exchange cards, Block Stealing
- Contessa: Block Assassination

### Actions
- Income: Take 1 coin (cannot be challenged/blocked)
- Foreign Aid: Take 2 coins (blocked by Duke)
- Coup: Pay 7 coins, mandatory with 10+ coins
- Character-specific actions with bluffing

### Mechanics
- Challenges: Any player can challenge claims
- Blocks: Targeted actions can be blocked
- Influence: Players start with 2 cards, lose influence when caught bluffing

## Running the Application

The app runs on port 5000 using Streamlit:
```
streamlit run app.py --server.port 5000
```

## Available Models

The benchmark supports various models through OpenRouter including:
- Meta Llama 3.3 70B
- Mistral Small 24B
- Qwen 2.5 72B/7B
- DeepSeek Chat
- Google Gemini 2.0 Flash
- Microsoft Phi-4

## Technical Notes

- Uses Replit AI Integrations for OpenRouter access (no API key needed)
- Charges billed to Replit credits
- Includes retry logic with exponential backoff for rate limiting
