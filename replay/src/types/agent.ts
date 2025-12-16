export interface AgentObservation {
  hand_number: number;
  street: string;
  my_seat: number;
  my_position: string;
  my_hole_cards: [string, string];
  my_stack: number;
  community_cards: string[];
  pot_size: number;
  current_bet: number;
  min_raise: number;
  max_raise: number;
  small_blind: number;
  big_blind: number;
  button_seat: number;
  players: Array<{
    seat: number;
    name: string;
    stack: number;
    is_active: boolean;
    is_folded: boolean;
  }>;
  actions_this_hand: Array<{
    street: string;
    seat: number;
    action: string;
    amount: number;
  }>;
  legal_actions: string[];
}

export interface ToolCall {
  tool_name: string;
  arguments: Record<string, unknown>;
  result: string;
}

export interface LLMResponse {
  content: string;
  reasoning_content?: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens?: number;
  };
  latency_ms: number;
}

export interface FinalAction {
  action: string;
  raise_to: number | null;
  reasoning: string;
  forced: boolean;
  retries: number;
  thinking_time_ms?: number;
}

export interface AgentDecision {
  seat: number;
  agent_name: string;
  hand_number: number;
  street: string;
  observation: AgentObservation;
  conversation: Array<{ role: string; content: string }>;
  tool_calls: ToolCall[];
  llm_responses: LLMResponse[];
  final_action: FinalAction;
  thinking_time_ms: number;
  retries: number;
}

export interface AgentHandData {
  hand_number: number;
  decisions: Record<string, AgentDecision[]>;
  summary?: {
    total_decisions: number;
    total_tool_calls: number;
    total_retries: number;
    agents_acted: number[];
  };
}
