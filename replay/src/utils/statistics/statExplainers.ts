/**
 * Explanations for poker statistics displayed on hover
 */
export const STAT_EXPLAINERS = {
  // Poker metrics
  vpip: 'Voluntarily Put $ In Pot - % of hands where player voluntarily bet or called preflop (excludes forced blinds)',
  pfr: 'Pre-Flop Raise - % of hands where player raised preflop',
  af: 'Aggression Factor - Ratio of (Bets + Raises) to Calls. Higher = more aggressive play',
  threeBet: '3-Bet % - Percentage of opportunities where player re-raised a preflop raise',
  wtsd: 'Went To Showdown - % of hands that reached showdown after seeing the flop',
  wasd: 'Won $ at Showdown - % of showdowns won when reaching showdown',

  // Performance metrics
  handsWon: 'Total number of hands where the player won the pot',
  handsPlayed: 'Total hands the player participated in',
  decisions: 'Total strategic decisions made across all hands (excludes forced blinds)',
  errors: 'Number of invalid or errored actions',
  errorRate: 'Percentage of decisions that resulted in errors',

  // Tournament metrics
  tournaments: 'Number of tournaments played',
  wins: 'Number of tournaments won (1st place)',
  winRate: 'Percentage of tournaments won',
  avgPlacement: 'Average finishing position across tournaments (lower is better)',
  consistency: 'Standard deviation of placements (lower = more consistent)',

  // Token/timing metrics
  avgThinkingTime: 'Average time taken to make decisions',
  totalTokens: 'Total LLM tokens used across all decisions',

  // Chip metrics
  chipsWon: 'Total chips won across all hands',
  avgEliminationHand: 'Average hand number when eliminated from tournaments',
} as const;

export type StatKey = keyof typeof STAT_EXPLAINERS;
