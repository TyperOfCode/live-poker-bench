import type { TournamentMeta, TournamentResults } from "~/types";

export function getBlindLevelForHand(
  handNumber: number,
  meta: TournamentMeta,
): { level: number; sb: number; bb: number } {
  let handsProcessed = 0;

  for (let i = 0; i < meta.blind_schedule.length; i++) {
    const level = meta.blind_schedule[i];
    if (!level) continue;
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
  if (!lastLevel) {
    return { level: 1, sb: 25, bb: 50 };
  }
  return {
    level: meta.blind_schedule.length,
    sb: lastLevel.sb,
    bb: lastLevel.bb,
  };
}

export function getWinnerName(results: TournamentResults): string {
  const entries = Object.entries(results.placements);
  const winner = entries.find(([, placement]) => placement === 1);
  return winner ? winner[0] : "Unknown";
}

export function getSortedPlacements(
  results: TournamentResults,
): Array<{ name: string; placement: number }> {
  return Object.entries(results.placements)
    .sort((a, b) => a[1] - b[1])
    .map(([name, placement]) => ({ name, placement }));
}
