# Coup LLM Benchmark

A TypeScript/Next.js application for benchmarking LLM models playing the Coup card game. Built with the T3 Stack (Next.js, tRPC, Tailwind CSS) and shadcn/ui.

## Project Overview

This benchmark tests LLM models' strategic reasoning and bluffing capabilities by having them play Coup against each other. The game engine enforces strict rules to prevent cheating, and comprehensive analytics track model performance.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (strict mode)
- **API**: tRPC for type-safe API routes
- **Styling**: Tailwind CSS + shadcn/ui
- **Runtime**: Bun (for faster installs and scripts)
- **LLM API**: OpenRouter (supports multiple model providers)

## Project Structure

```
├── src/
│   ├── app/                    # Next.js app router pages
│   │   ├── _components/        # Page-specific components
│   │   ├── layout.tsx          # Root layout
│   │   └── page.tsx            # Main page
│   ├── components/
│   │   ├── game/               # Game-specific components
│   │   │   ├── player-card.tsx
│   │   │   ├── game-board.tsx
│   │   │   ├── game-log.tsx
│   │   │   └── truth-panel.tsx
│   │   └── ui/                 # shadcn/ui components
│   ├── lib/
│   │   ├── game/               # Core game logic
│   │   │   ├── types.ts        # Type definitions
│   │   │   ├── constants.ts    # Game constants
│   │   │   ├── engine.ts       # Game engine
│   │   │   └── runner.ts       # Game runner
│   │   ├── llm/                # LLM integration
│   │   │   ├── prompts.ts      # Prompt templates
│   │   │   ├── openrouter.ts   # OpenRouter client
│   │   │   └── player.ts       # LLM player class
│   │   └── utils.ts            # Utility functions
│   ├── server/
│   │   └── api/                # tRPC API routes
│   │       ├── routers/
│   │       │   └── game.ts     # Game API router
│   │       ├── root.ts         # Root router
│   │       └── trpc.ts         # tRPC setup
│   ├── trpc/                   # tRPC client setup
│   ├── styles/                 # Global styles
│   └── env.js                  # Environment validation
├── public/                     # Static assets
├── package.json
└── tsconfig.json
```

## Development Rules

### Package Management
- **Use Bun exclusively** for package management
- Install: `bun install`
- Add package: `bun add <package>`
- Run scripts: `bun run <script>`
- Dev server: `bun run dev`

### Environment Variables
- Copy `.env.example` to `.env`
- Required: `OPENROUTER_API_KEY` from https://openrouter.ai/keys
- Environment validation via `@t3-oss/env-nextjs`

### Running the Application
```bash
bun install
bun run dev     # Start dev server on port 3000
bun run build   # Production build
bun run start   # Production server
```

## T3 Stack Best Practices

### TypeScript
- **Strict mode enabled** - catch errors early
- **Never use `any`** - always define proper types
- **Use discriminated unions** for action types
- **Prefer interfaces over type aliases** for extensibility

### tRPC
- **End-to-end type safety** - types flow from server to client
- **Use Zod for input validation** - runtime validation with TypeScript inference
- **Procedures should be small and focused** - single responsibility
- **Use mutations for state changes** - queries for reads

### Component Structure
- **Server Components by default** - only use `"use client"` when needed
- **Colocate components with their pages** - `_components` folder
- **Separate business logic from UI** - use custom hooks
- **Keep components small and focused**

### State Management
- **Server state via tRPC/React Query** - caching built-in
- **Local state via useState** - keep it minimal
- **Avoid global client state** - use server state instead

## LLM Benchmarking Best Practices

### Evaluation Principles

1. **Reproducibility**
   - Log all prompts and responses
   - Record random seeds where applicable
   - Version control benchmark configurations

2. **Fairness**
   - Same game conditions for all models
   - Randomize player order
   - Multiple games per model pair

3. **Comprehensive Metrics**
   - Win rate (primary metric)
   - Bluff success rate
   - Challenge accuracy
   - Block effectiveness
   - Invalid action attempts (game engine integrity)

4. **Anti-Cheating Measures**
   - Game engine validates ALL actions
   - Models only see public game state
   - Hidden cards never exposed to wrong players
   - Invalid actions tracked as metric

### Prompt Engineering
- **Clear instructions** - explicit format requirements
- **Few-shot examples** - show expected response format
- **Structured output** - easy to parse programmatically
- **Game context** - provide relevant rules and state

### Statistical Validity
- Run **multiple games** per configuration (minimum 10)
- Track **confidence intervals** for metrics
- **Control for variance** - same opponents across models
- Report **both mean and distribution** of results

## Game Engine Architecture

### Core Principles

1. **Immutable State** - game state changes return new objects
2. **Strict Validation** - all actions validated before execution
3. **Complete Logging** - every event recorded for audit
4. **Separation of Concerns** - engine, player, runner are separate

### Anti-Cheating Design

```typescript
// Players only see public state
getPublicGameState(forPlayerIndex?: number): PublicGameState

// Hidden cards only in full state (for debugging/truth view)
getFullGameState(): GameState

// All actions validated
validateAction(action: Action): { valid: boolean; error?: string }
```

### Event Flow

1. Player receives public game state
2. Engine provides valid action list
3. LLM chooses action
4. Engine validates action
5. Other players get challenge opportunity
6. Target gets block opportunity
7. Block can be challenged
8. Action executes (or fails)
9. Influence losses processed
10. Turn advances

## UI/UX Guidelines

### shadcn/ui Design System

- **Dark theme** - zinc color palette
- **Accent colors** - violet/purple for primary actions
- **Status colors**:
  - Emerald: success, alive, valid
  - Amber: warning, coins, blocks
  - Red: danger, challenges, eliminated
- **Consistent spacing** - use Tailwind's spacing scale

### Game Visualization

- **Truth View** - always visible for debugging
- **Player Cards** - show coins, influence, revealed cards
- **Current Player** - highlighted border + indicator
- **Game Log** - color-coded by event type
- **Real-time Updates** - progressive disclosure during turns

### Accessibility
- Semantic HTML elements
- Keyboard navigation support
- Color not sole indicator (use icons)
- Screen reader friendly

## Analytics Tracked

| Metric | Description |
|--------|-------------|
| **Win Rate** | Games won / games played |
| **Bluff Success** | Uncontested bluffs / total bluffs |
| **Caught Rate** | Times caught bluffing / bluff attempts |
| **Challenge Accuracy** | Correct challenges / total challenges |
| **Block Success** | Effective blocks / total blocks |
| **Invalid Actions** | Attempted illegal moves (engine integrity check) |
| **Action Distribution** | Heatmap of actions by model |

## Available Models

Via OpenRouter API:
- Meta Llama 3.3 70B
- Meta Llama 3.1 8B
- Mistral Small 24B
- Qwen 2.5 72B/7B
- DeepSeek Chat
- Google Gemini 2.0 Flash
- Microsoft Phi-4

## Key Learnings & Decisions

### Why T3 Stack?
- **Type safety end-to-end** - fewer runtime errors
- **Modern React patterns** - Server Components, App Router
- **Great DX** - fast iteration with Turbopack
- **Production ready** - Vercel deployment optimized

### Why Bun?
- **Faster installs** - significant speedup over npm
- **Built-in TypeScript** - no separate compilation step
- **Compatible** - drop-in replacement for npm/yarn
- **Note**: Used for package management; Next.js still runs on Node

### Why tRPC over REST?
- **No API schema to maintain** - types are the contract
- **Automatic type inference** - full IDE support
- **React Query built-in** - caching, mutations handled
- **Simpler testing** - call procedures directly

### Why shadcn/ui?
- **Copy-paste components** - own the code, not the package
- **Tailwind native** - consistent with rest of stack
- **Accessible by default** - Radix UI primitives
- **Easy customization** - just edit the files

## Future Improvements

- [ ] Database persistence (Drizzle + SQLite/Postgres)
- [ ] Tournament mode
- [ ] Game replay system
- [ ] Multi-user support
- [ ] ELO rating system
- [ ] Prompt optimization experiments
- [ ] LLM-as-Judge evaluation
