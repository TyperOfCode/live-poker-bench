import type { AgentDecision } from '../../types';

interface DecisionSummaryProps {
  decision: AgentDecision;
}

export function DecisionSummary({ decision }: DecisionSummaryProps) {
  const { final_action, observation, thinking_time_ms, retries } = decision;

  return (
    <div className="border-t border-gray-600 bg-gray-800/50 p-4">
      <div className="grid grid-cols-4 gap-4 text-sm">
        <div>
          <div className="text-gray-500 text-xs uppercase">Action</div>
          <div className="font-bold text-lg text-white capitalize">
            {final_action.action}
            {final_action.raise_to && (
              <span className="text-yellow-400 ml-1">{final_action.raise_to}</span>
            )}
          </div>
        </div>
        <div>
          <div className="text-gray-500 text-xs uppercase">Stack</div>
          <div className="font-mono text-white">{observation.my_stack.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-gray-500 text-xs uppercase">Pot</div>
          <div className="font-mono text-white">{observation.pot_size.toLocaleString()}</div>
        </div>
        <div>
          <div className="text-gray-500 text-xs uppercase">Time</div>
          <div className="font-mono text-white">{(thinking_time_ms / 1000).toFixed(1)}s</div>
        </div>
      </div>

      {(final_action.forced || retries > 0) && (
        <div className="mt-3 flex gap-2">
          {final_action.forced && (
            <span className="text-xs text-orange-400 bg-orange-900/30 px-2 py-1 rounded">
              Forced action
            </span>
          )}
          {retries > 0 && (
            <span className="text-xs text-yellow-400 bg-yellow-900/30 px-2 py-1 rounded">
              {retries} {retries === 1 ? 'retry' : 'retries'}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default DecisionSummary;
