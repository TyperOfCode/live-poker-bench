import type { TournamentState, TournamentMeta, TournamentResults, Elimination } from '../types';
import { loadTournamentMeta, loadTournamentResults } from './loader';

function deriveEliminations(results: TournamentResults): Elimination[] {
  // Players eliminated in reverse placement order (last place first)
  return Object.entries(results.placements)
    .filter(([, placement]) => placement > 1) // Everyone except 1st
    .sort((a, b) => b[1] - a[1]) // Sort by placement descending (5th, 4th, 3rd, 2nd)
    .map(([name, placement]) => ({
      handNumber: 0, // Would need to scan hands to get exact elimination hand
      playerName: name,
      placementFinish: placement,
    }));
}

export async function loadFullTournament(
  tournamentId: string
): Promise<TournamentState> {
  const [meta, results] = await Promise.all([
    loadTournamentMeta(tournamentId),
    loadTournamentResults(tournamentId),
  ]);

  const eliminations = deriveEliminations(results);

  return {
    meta,
    results,
    handCount: results.total_hands,
    eliminations,
  };
}

export function getBlindLevelForHand(
  handNumber: number,
  meta: TournamentMeta
): { level: number; sb: number; bb: number } {
  let handsProcessed = 0;

  for (let i = 0; i < meta.blind_schedule.length; i++) {
    const level = meta.blind_schedule[i];
    if (handNumber <= handsProcessed + level.hands) {
      return {
        level: i + 1,
        sb: level.sb,
        bb: level.bb,
      };
    }
    handsProcessed += level.hands;
  }

  // If beyond schedule, use last level
  const lastLevel = meta.blind_schedule[meta.blind_schedule.length - 1];
  return {
    level: meta.blind_schedule.length,
    sb: lastLevel.sb,
    bb: lastLevel.bb,
  };
}

export function getWinnerName(results: TournamentResults): string {
  const entries = Object.entries(results.placements);
  const winner = entries.find(([, placement]) => placement === 1);
  return winner ? winner[0] : 'Unknown';
}

export function getSortedPlacements(results: TournamentResults): Array<{ name: string; placement: number }> {
  return Object.entries(results.placements)
    .sort((a, b) => a[1] - b[1])
    .map(([name, placement]) => ({ name, placement }));
}
