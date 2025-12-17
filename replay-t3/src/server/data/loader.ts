import { promises as fs } from 'fs';
import path from 'path';
import type {
  HandData,
  AgentHandData,
  TournamentMeta,
  TournamentResults,
  TournamentState,
  Elimination,
} from '~/types';

// Data directory relative to project root
const DATA_DIR = path.join(process.cwd(), 'data');

/**
 * Get the path to a tournament directory
 * Handles both full format (tournament_001) and short format (001)
 */
function getTournamentPath(tournamentId: string): string {
  // If the ID doesn't start with 'tournament_', add the prefix
  const fullId = tournamentId.startsWith('tournament_')
    ? tournamentId
    : `tournament_${tournamentId}`;
  return path.join(DATA_DIR, fullId);
}

/**
 * List all available tournament IDs
 */
export async function listTournaments(): Promise<string[]> {
  try {
    const entries = await fs.readdir(DATA_DIR, { withFileTypes: true });
    const tournamentDirs = entries
      .filter((entry) => entry.isDirectory() && entry.name.startsWith('tournament_'))
      .map((entry) => entry.name)
      .sort();
    return tournamentDirs;
  } catch {
    return [];
  }
}

/**
 * Load tournament metadata
 */
export async function loadTournamentMeta(tournamentId: string): Promise<TournamentMeta> {
  const metaPath = path.join(getTournamentPath(tournamentId), 'meta.json');
  const content = await fs.readFile(metaPath, 'utf-8');
  return JSON.parse(content) as TournamentMeta;
}

/**
 * Load tournament results
 */
export async function loadTournamentResults(tournamentId: string): Promise<TournamentResults> {
  const resultsPath = path.join(getTournamentPath(tournamentId), 'results.json');
  const content = await fs.readFile(resultsPath, 'utf-8');
  return JSON.parse(content) as TournamentResults;
}

/**
 * Load hand data for a specific hand
 */
export async function loadHandData(tournamentId: string, handNumber: number): Promise<HandData> {
  const handPath = path.join(
    getTournamentPath(tournamentId),
    'hands',
    `hand_${String(handNumber).padStart(3, '0')}.json`
  );
  const content = await fs.readFile(handPath, 'utf-8');
  return JSON.parse(content) as HandData;
}

/**
 * Load agent data for a specific hand
 */
export async function loadAgentData(tournamentId: string, handNumber: number): Promise<AgentHandData | null> {
  const agentPath = path.join(
    getTournamentPath(tournamentId),
    'agents',
    `hand_${String(handNumber).padStart(3, '0')}.json`
  );
  try {
    const content = await fs.readFile(agentPath, 'utf-8');
    return JSON.parse(content) as AgentHandData;
  } catch {
    // Agent data may not exist for all hands
    return null;
  }
}

/**
 * Get total number of hands in a tournament
 */
export async function getHandCount(tournamentId: string): Promise<number> {
  const handsDir = path.join(getTournamentPath(tournamentId), 'hands');
  try {
    const files = await fs.readdir(handsDir);
    return files.filter((f) => f.startsWith('hand_') && f.endsWith('.json')).length;
  } catch {
    return 0;
  }
}

/**
 * Load all hands for a tournament
 */
export async function loadAllHands(
  tournamentId: string,
  handCount: number
): Promise<{ hands: HandData[]; agentData: AgentHandData[] }> {
  const hands: HandData[] = [];
  const agentData: AgentHandData[] = [];

  const BATCH_SIZE = 10;
  for (let i = 1; i <= handCount; i += BATCH_SIZE) {
    const batchSize = Math.min(BATCH_SIZE, handCount - i + 1);
    const batchPromises = Array.from({ length: batchSize }, (_, j) =>
      Promise.all([
        loadHandData(tournamentId, i + j),
        loadAgentData(tournamentId, i + j),
      ])
    );

    const batchResults = await Promise.all(batchPromises);
    for (const [hand, agent] of batchResults) {
      hands.push(hand);
      if (agent) agentData.push(agent);
    }
  }

  return { hands, agentData };
}

/**
 * Build elimination list from tournament results and hand data
 */
export async function buildEliminations(
  tournamentId: string,
  results: TournamentResults
): Promise<Elimination[]> {
  const eliminations: Elimination[] = [];
  const handCount = await getHandCount(tournamentId);

  // Build seat -> name mapping
  const seatToName: Record<number, string> = {};
  for (const [name, stats] of Object.entries(results.agent_stats)) {
    seatToName[stats.seat] = name;
  }

  // Scan through hands to find eliminations
  for (let i = 1; i < handCount; i++) {
    try {
      const currentHand = await loadHandData(tournamentId, i);
      const nextHand = await loadHandData(tournamentId, i + 1);

      const currentActiveSeats = new Set(Object.keys(currentHand.hole_cards).map(Number));
      const nextActiveSeats = new Set(Object.keys(nextHand.hole_cards).map(Number));

      for (const seat of currentActiveSeats) {
        if (!nextActiveSeats.has(seat)) {
          const name = seatToName[seat];
          if (name) {
            eliminations.push({
              handNumber: i,
              playerName: name,
              placementFinish: results.placements[name] ?? 0,
            });
          }
        }
      }
    } catch {
      // Skip if hands can't be loaded
    }
  }

  return eliminations;
}

/**
 * Load full tournament state
 */
export async function loadFullTournament(tournamentId: string): Promise<TournamentState> {
  const [meta, results] = await Promise.all([
    loadTournamentMeta(tournamentId),
    loadTournamentResults(tournamentId),
  ]);

  const handCount = await getHandCount(tournamentId);
  const eliminations = await buildEliminations(tournamentId, results);

  return {
    meta,
    results,
    handCount,
    eliminations,
  };
}
