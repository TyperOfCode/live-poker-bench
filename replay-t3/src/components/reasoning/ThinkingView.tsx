"use client";

import { useState } from "react";
import type { LLMResponse, FinalAction } from "~/types";

interface ThinkingViewProps {
  llmResponses: LLMResponse[];
  finalAction: FinalAction;
}

function ResponseCard({
  response,
  index,
}: {
  response: LLMResponse;
  index: number;
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="overflow-hidden rounded-lg border border-gray-600">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between bg-gray-800 px-3 py-2 transition-colors hover:bg-gray-700"
      >
        <span className="text-sm text-gray-300">Response {index + 1}</span>
        <span className="text-xs text-gray-500">
          {response.usage.prompt_tokens}p + {response.usage.completion_tokens}c
          tokens | {response.latency_ms.toFixed(0)}ms
        </span>
      </button>

      {isExpanded && (
        <div className="space-y-3 p-3">
          {/* Reasoning/thinking content */}
          {response.reasoning_content && (
            <div>
              <div className="mb-1 text-xs font-semibold uppercase text-purple-400">
                Chain of Thought:
              </div>
              <div className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded bg-purple-900/20 p-3 font-mono text-sm text-gray-200">
                {response.reasoning_content}
              </div>
            </div>
          )}

          {/* Main output content */}
          {response.content && (
            <div>
              <div className="mb-1 text-xs font-semibold uppercase text-green-400">
                Output:
              </div>
              <div className="whitespace-pre-wrap rounded bg-green-900/20 p-3 font-mono text-sm text-gray-200">
                {response.content}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ThinkingView({ llmResponses, finalAction }: ThinkingViewProps) {
  if (!llmResponses || llmResponses.length === 0) {
    return (
      <div className="py-8 text-center text-gray-500">
        No LLM response data available
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {llmResponses.map((response, idx) => (
        <ResponseCard key={idx} response={response} index={idx} />
      ))}

      {/* Final reasoning from parsed action */}
      <div className="mt-4 border-t border-gray-600 pt-4">
        <div className="mb-2 text-xs font-semibold uppercase text-yellow-400">
          Final Reasoning:
        </div>
        <p className="rounded bg-gray-800 p-3 text-sm italic text-gray-300">
          &quot;{finalAction.reasoning}&quot;
        </p>
      </div>
    </div>
  );
}
