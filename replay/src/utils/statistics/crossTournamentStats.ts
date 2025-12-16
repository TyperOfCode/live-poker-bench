import type {
  TournamentStatistics,
  OverallStatistics,
  ModelAggregateStats,
  ModelRanking,
} from '../../types';
import { loadFullTournament } from '../../data/tournament';
import { calculateTournamentStatistics } from './tournamentStats';

/**
 * Calculate standard deviation
 */
function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(avgSquaredDiff);
}

/**
 * Initialize empty model aggregate stats
 */
function createEmptyModelStats(modelName: string): ModelAggregateStats {
  return {
    modelName,
    tournamentsPlayed: 0,
    wins: 0,
    avgPlacement: 0,
    placementDistribution: {},
    totalHandsPlayed: 0,
    totalHandsWon: 0,
    avgVpip: 0,
    avgPfr: 0,
    avgAggressionFactor: 0,
    avgThreeBetPercent: 0,
    avgWtsd: 0,
    avgWasd: 0,
    totalDecisions: 0,
    totalErrors: 0,
    avgInvalidActionRate: 0,
    avgEliminationHand: 0,
    eliminationHands: [],
  };
}

/**
 * Aggregate statistics from full tournament data
 */
export function aggregateFromFullStats(
  tournamentStats: TournamentStatistics[]
): OverallStatistics {
  const modelStats: Record<string, ModelAggregateStats> = {};
  const placements: Record<string, number[]> = {};

  // Collect per-model stats with weighted averages
  // We need to track totals for weighted averaging
  const modelWeightedSums: Record<string, {
    vpipSum: number;
    pfrSum: number;
    afSum: number;
    threeBetSum: number;
    wtsdSum: number;
    wasdSum: number;
    handsWeighted: number;
  }> = {};

  for (const stats of tournamentStats) {
    for (const agentStats of stats.agentStats) {
      const modelName = agentStats.agentName;

      if (!modelStats[modelName]) {
        modelStats[modelName] = createEmptyModelStats(modelName);
        placements[modelName] = [];
        modelWeightedSums[modelName] = {
          vpipSum: 0,
          pfrSum: 0,
          afSum: 0,
          threeBetSum: 0,
          wtsdSum: 0,
          wasdSum: 0,
          handsWeighted: 0,
        };
      }

      const model = modelStats[modelName];
      const sums = modelWeightedSums[modelName];

      model.tournamentsPlayed++;
      model.totalHandsPlayed += agentStats.handsPlayed;
      model.totalHandsWon += agentStats.handsWon;
      model.totalDecisions += agentStats.totalDecisions;
      model.totalErrors += agentStats.errorCount;

      if (agentStats.placement === 1) {
        model.wins++;
      }

      // Track placement distribution
      model.placementDistribution[agentStats.placement] =
        (model.placementDistribution[agentStats.placement] || 0) + 1;
      placements[modelName].push(agentStats.placement);

      // Weight poker stats by hands played for proper averaging
      const hands = agentStats.handsPlayed;
      if (hands > 0) {
        sums.vpipSum += agentStats.vpip * hands;
        sums.pfrSum += agentStats.pfr * hands;
        sums.afSum += agentStats.aggressionFactor * hands;
        sums.threeBetSum += agentStats.threeBetPercent * hands;
        sums.wtsdSum += agentStats.wtsd * hands;
        sums.wasdSum += agentStats.wasd * hands;
        sums.handsWeighted += hands;
      }
    }

    // Collect elimination data
    for (const elim of stats.eliminationOrder) {
      const model = modelStats[elim.agentName];
      if (model) {
        model.eliminationHands.push(elim.handNumber);
      }
    }
  }

  // Calculate final averages and rankings
  const rankings: ModelRanking[] = [];

  // Overall totals for cross-model aggregates
  let overallVpipSum = 0;
  let overallPfrSum = 0;
  let overallAfSum = 0;
  let overallWtsdSum = 0;
  let overallWasdSum = 0;
  let overallHandsTotal = 0;
  let overallHandsWon = 0;

  for (const [modelName, model] of Object.entries(modelStats)) {
    const sums = modelWeightedSums[modelName];
    const modelPlacements = placements[modelName] || [];

    // Calculate weighted averages for poker stats
    if (sums.handsWeighted > 0) {
      model.avgVpip = sums.vpipSum / sums.handsWeighted;
      model.avgPfr = sums.pfrSum / sums.handsWeighted;
      model.avgAggressionFactor = sums.afSum / sums.handsWeighted;
      model.avgThreeBetPercent = sums.threeBetSum / sums.handsWeighted;
      model.avgWtsd = sums.wtsdSum / sums.handsWeighted;
      model.avgWasd = sums.wasdSum / sums.handsWeighted;
    }

    // Calculate average placement
    model.avgPlacement =
      modelPlacements.length > 0
        ? modelPlacements.reduce((a, b) => a + b, 0) / modelPlacements.length
        : 0;

    // Calculate invalid action rate
    model.avgInvalidActionRate =
      model.totalDecisions > 0
        ? model.totalErrors / model.totalDecisions
        : 0;

    // Calculate average elimination hand
    if (model.eliminationHands.length > 0) {
      model.avgEliminationHand =
        model.eliminationHands.reduce((a, b) => a + b, 0) / model.eliminationHands.length;
    }

    // Accumulate overall stats
    overallVpipSum += sums.vpipSum;
    overallPfrSum += sums.pfrSum;
    overallAfSum += sums.afSum;
    overallWtsdSum += sums.wtsdSum;
    overallWasdSum += sums.wasdSum;
    overallHandsTotal += model.totalHandsPlayed;
    overallHandsWon += model.totalHandsWon;

    // Build ranking entry
    const consistency = standardDeviation(modelPlacements);
    const winRate =
      model.tournamentsPlayed > 0
        ? (model.wins / model.tournamentsPlayed) * 100
        : 0;

    rankings.push({
      modelName,
      avgPlacement: model.avgPlacement,
      winRate,
      tournamentsPlayed: model.tournamentsPlayed,
      consistency,
    });
  }

  // Sort rankings by average placement (lower is better)
  rankings.sort((a, b) => a.avgPlacement - b.avgPlacement);

  // Calculate overall averages
  const overallAvgVpip = overallHandsTotal > 0 ? overallVpipSum / overallHandsTotal : 0;
  const overallAvgPfr = overallHandsTotal > 0 ? overallPfrSum / overallHandsTotal : 0;
  const overallAvgAf = overallHandsTotal > 0 ? overallAfSum / overallHandsTotal : 0;
  const overallAvgWtsd = overallHandsTotal > 0 ? overallWtsdSum / overallHandsTotal : 0;
  const overallAvgWasd = overallHandsTotal > 0 ? overallWasdSum / overallHandsTotal : 0;

  return {
    tournamentsLoaded: tournamentStats.length,
    tournamentsTotal: tournamentStats.length,
    modelStats,
    rankings,
    overallAvgVpip,
    overallAvgPfr,
    overallAvgAf,
    overallAvgWtsd,
    overallAvgWasd,
    totalHandsPlayed: overallHandsTotal,
    totalHandsWon: overallHandsWon,
  };
}

/**
 * Calculate overall statistics from tournament IDs
 * Loads full tournament data for accurate poker metrics
 */
export async function calculateOverallStatistics(
  tournamentIds: string[],
  onProgress?: (loaded: number, total: number) => void
): Promise<OverallStatistics> {
  const allTournamentStats: TournamentStatistics[] = [];

  for (let i = 0; i < tournamentIds.length; i++) {
    const id = tournamentIds[i];
    try {
      const tournament = await loadFullTournament(id);
      const stats = await calculateTournamentStatistics(id, tournament);
      allTournamentStats.push(stats);
    } catch (e) {
      console.warn(`Failed to load tournament ${id}, skipping...`, e);
    }
    onProgress?.(i + 1, tournamentIds.length);
  }

  return aggregateFromFullStats(allTournamentStats);
}
