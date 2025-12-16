import type { HandData, HandAction } from '../../types';

/**
 * VPIP (Voluntarily Put $ In Pot)
 * = (Hands where voluntarily called/raised preflop) / (Hands played) * 100
 * Excludes blinds (not voluntary)
 */
export function calculateVPIP(hands: HandData[], seat: number): number {
  let voluntaryActions = 0;
  let eligibleHands = 0;

  for (const hand of hands) {
    const playerInHand = hand.players.some((p) => p.seat === seat);
    if (!playerInHand) continue;

    eligibleHands++;
    const preflopActions = hand.actions.filter(
      (a) => a.street === 'preflop' && a.seat === seat && !a.forced
    );

    const voluntarilyPutIn = preflopActions.some(
      (a) => a.action === 'call' || a.action === 'raise' || a.action === 'bet'
    );

    if (voluntarilyPutIn) voluntaryActions++;
  }

  return eligibleHands > 0 ? (voluntaryActions / eligibleHands) * 100 : 0;
}

/**
 * PFR (Pre-Flop Raise %)
 * = (Hands where raised preflop) / (Hands played) * 100
 */
export function calculatePFR(hands: HandData[], seat: number): number {
  let raiseActions = 0;
  let eligibleHands = 0;

  for (const hand of hands) {
    const playerInHand = hand.players.some((p) => p.seat === seat);
    if (!playerInHand) continue;

    eligibleHands++;
    const preflopRaises = hand.actions.filter(
      (a) => a.street === 'preflop' && a.seat === seat && a.action === 'raise'
    );

    if (preflopRaises.length > 0) raiseActions++;
  }

  return eligibleHands > 0 ? (raiseActions / eligibleHands) * 100 : 0;
}

/**
 * Aggression Factor (AF)
 * = (Bets + Raises) / Calls
 * Higher = more aggressive
 */
export function calculateAggressionFactor(hands: HandData[], seat: number): number {
  let betsAndRaises = 0;
  let calls = 0;

  for (const hand of hands) {
    for (const action of hand.actions) {
      if (action.seat !== seat) continue;

      if (action.action === 'bet' || action.action === 'raise') {
        betsAndRaises++;
      } else if (action.action === 'call') {
        calls++;
      }
    }
  }

  return calls > 0 ? betsAndRaises / calls : betsAndRaises;
}

/**
 * 3-Bet Percentage
 * = (Times 3-bet preflop / Opportunities to 3-bet) * 100
 */
export function calculateThreeBetPercent(hands: HandData[], seat: number): number {
  let threeBets = 0;
  let opportunities = 0;

  for (const hand of hands) {
    const playerInHand = hand.players.some((p) => p.seat === seat);
    if (!playerInHand) continue;

    const preflopActions = hand.actions.filter((a) => a.street === 'preflop');

    // Find if there was a raise before our action
    let raiseCount = 0;
    let hadOpportunity = false;
    let did3Bet = false;

    for (const action of preflopActions) {
      if (action.action === 'raise' && action.seat !== seat) {
        raiseCount++;
      }

      if (action.seat === seat && raiseCount === 1) {
        // We had an opportunity to 3-bet
        hadOpportunity = true;
        if (action.action === 'raise') {
          did3Bet = true;
        }
      }
    }

    if (hadOpportunity) {
      opportunities++;
      if (did3Bet) threeBets++;
    }
  }

  return opportunities > 0 ? (threeBets / opportunities) * 100 : 0;
}

/**
 * WTSD (Went to Showdown %)
 * = (Hands reaching showdown / Hands played past preflop) * 100
 */
export function calculateWTSD(hands: HandData[], seat: number): number {
  let wentToShowdown = 0;
  let playedPastPreflop = 0;

  for (const hand of hands) {
    const playerInHand = hand.players.some((p) => p.seat === seat);
    if (!playerInHand) continue;

    // Did player fold preflop?
    const foldedPreflop = hand.actions.some(
      (a) => a.street === 'preflop' && a.seat === seat && a.action === 'fold'
    );

    if (foldedPreflop) continue;

    playedPastPreflop++;

    // Did they go to showdown?
    if (hand.showdown && Object.keys(hand.showdown).includes(String(seat))) {
      wentToShowdown++;
    }
  }

  return playedPastPreflop > 0 ? (wentToShowdown / playedPastPreflop) * 100 : 0;
}

/**
 * W$SD / WASD (Won $ at Showdown %)
 * = (Showdowns won / Showdowns reached) * 100
 */
export function calculateWASD(hands: HandData[], seat: number): number {
  let showdownsReached = 0;
  let showdownsWon = 0;

  for (const hand of hands) {
    if (hand.showdown && Object.keys(hand.showdown).includes(String(seat))) {
      showdownsReached++;
      if (hand.winners.includes(seat)) {
        showdownsWon++;
      }
    }
  }

  return showdownsReached > 0 ? (showdownsWon / showdownsReached) * 100 : 0;
}

/**
 * Calculate timing statistics for an agent
 */
export function calculateTimingStats(
  hands: HandData[],
  seat: number
): { avg: number; max: number; min: number } {
  const times: number[] = [];

  for (const hand of hands) {
    for (const action of hand.actions) {
      if (action.seat === seat && action.thinking_time_ms !== undefined) {
        times.push(action.thinking_time_ms);
      }
    }
  }

  if (times.length === 0) {
    return { avg: 0, max: 0, min: 0 };
  }

  const sum = times.reduce((a, b) => a + b, 0);
  return {
    avg: sum / times.length,
    max: Math.max(...times),
    min: Math.min(...times),
  };
}

/**
 * Count total hands won by a seat
 */
export function calculateHandsWon(hands: HandData[], seat: number): number {
  return hands.filter((h) => h.winners.includes(seat)).length;
}

/**
 * Count hands played by a seat
 */
export function calculateHandsPlayed(hands: HandData[], seat: number): number {
  return hands.filter((h) => h.players.some((p) => p.seat === seat)).length;
}

/**
 * Calculate total chips won by a seat
 */
export function calculateChipsWon(hands: HandData[], seat: number): number {
  let total = 0;

  for (const hand of hands) {
    const awarded = hand.pots_awarded[String(seat)];
    if (awarded) {
      total += awarded;
    }
  }

  return total;
}

/**
 * Calculate action distribution for a seat
 */
export function calculateActionDistribution(
  hands: HandData[],
  seat?: number
): { fold: number; check: number; call: number; raise: number; bet: number } {
  const distribution = { fold: 0, check: 0, call: 0, raise: 0, bet: 0 };

  for (const hand of hands) {
    for (const action of hand.actions) {
      if (seat !== undefined && action.seat !== seat) continue;
      if (action.forced) continue; // Skip forced blinds

      const actionType = action.action as keyof typeof distribution;
      if (actionType in distribution) {
        distribution[actionType]++;
      }
    }
  }

  return distribution;
}

/**
 * Get all actions for analysis
 */
export function getAllActions(hands: HandData[], seat?: number): HandAction[] {
  const actions: HandAction[] = [];

  for (const hand of hands) {
    for (const action of hand.actions) {
      if (seat === undefined || action.seat === seat) {
        actions.push(action);
      }
    }
  }

  return actions;
}
