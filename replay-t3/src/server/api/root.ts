import { tournamentRouter } from "~/server/api/routers/tournament";
import { statisticsRouter } from "~/server/api/routers/statistics";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * This is the primary router for the poker tournament replay server.
 */
export const appRouter = createTRPCRouter({
  tournament: tournamentRouter,
  statistics: statisticsRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 */
export const createCaller = createCallerFactory(appRouter);
