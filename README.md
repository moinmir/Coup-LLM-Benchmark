# Coup LLM Benchmark

A TypeScript/Next.js application for benchmarking LLM models playing the Coup card game. Built with the T3 Stack.

![Coup LLM Benchmark](https://img.shields.io/badge/T3%20Stack-Next.js%20%7C%20tRPC%20%7C%20Tailwind-purple)

## Overview

This benchmark tests different AI models' strategic reasoning and bluffing capabilities by having them play Coup against each other. The game engine enforces strict rules to prevent cheating, while comprehensive analytics track model performance.

## Features

- 🎮 **Complete Coup Implementation** - All game rules including bluffing, challenges, and blocks
- 🤖 **Multi-Model Support** - Test various LLMs via OpenRouter
- 👁️ **Truth View** - See hidden cards during games for debugging
- 📊 **Comprehensive Analytics** - Track win rates, bluff success, challenge accuracy
- 🛡️ **Anti-Cheat Engine** - Validates all actions, prevents illegal moves
- ⚡ **Real-time Updates** - Watch games unfold turn by turn

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (strict mode)
- **API**: tRPC for type-safe routes
- **Styling**: Tailwind CSS + shadcn/ui
- **Runtime**: Bun
- **LLM API**: OpenRouter

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) installed
- [OpenRouter API key](https://openrouter.ai/keys)

### Setup

```bash
# Clone the repository
git clone <repo-url>
cd coup-llm-benchmark

# Install dependencies
bun install

# Copy environment file and add your API key
cp .env.example .env
# Edit .env and add OPENROUTER_API_KEY

# Start development server
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENROUTER_API_KEY` | Yes | Your OpenRouter API key |
| `NODE_ENV` | No | Environment mode (development/production) |

## Available Scripts

```bash
bun run dev       # Start development server with Turbopack
bun run build     # Build for production
bun run start     # Start production server
bun run lint      # Run ESLint
bun run typecheck # Run TypeScript type checking
```

## Project Structure

```
src/
├── app/                    # Next.js pages
├── components/
│   ├── game/              # Game components
│   └── ui/                # shadcn/ui components
├── lib/
│   ├── game/              # Game engine
│   └── llm/               # LLM integration
├── server/api/            # tRPC routers
└── trpc/                  # tRPC client
```

## Available Models

Via OpenRouter:
- Meta Llama 3.3 70B / 3.1 8B
- Mistral Small 24B
- Qwen 2.5 72B / 7B
- DeepSeek Chat
- Google Gemini 2.0 Flash
- Microsoft Phi-4

## Documentation

See [AGENTS.md](./AGENTS.md) for detailed documentation including:
- Development guidelines
- Best practices
- Architecture decisions
- LLM benchmarking methodology

## License

MIT
