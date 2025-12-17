import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import {
  listTournaments,
  loadTournamentMeta,
  loadTournamentResults,
  loadHandData,
  loadAgentData,
  getHandCount,
  loadFullTournament,
} from "~/server/data/loader";

export const tournamentRouter = createTRPCRouter({
  /**
   * List all available tournament IDs
   */
  list: publicProcedure.query(async () => {
    return await listTournaments();
  }),

  /**
   * Get tournament metadata
   */
  getMeta: publicProcedure
    .input(z.object({ tournamentId: z.string() }))
    .query(async ({ input }) => {
      return await loadTournamentMeta(input.tournamentId);
    }),

  /**
   * Get tournament results
   */
  getResults: publicProcedure
    .input(z.object({ tournamentId: z.string() }))
    .query(async ({ input }) => {
      return await loadTournamentResults(input.tournamentId);
    }),

  /**
   * Get total hand count for a tournament
   */
  getHandCount: publicProcedure
    .input(z.object({ tournamentId: z.string() }))
    .query(async ({ input }) => {
      return await getHandCount(input.tournamentId);
    }),

  /**
   * Get full tournament state (meta + results + eliminations)
   */
  getFull: publicProcedure
    .input(z.object({ tournamentId: z.string() }))
    .query(async ({ input }) => {
      return await loadFullTournament(input.tournamentId);
    }),

  /**
   * Get hand data for a specific hand
   */
  getHand: publicProcedure
    .input(
      z.object({
        tournamentId: z.string(),
        handNumber: z.number().int().positive(),
      })
    )
    .query(async ({ input }) => {
      const [hand, agent] = await Promise.all([
        loadHandData(input.tournamentId, input.handNumber),
        loadAgentData(input.tournamentId, input.handNumber),
      ]);
      return { hand, agent };
    }),
});
