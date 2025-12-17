import type {
  HandData,
  AgentHandData,
  TournamentState,
  TournamentStatistics,
  AgentPokerStats,
  ChipProgression,
  ActionDistribution,
  AgentActionDistribution,
  StreetStats,
  EliminationInfo,
} from '~/types';
import { loadAllHands } from '../data/loader';
import {
  calculateVPIP,
  calculatePFR,
  calculateAggressionFactor,
  calculateThreeBetPercent,
  calculateWTSD,
  calculateWASD,
  calculateTimingStats,
  calculateHandsWon,
  calculateHandsPlayed,
  calculateChipsWon,
  calculateActionDistribution as calculateActionDist,
} from './pokerStats';

/**
 * Calculate chip progression over hands
 * Detects eliminations by checking when seats disappear from hole_cards (cards only dealt to active players)
 * Uses stack_start from the NEXT hand to get accurate post-hand stacks
 */
export function calculateChipProgression(
  hands: HandData[],
  _agentData: AgentHandData[], // Keep for API compatibility
  tournament: TournamentState
): ChipProgression[] {
  const progression: ChipProgression[] = [];
  const agentNames = Object.keys(tournament.results.placements);

  // Build seat -> name mapping from first hand (all players present)
  const seatToName: Record<number, string> = {};
  const firstHand = hands[0];
  if (firstHand) {
    for (const player of firstHand.players) {
      seatToName[player.seat] = player.name;
    }
  }

  // Build name -> seat mapping for reverse lookup
  const nameToSeat: Record<string, number> = {};
  for (const [seat, name] of Object.entries(seatToName)) {
    nameToSeat[name] = Number(seat);
  }

  // Track eliminated players
  const eliminatedPlayers = new Set<string>();

  for (let i = 0; i < hands.length; i++) {
    const hand = hands[i];
    if (!hand) continue;

    const nextHand = hands[i + 1];
    const stacks: Record<string, number> = {};

    // Get active seats from hole_cards (only dealt to non-eliminated players)
    const activeSeats = new Set(Object.keys(hand.hole_cards).map(Number));

    // Build seat -> stack mapping from players array
    const seatToStack: Record<number, number> = {};
    for (const player of hand.players) {
      seatToStack[player.seat] = player.stack_start;
    }

    if (nextHand) {
      // Get next hand's active seats from hole_cards
      const nextActiveSeats = new Set(Object.keys(nextHand.hole_cards).map(Number));

      // Build next hand's seat -> stack mapping
      const nextSeatToStack: Record<number, number> = {};
      for (const player of nextHand.players) {
        nextSeatToStack[player.seat] = player.stack_start;
      }

      // Detect eliminations: seat in current hole_cards but not in next
      for (const seat of activeSeats) {
        const name = seatToName[seat];
        if (name && !nextActiveSeats.has(seat) && !eliminatedPlayers.has(name)) {
          eliminatedPlayers.add(name);
        }
      }

      // Set stacks for all agents
      for (const name of agentNames) {
        if (eliminatedPlayers.has(name)) {
          stacks[name] = 0;
        } else {
          // Get stack from next hand using seat mapping
          const seat = nameToSeat[name];
          if (seat !== undefined && nextSeatToStack[seat] !== undefined) {
            stacks[name] = nextSeatToStack[seat];
          } else {
            stacks[name] = 0;
            eliminatedPlayers.add(name);
          }
        }
      }
    } else {
      // Last hand - winner gets all chips
      const totalChips = tournament.meta.starting_stack * tournament.meta.num_players;
      const winners = hand.winners;

      const winnerSeat = winners[0];
      if (winners.length === 1 && winnerSeat !== undefined) {
        const winnerName = seatToName[winnerSeat];
        if (winnerName) {
          stacks[winnerName] = totalChips;
        }
      }

      // Everyone else gets 0
      for (const name of agentNames) {
        if (!(name in stacks)) {
          stacks[name] = 0;
        }
      }
    }

    progression.push({ handNumber: hand.hand_number, stacks });
  }

  return progression;
}

/**
 * Calculate street statistics
 */
export function calculateStreetStats(hands: HandData[]): StreetStats[] {
  const streets = ['preflop', 'flop', 'turn', 'river'];
  const stats: StreetStats[] = [];

  for (const street of streets) {
    let handsReached = 0;
    let totalPotSize = 0;

    for (const hand of hands) {
      const hasStreetAction = hand.actions.some((a) => a.street === street);
      if (hasStreetAction) {
        handsReached++;
        // Get pot size at end of street
        const streetActions = hand.actions.filter((a) => a.street === street);
        const lastAction = streetActions[streetActions.length - 1];
        if (lastAction?.pot_after) {
          totalPotSize += lastAction.pot_after;
        }
      }
    }

    stats.push({
      street,
      handsReached,
      avgPotSize: handsReached > 0 ? totalPotSize / handsReached : 0,
    });
  }

  return stats;
}

/**
 * Calculate token usage from agent data
 */
function calculateTokenUsage(
  agentData: AgentHandData[],
  seat: number
): { prompt: number; completion: number; total: number } {
  let prompt = 0;
  let completion = 0;

  for (const handAgent of agentData) {
    const decisions = handAgent.decisions[String(seat)];
    if (!decisions) continue;

    for (const decision of decisions) {
      for (const response of decision.llm_responses) {
        prompt += response.usage.prompt_tokens;
        completion += response.usage.completion_tokens;
      }
    }
  }

  return { prompt, completion, total: prompt + completion };
}

/**
 * Calculate agent poker stats from hand data
 */
function calculateAgentStats(
  hands: HandData[],
  agentData: AgentHandData[],
  tournament: TournamentState
): AgentPokerStats[] {
  const stats: AgentPokerStats[] = [];

  for (const [agentName, placement] of Object.entries(tournament.results.placements)) {
    const agentStats = tournament.results.agent_stats[agentName];
    if (!agentStats) continue;

    const seat = agentStats.seat;
    const timing = calculateTimingStats(hands, seat);
    const tokens = calculateTokenUsage(agentData, seat);
    const handsPlayed = calculateHandsPlayed(hands, seat);

    stats.push({
      agentName,
      seat,
      placement,
      totalDecisions: agentStats.total_decisions,
      totalRetries: agentStats.total_retries,
      errorCount: agentStats.error_count,
      invalidActionRate: agentStats.invalid_action_rate,

      // Poker metrics
      vpip: calculateVPIP(hands, seat),
      pfr: calculatePFR(hands, seat),
      aggressionFactor: calculateAggressionFactor(hands, seat),
      threeBetPercent: calculateThreeBetPercent(hands, seat),

      // Showdown stats
      wtsd: calculateWTSD(hands, seat),
      wasd: calculateWASD(hands, seat),

      // Timing stats
      avgThinkingTimeMs: timing.avg,
      maxThinkingTimeMs: timing.max,
      minThinkingTimeMs: timing.min,

      // Token usage
      totalPromptTokens: tokens.prompt,
      totalCompletionTokens: tokens.completion,
      avgTokensPerDecision:
        agentStats.total_decisions > 0
          ? tokens.total / agentStats.total_decisions
          : 0,

      // Win/loss
      handsWon: calculateHandsWon(hands, seat),
      handsPlayed,
      totalChipsWon: calculateChipsWon(hands, seat),
    });
  }

  // Sort by placement
  stats.sort((a, b) => a.placement - b.placement);

  return stats;
}

/**
 * Calculate action distribution per agent
 */
function calculateAgentActionDistributions(
  hands: HandData[],
  tournament: TournamentState
): AgentActionDistribution[] {
  const distributions: AgentActionDistribution[] = [];

  for (const agentName of Object.keys(tournament.results.placements)) {
    const agentStats = tournament.results.agent_stats[agentName];
    if (!agentStats) continue;

    const actions = calculateActionDist(hands, agentStats.seat);
    distributions.push({
      agentName,
      actions,
    });
  }

  return distributions;
}

/**
 * Calculate full tournament statistics
 */
export async function calculateTournamentStatistics(
  tournamentId: string,
  tournament: TournamentState
): Promise<TournamentStatistics> {
  // Load all hands
  const { hands, agentData } = await loadAllHands(
    tournamentId,
    tournament.handCount
  );

  // Calculate overall action distribution
  const actionDistribution: ActionDistribution = { fold: 0, check: 0, call: 0, raise: 0, bet: 0 };
  for (const hand of hands) {
    for (const action of hand.actions) {
      if (action.forced) continue;
      const actionType = action.action as keyof ActionDistribution;
      if (actionType in actionDistribution) {
        actionDistribution[actionType]++;
      }
    }
  }

  // Build seat -> name mapping from tournament results
  const seatToName: Record<number, string> = {};
  for (const [name, stats] of Object.entries(tournament.results.agent_stats)) {
    seatToName[stats.seat] = name;
  }

  // Derive elimination order by comparing hole_cards between consecutive hands
  // (cards are only dealt to non-eliminated players)
  const eliminationOrder: EliminationInfo[] = [];

  for (let i = 0; i < hands.length - 1; i++) {
    const currentHand = hands[i];
    const nextHand = hands[i + 1];
    if (!currentHand || !nextHand) continue;

    // Active seats = seats that received hole cards
    const currentActiveSeats = new Set(Object.keys(currentHand.hole_cards).map(Number));
    const nextActiveSeats = new Set(Object.keys(nextHand.hole_cards).map(Number));

    // Find seats that were active but are no longer
    for (const seat of currentActiveSeats) {
      if (!nextActiveSeats.has(seat)) {
        const name = seatToName[seat];
        if (name) {
          eliminationOrder.push({
            handNumber: currentHand.hand_number,
            agentName: name,
            placement: tournament.results.placements[name] ?? 0,
          });
        }
      }
    }
  }

  return {
    tournamentId,
    totalHands: tournament.handCount,
    numPlayers: tournament.meta.num_players,
    startingStack: tournament.meta.starting_stack,

    agentStats: calculateAgentStats(hands, agentData, tournament),
    chipProgression: calculateChipProgression(hands, agentData, tournament),
    eliminationOrder,
    actionDistribution,
    agentActionDistribution: calculateAgentActionDistributions(hands, tournament),
    streetStats: calculateStreetStats(hands),
  };
}
