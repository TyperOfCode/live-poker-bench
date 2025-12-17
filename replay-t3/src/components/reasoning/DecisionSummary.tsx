"use client";

import type { AgentDecision } from "~/types";

interface DecisionSummaryProps {
  decision: AgentDecision;
}

export function DecisionSummary({ decision }: DecisionSummaryProps) {
  const { final_action, observation, thinking_time_ms, retries } = decision;

  return (
    <div className="border-t border-gray-600 bg-gray-800/50 p-4">
      <div className="grid grid-cols-4 gap-4 text-sm">
        <div>
          <div className="text-xs uppercase text-gray-500">Action</div>
          <div className="text-lg font-bold capitalize text-white">
            {final_action.action}
            {final_action.raise_to && (
              <span className="ml-1 text-yellow-400">
                {final_action.raise_to}
              </span>
            )}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase text-gray-500">Stack</div>
          <div className="font-mono text-white">
            {observation.my_stack.toLocaleString()}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase text-gray-500">Pot</div>
          <div className="font-mono text-white">
            {observation.pot_size.toLocaleString()}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase text-gray-500">Time</div>
          <div className="font-mono text-white">
            {(thinking_time_ms / 1000).toFixed(1)}s
          </div>
        </div>
      </div>

      {(final_action.forced || retries > 0) && (
        <div className="mt-3 flex gap-2">
          {final_action.forced && (
            <span className="rounded bg-orange-900/30 px-2 py-1 text-xs text-orange-400">
              Forced action
            </span>
          )}
          {retries > 0 && (
            <span className="rounded bg-yellow-900/30 px-2 py-1 text-xs text-yellow-400">
              {retries} {retries === 1 ? "retry" : "retries"}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
