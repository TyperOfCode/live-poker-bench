export interface BlindLevel {
  hands: number;
  sb: number;
  bb: number;
}

export interface TournamentMeta {
  seed: number;
  num_players: number;
  starting_stack: number;
  blind_schedule: BlindLevel[];
}

export interface AgentStats {
  seat: number;
  agent_name: string;
  total_decisions: number;
  total_retries: number;
  error_count: number;
  invalid_action_rate: number;
}

export interface TournamentResults {
  run_number: number;
  seed: number;
  total_hands: number;
  placements: Record<string, number>;
  agent_stats: Record<string, AgentStats>;
}

export interface Elimination {
  handNumber: number;
  playerName: string;
  placementFinish: number;
}

export interface TournamentState {
  meta: TournamentMeta;
  results: TournamentResults;
  handCount: number;
  eliminations: Elimination[];
}
