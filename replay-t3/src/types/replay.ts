import type { AgentDecision } from './agent';

export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';

export interface ReplayFrame {
  frameIndex: number;
  street: Street;
  seat: number;
  playerName: string;
  action: string;
  amount: number;
  potAfterAction: number;
  communityCards: string[];
  agentDecision?: AgentDecision;
  isShowdown: boolean;
  isFinalAction: boolean;
}

export interface PlayerState {
  seat: number;
  name: string;
  stack: number;
  hasFolded: boolean;
  holeCards?: [string, string];
  currentBet: number;
}

export interface GameState {
  pot: number;
  communityCards: string[];
  currentStreet: Street;
  players: PlayerState[];
  buttonSeat: number;
  activeSeats: number[];
}
