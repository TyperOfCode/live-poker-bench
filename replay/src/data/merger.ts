import type { HandData, AgentHandData, AgentDecision } from '../types';
import type { ReplayFrame, Street, PlayerState, GameState } from '../types/replay';

function getStreetCommunityCards(handData: HandData, street: Street): string[] {
  const allCards = handData.community_cards;
  switch (street) {
    case 'preflop':
      return [];
    case 'flop':
      return allCards.slice(0, 3);
    case 'turn':
      return allCards.slice(0, 4);
    case 'river':
    case 'showdown':
      return allCards.slice(0, 5);
    default:
      return [];
  }
}

function buildDecisionMap(agentData: AgentHandData): Map<string, AgentDecision> {
  const map = new Map<string, AgentDecision>();

  Object.entries(agentData.decisions).forEach(([seat, decisions]) => {
    const streetCounts: Record<string, number> = {};

    decisions.forEach((decision) => {
      const street = decision.street;
      streetCounts[street] = (streetCounts[street] || 0);
      const key = `${seat}-${street}-${streetCounts[street]}`;
      map.set(key, decision);
      streetCounts[street]++;
    });
  });

  return map;
}

export function mergeHandAndAgentData(
  handData: HandData,
  agentData: AgentHandData
): ReplayFrame[] {
  const frames: ReplayFrame[] = [];
  const decisionMap = buildDecisionMap(agentData);

  // Track running state
  let runningPot = 0;
  const streetActionCounts: Record<string, Record<number, number>> = {};

  // Process each action
  handData.actions.forEach((action, index) => {
    const street = action.street as Street;
    const seat = action.seat;

    // Initialize street counts
    if (!streetActionCounts[street]) {
      streetActionCounts[street] = {};
    }
    if (!streetActionCounts[street][seat]) {
      streetActionCounts[street][seat] = 0;
    }

    // Find matching agent decision
    const decisionKey = `${seat}-${street}-${streetActionCounts[street][seat]}`;
    const decision = decisionMap.get(decisionKey);

    // Update pot
    runningPot = action.pot_after ?? runningPot + action.amount;

    // Increment action count for this seat on this street
    streetActionCounts[street][seat]++;

    const player = handData.players.find(p => p.seat === seat);

    frames.push({
      frameIndex: index,
      street,
      seat,
      playerName: player?.name || `Seat ${seat}`,
      action: action.action,
      amount: action.amount,
      potAfterAction: runningPot,
      communityCards: getStreetCommunityCards(handData, street),
      agentDecision: decision,
      isShowdown: false,
      isFinalAction: index === handData.actions.length - 1,
    });
  });

  // Add showdown frame if there was a showdown
  if (Object.keys(handData.showdown).length > 0) {
    const lastFrame = frames[frames.length - 1];
    frames.push({
      frameIndex: frames.length,
      street: 'showdown',
      seat: handData.winners[0] || 0,
      playerName: 'Showdown',
      action: 'showdown',
      amount: 0,
      potAfterAction: handData.pot,
      communityCards: handData.community_cards,
      agentDecision: undefined,
      isShowdown: true,
      isFinalAction: true,
    });

    // Mark previous frame as not final
    if (lastFrame) {
      lastFrame.isFinalAction = false;
    }
  }

  return frames;
}

export function computeGameStateAtFrame(
  handData: HandData,
  agentData: AgentHandData,
  frameIndex: number
): GameState {
  const frames = mergeHandAndAgentData(handData, agentData);
  const relevantFrames = frames.slice(0, frameIndex + 1);
  const currentFrame = frames[frameIndex];

  // Initialize player states from starting stacks
  const playerStates: Map<number, PlayerState> = new Map();
  handData.players.forEach(player => {
    playerStates.set(player.seat, {
      seat: player.seat,
      name: player.name,
      stack: player.stack_start,
      hasFolded: false,
      holeCards: handData.hole_cards[String(player.seat)] as [string, string] | undefined,
      currentBet: 0,
    });
  });

  // Process actions up to current frame
  let currentStreet: Street = 'preflop';
  const streetBets: Map<number, number> = new Map();

  relevantFrames.forEach(frame => {
    const player = playerStates.get(frame.seat);
    if (!player) return;

    // Reset bets on new street
    if (frame.street !== currentStreet) {
      currentStreet = frame.street;
      playerStates.forEach(p => {
        p.currentBet = 0;
      });
      streetBets.clear();
    }

    // Update player state based on action
    if (frame.action === 'fold') {
      player.hasFolded = true;
    } else if (frame.amount > 0) {
      player.stack -= frame.amount;
      player.currentBet += frame.amount;
    }

    // Use agent observation for more accurate stack if available
    if (frame.agentDecision?.observation) {
      const obs = frame.agentDecision.observation;
      // Update stack from observation (more accurate)
      const obsPlayer = obs.players.find(p => p.seat === frame.seat);
      if (obsPlayer) {
        // The observation shows stack BEFORE this action
        // So we need to account for the bet we just made
      }
    }
  });

  // Determine active seats (not folded, have chips)
  const activeSeats = Array.from(playerStates.values())
    .filter(p => !p.hasFolded && p.stack > 0)
    .map(p => p.seat);

  return {
    pot: currentFrame?.potAfterAction || 0,
    communityCards: currentFrame?.communityCards || [],
    currentStreet: currentFrame?.street || 'preflop',
    players: Array.from(playerStates.values()),
    buttonSeat: handData.button_seat,
    activeSeats,
  };
}

export function getStreetFrameIndices(frames: ReplayFrame[]): Record<Street, number> {
  const indices: Record<Street, number> = {
    preflop: -1,
    flop: -1,
    turn: -1,
    river: -1,
    showdown: -1,
  };

  frames.forEach((frame, index) => {
    if (indices[frame.street] === -1) {
      indices[frame.street] = index;
    }
  });

  return indices;
}
