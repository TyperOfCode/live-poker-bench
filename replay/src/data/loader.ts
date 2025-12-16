import type { HandData, AgentHandData, TournamentMeta, TournamentResults } from '../types';

const padNumber = (num: number, length: number = 3): string => {
  return String(num).padStart(length, '0');
};

export async function loadHandData(
  tournamentId: string,
  handNumber: number
): Promise<HandData> {
  const padded = padNumber(handNumber);
  const response = await fetch(
    `/data/tournament_${tournamentId}/hands/hand_${padded}.json`
  );
  if (!response.ok) {
    throw new Error(`Failed to load hand ${handNumber}: ${response.statusText}`);
  }
  return response.json();
}

export async function loadAgentData(
  tournamentId: string,
  handNumber: number
): Promise<AgentHandData> {
  const padded = padNumber(handNumber);
  const response = await fetch(
    `/data/tournament_${tournamentId}/agents/hand_${padded}.json`
  );
  if (!response.ok) {
    throw new Error(`Failed to load agent data for hand ${handNumber}: ${response.statusText}`);
  }
  return response.json();
}

export async function loadTournamentMeta(
  tournamentId: string
): Promise<TournamentMeta> {
  const response = await fetch(`/data/tournament_${tournamentId}/meta.json`);
  if (!response.ok) {
    throw new Error(`Failed to load tournament meta: ${response.statusText}`);
  }
  return response.json();
}

export async function loadTournamentResults(
  tournamentId: string
): Promise<TournamentResults> {
  const response = await fetch(`/data/tournament_${tournamentId}/results.json`);
  if (!response.ok) {
    throw new Error(`Failed to load tournament results: ${response.statusText}`);
  }
  return response.json();
}

export async function loadHandAndAgentData(
  tournamentId: string,
  handNumber: number
): Promise<{ hand: HandData; agent: AgentHandData }> {
  const [hand, agent] = await Promise.all([
    loadHandData(tournamentId, handNumber),
    loadAgentData(tournamentId, handNumber),
  ]);
  return { hand, agent };
}

export async function listAvailableTournaments(): Promise<string[]> {
  // Check which tournaments have valid results.json files (001-010)
  const possibleIds = Array.from({ length: 10 }, (_, i) => String(i + 1).padStart(3, '0'));
  const available: string[] = [];

  for (const id of possibleIds) {
    try {
      const response = await fetch(`/data/tournament_${id}/results.json`, { method: 'HEAD' });
      if (response.ok) {
        available.push(id);
      }
    } catch {
      // Tournament doesn't exist, skip
    }
  }

  return available.length > 0 ? available : ['001'];
}
