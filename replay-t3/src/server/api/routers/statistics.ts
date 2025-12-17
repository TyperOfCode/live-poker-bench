import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { statisticsCache } from "~/server/cache";
import { loadFullTournament } from "~/server/data/loader";
import { calculateTournamentStatistics } from "~/server/statistics/tournamentStats";
import { calculateOverallStatistics } from "~/server/statistics/crossTournamentStats";
import type { TournamentStatistics, OverallStatistics } from "~/types";

export const statisticsRouter = createTRPCRouter({
  /**
   * Get tournament statistics (with caching)
   */
  tournament: publicProcedure
    .input(z.object({ tournamentId: z.string() }))
    .query(async ({ input }) => {
      const cacheKey = `stats:tournament:${input.tournamentId}`;

      // Check cache first
      const cached = await statisticsCache.get<TournamentStatistics>(cacheKey);
      if (cached) {
        return cached;
      }

      // Load and compute statistics
      const tournament = await loadFullTournament(input.tournamentId);
      const stats = await calculateTournamentStatistics(input.tournamentId, tournament);

      // Cache forever (immutable data)
      await statisticsCache.set(cacheKey, stats);

      return stats;
    }),

  /**
   * Get overall statistics across all tournaments (with caching)
   */
  overall: publicProcedure.query(async () => {
    const cacheKey = "stats:overall";

    // Check cache first
    const cached = await statisticsCache.get<OverallStatistics>(cacheKey);
    if (cached) {
      return cached;
    }

    // Compute overall statistics
    const stats = await calculateOverallStatistics();

    // Cache forever (immutable data)
    await statisticsCache.set(cacheKey, stats);

    return stats;
  }),

  /**
   * Clear statistics cache (for admin use when new tournaments are added)
   */
  clearCache: publicProcedure.mutation(async () => {
    await statisticsCache.clear();
    return { success: true };
  }),

  /**
   * Clear cache for a specific tournament
   */
  clearTournamentCache: publicProcedure
    .input(z.object({ tournamentId: z.string() }))
    .mutation(async ({ input }) => {
      await statisticsCache.del(`stats:tournament:${input.tournamentId}`);
      // Also clear overall stats since they depend on individual tournaments
      await statisticsCache.del("stats:overall");
      return { success: true };
    }),
});
