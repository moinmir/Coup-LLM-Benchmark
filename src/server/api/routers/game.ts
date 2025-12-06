/**
 * Game tRPC router - handles game API endpoints
 */

import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { GameRunner, AVAILABLE_MODELS, GAME_CONFIG } from "~/lib/game";
import { 
  GameStorage, 
  getRecentGames, 
  getGameById, 
  getGameTurns, 
  getGamePlayers,
  getAllAnalytics,
  clearAllGames,
} from "~/server/services/game-storage";

const activeGames = new Map<string, { runner: GameRunner; storage: GameStorage }>();

export const gameRouter = createTRPCRouter({
  getModels: publicProcedure.query(() => {
    return AVAILABLE_MODELS;
  }),

  getConfig: publicProcedure.query(() => {
    return GAME_CONFIG;
  }),

  createGame: publicProcedure
    .input(
      z.object({
        players: z.array(
          z.object({
            name: z.string().min(1),
            model: z.string().min(1),
          })
        ).min(GAME_CONFIG.MIN_PLAYERS).max(GAME_CONFIG.MAX_PLAYERS),
        maxTurns: z.number().min(50).max(500).default(GAME_CONFIG.DEFAULT_MAX_TURNS),
      })
    )
    .mutation(async ({ input }) => {
      const gameId = `game_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const runner = new GameRunner(input.players, input.maxTurns);
      const storage = new GameStorage(gameId);
      
      await storage.initGame(input.players);
      
      activeGames.set(gameId, { runner, storage });

      return {
        gameId,
        initialState: runner.getGame().getPublicGameState(),
        truthState: runner.getGame().getFullGameState(),
      };
    }),

  runTurn: publicProcedure
    .input(z.object({ gameId: z.string() }))
    .mutation(async ({ input }) => {
      const game = activeGames.get(input.gameId);
      if (!game) {
        throw new Error("Game not found");
      }

      const { runner, storage } = game;
      const gameStateBefore = runner.getGame().getFullGameState();

      try {
        const result = await runner.runTurn();
        const gameStateAfter = runner.getGame().getFullGameState();

        if (result.turnData) {
          await storage.saveTurn(result.turnData, gameStateBefore, gameStateAfter);
        }

        if (result.gameOver && result.summary) {
          await storage.finalizeGame(result.summary);
          activeGames.delete(input.gameId);
        }

        return result;
      } catch (error) {
        await storage.markError(error instanceof Error ? error.message : String(error));
        activeGames.delete(input.gameId);
        throw error;
      }
    }),

  getResults: publicProcedure.query(async () => {
    const recentGames = await getRecentGames(50);
    
    return recentGames.map(game => ({
      gameId: game.id,
      totalTurns: game.totalTurns ?? 0,
      winnerModel: game.winnerModel,
      winnerName: game.winnerModel?.split("/").pop() ?? null,
      startedAt: game.startedAt,
      endedAt: game.endedAt,
      players: [] as { model: string; finalCoins: number; survived: boolean; revealedCards: string[] }[],
      analytics: null,
    }));
  }),

  getAnalytics: publicProcedure.query(async () => {
    const { games: allGames, analytics } = await getAllAnalytics();
    
    const aggregated = {
      totalGames: allGames.length,
      bluffStats: {} as Record<string, { total: number; successful: number; caught: number }>,
      challengeStats: {} as Record<string, { total: number; successful: number }>,
      blockStats: {} as Record<string, { total: number; successful: number; bluffs: number }>,
      invalidActionStats: {} as Record<string, { total: number; types: string[] }>,
      actionCounts: {} as Record<string, number>,
    };

    for (const a of analytics) {
      const bluffs = JSON.parse(a.bluffStats) as Record<string, { total: number; successful: number; caught: number }>;
      const challenges = JSON.parse(a.challengeStats) as Record<string, { total: number; successful: number }>;
      const blocks = JSON.parse(a.blockStats) as Record<string, { total: number; successful: number; bluffs: number }>;
      const invalids = JSON.parse(a.invalidActionStats) as Record<string, { total: number; types: string[] }>;
      const actions = JSON.parse(a.actionCounts) as Record<string, number>;

      for (const [model, stats] of Object.entries(bluffs)) {
        aggregated.bluffStats[model] ??= { total: 0, successful: 0, caught: 0 };
        const target = aggregated.bluffStats[model];
        target.total += stats.total;
        target.successful += stats.successful;
        target.caught += stats.caught;
      }

      for (const [model, stats] of Object.entries(challenges)) {
        aggregated.challengeStats[model] ??= { total: 0, successful: 0 };
        const target = aggregated.challengeStats[model];
        target.total += stats.total;
        target.successful += stats.successful;
      }

      for (const [model, stats] of Object.entries(blocks)) {
        aggregated.blockStats[model] ??= { total: 0, successful: 0, bluffs: 0 };
        const target = aggregated.blockStats[model];
        target.total += stats.total;
        target.successful += stats.successful;
        target.bluffs += stats.bluffs;
      }

      for (const [model, stats] of Object.entries(invalids)) {
        aggregated.invalidActionStats[model] ??= { total: 0, types: [] };
        const target = aggregated.invalidActionStats[model];
        target.total += stats.total;
        for (const type of stats.types) {
          if (!target.types.includes(type)) {
            target.types.push(type);
          }
        }
      }

      for (const [key, count] of Object.entries(actions)) {
        aggregated.actionCounts[key] = (aggregated.actionCounts[key] ?? 0) + count;
      }
    }

    return aggregated;
  }),

  getGame: publicProcedure
    .input(z.object({ gameId: z.string() }))
    .query(async ({ input }) => {
      const game = await getGameById(input.gameId);
      if (!game) {
        throw new Error("Game not found");
      }

      const players = await getGamePlayers(input.gameId);
      const turns = await getGameTurns(input.gameId);

      return {
        game,
        players,
        turns: turns.map(t => ({
          ...t,
          events: JSON.parse(t.events) as string[],
          gameStateBefore: JSON.parse(t.gameStateBefore) as Record<string, unknown>,
          gameStateAfter: JSON.parse(t.gameStateAfter) as Record<string, unknown>,
        })),
      };
    }),

  getGameList: publicProcedure.query(async () => {
    const games = await getRecentGames(100);
    return games.map(g => ({
      id: g.id,
      startedAt: g.startedAt,
      endedAt: g.endedAt,
      totalTurns: g.totalTurns,
      winnerModel: g.winnerModel,
      winnerIndex: g.winnerIndex,
      status: g.status,
    }));
  }),

  clearResults: publicProcedure.mutation(async () => {
    await clearAllGames();
    return { success: true };
  }),

  deleteGame: publicProcedure
    .input(z.object({ gameId: z.string() }))
    .mutation(({ input }) => {
      activeGames.delete(input.gameId);
      return { success: true };
    }),
});
