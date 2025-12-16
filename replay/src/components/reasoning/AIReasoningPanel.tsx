import { useState } from 'react';
import clsx from 'clsx';
import { useReplayStore, selectCurrentFrame } from '../../state/replayStore';
import type { AgentDecision } from '../../types';
import { ConversationView } from './ConversationView';
import { ToolCallsView } from './ToolCallsView';
import { ThinkingView } from './ThinkingView';
import { DecisionSummary } from './DecisionSummary';

type Tab = 'conversation' | 'tools' | 'thinking';

function findDecisionForSeat(
  agentData: { decisions: Record<string, AgentDecision[]> } | null,
  seat: number,
  currentStreet: string | undefined
): AgentDecision | null {
  if (!agentData) return null;

  const seatDecisions = agentData.decisions[String(seat)];
  if (!seatDecisions || seatDecisions.length === 0) return null;

  // Try to find decision for current street
  if (currentStreet) {
    const streetDecision = seatDecisions.find((d) => d.street === currentStreet);
    if (streetDecision) return streetDecision;
  }

  // Fall back to most recent decision
  return seatDecisions[seatDecisions.length - 1];
}

export function AIReasoningPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('conversation');
  const selectedSeat = useReplayStore((state) => state.selectedSeat);
  const agentData = useReplayStore((state) => state.agentData);
  const handData = useReplayStore((state) => state.handData);
  const currentFrame = useReplayStore(selectCurrentFrame);

  // Find the decision for the selected seat
  const decision = selectedSeat
    ? findDecisionForSeat(agentData, selectedSeat, currentFrame?.street)
    : null;

  const playerName = handData?.players.find((p) => p.seat === selectedSeat)?.name || '';

  if (!selectedSeat) {
    return (
      <div className="h-full flex flex-col bg-gray-900 rounded-lg">
        <div className="flex-1 flex items-center justify-center text-gray-500 p-4 text-center">
          <div>
            <div className="text-4xl mb-2">🤖</div>
            <div>Click on a player to view their AI reasoning</div>
          </div>
        </div>
      </div>
    );
  }

  if (!decision) {
    return (
      <div className="h-full flex flex-col bg-gray-900 rounded-lg">
        <div className="p-4 bg-gray-800 border-b border-gray-700">
          <h3 className="font-semibold text-white">{playerName}</h3>
          <p className="text-sm text-gray-400">Seat {selectedSeat}</p>
        </div>
        <div className="flex-1 flex items-center justify-center text-gray-500 p-4">
          No decision data available for this player on this street
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'conversation', label: 'Conversation' },
    { id: 'tools', label: 'Tools', count: decision.tool_calls?.length || 0 },
    { id: 'thinking', label: 'Thinking' },
  ];

  return (
    <div className="h-full flex flex-col bg-gray-900 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-white">{playerName}</h3>
            <p className="text-sm text-gray-400">
              {decision.street.toUpperCase()} - {decision.final_action.action}
              {decision.final_action.raise_to && ` to ${decision.final_action.raise_to}`}
            </p>
          </div>
          <div className="text-right text-xs text-gray-500">
            <div>{(decision.thinking_time_ms / 1000).toFixed(1)}s thinking</div>
            {decision.retries > 0 && (
              <div className="text-orange-400">{decision.retries} retries</div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700 bg-gray-800/50">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              'flex-1 py-2.5 text-sm font-medium capitalize transition-colors',
              activeTab === tab.id
                ? 'border-b-2 border-blue-500 text-blue-400 bg-gray-800'
                : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800'
            )}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="ml-1 bg-gray-700 px-1.5 rounded-full text-xs">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'conversation' && (
          <ConversationView messages={decision.conversation} />
        )}
        {activeTab === 'tools' && (
          <ToolCallsView toolCalls={decision.tool_calls} />
        )}
        {activeTab === 'thinking' && (
          <ThinkingView
            llmResponses={decision.llm_responses}
            finalAction={decision.final_action}
          />
        )}
      </div>

      {/* Decision Summary Footer */}
      <DecisionSummary decision={decision} />
    </div>
  );
}

export default AIReasoningPanel;
