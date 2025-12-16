// Per-agent poker statistics
export interface AgentPokerStats {
  agentName: string;
  seat: number;

  // Basic stats from results.json
  placement: number;
  totalDecisions: number;
  totalRetries: number;
  errorCount: number;
  invalidActionRate: number;

  // Calculated poker metrics
  vpip: number;              // Voluntarily Put $ In Pot %
  pfr: number;               // Pre-Flop Raise %
  aggressionFactor: number;  // (Bets + Raises) / Calls
  threeBetPercent: number;   // 3-bet %

  // Showdown stats
  wtsd: number;              // Went to Showdown %
  wasd: number;              // Won at Showdown %

  // Timing stats
  avgThinkingTimeMs: number;
  maxThinkingTimeMs: number;
  minThinkingTimeMs: number;

  // Token usage
  totalPromptTokens: number;
  totalCompletionTokens: number;
  avgTokensPerDecision: number;

  // Win/loss
  handsWon: number;
  handsPlayed: number;
  totalChipsWon: number;
}

// Chip progression for charts
export interface ChipProgression {
  handNumber: number;
  stacks: Record<string, number>; // agentName -> stack
}

// Action distribution
export interface ActionDistribution {
  fold: number;
  check: number;
  call: number;
  raise: number;
  bet: number;
}

// Per-agent action distribution
export interface AgentActionDistribution {
  agentName: string;
  actions: ActionDistribution;
}

// Street statistics
export interface StreetStats {
  street: string;
  handsReached: number;
  avgPotSize: number;
}

// Elimination info
export interface EliminationInfo {
  handNumber: number;
  agentName: string;
  placement: number;
}

// Full tournament statistics
export interface TournamentStatistics {
  tournamentId: string;
  totalHands: number;
  numPlayers: number;
  startingStack: number;

  // Per-agent stats
  agentStats: AgentPokerStats[];

  // Chip progression for charts
  chipProgression: ChipProgression[];

  // Elimination order
  eliminationOrder: EliminationInfo[];

  // Overall action distribution
  actionDistribution: ActionDistribution;

  // Per-agent action distribution
  agentActionDistribution: AgentActionDistribution[];

  // Street statistics
  streetStats: StreetStats[];
}

// Model aggregate stats across tournaments
export interface ModelAggregateStats {
  modelName: string;
  tournamentsPlayed: number;
  wins: number;
  avgPlacement: number;
  placementDistribution: Record<number, number>; // placement -> count
  totalHandsPlayed: number;
  totalHandsWon: number;

  // Aggregate poker stats (weighted by hands played)
  avgVpip: number;
  avgPfr: number;
  avgAggressionFactor: number;
  avgThreeBetPercent: number;
  avgWtsd: number;
  avgWasd: number;

  // Aggregate performance stats
  totalDecisions: number;
  totalErrors: number;
  avgInvalidActionRate: number;

  // Elimination stats
  avgEliminationHand: number;
  eliminationHands: number[]; // hand numbers when eliminated
}

// Overall statistics across all tournaments
export interface OverallStatistics {
  tournamentsLoaded: number;
  tournamentsTotal: number;

  // Per-model aggregate stats
  modelStats: Record<string, ModelAggregateStats>;

  // Rankings sorted by win rate
  rankings: ModelRanking[];

  // Overall aggregate metrics (across all models)
  overallAvgVpip: number;
  overallAvgPfr: number;
  overallAvgAf: number;
  overallAvgWtsd: number;
  overallAvgWasd: number;
  totalHandsPlayed: number;
  totalHandsWon: number;
}

// Model ranking entry
export interface ModelRanking {
  modelName: string;
  avgPlacement: number;
  winRate: number;
  tournamentsPlayed: number;
  consistency: number; // lower is more consistent (std dev)
}
