export interface HandPlayer {
  seat: number;
  name: string;
  stack_start: number;
}

export interface HandAction {
  street: 'preflop' | 'flop' | 'turn' | 'river';
  seat: number;
  action: 'fold' | 'check' | 'call' | 'raise' | 'bet' | 'post_sb' | 'post_bb' | 'all_in';
  amount: number;
  thinking_time_ms?: number;
  pot_after?: number;
  forced?: boolean;
  retries?: number;
}

export interface HandData {
  hand_number: number;
  blind_level: number;
  button_seat: number;
  blinds: {
    small: number;
    big: number;
  };
  players: HandPlayer[];
  hole_cards: Record<string, [string, string]>;
  community_cards: string[];
  actions: HandAction[];
  showdown: Record<string, [string, string]>;
  winners: number[];
  pot: number;
  pots_awarded: Record<string, number>;
}
