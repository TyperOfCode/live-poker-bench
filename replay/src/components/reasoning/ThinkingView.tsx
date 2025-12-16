import { useState } from 'react';
import type { LLMResponse, FinalAction } from '../../types';

interface ThinkingViewProps {
  llmResponses: LLMResponse[];
  finalAction: FinalAction;
}

function ResponseCard({ response, index }: { response: LLMResponse; index: number }) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="border border-gray-600 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full bg-gray-800 px-3 py-2 flex items-center justify-between hover:bg-gray-700 transition-colors"
      >
        <span className="text-sm text-gray-300">Response {index + 1}</span>
        <span className="text-xs text-gray-500">
          {response.usage.prompt_tokens}p + {response.usage.completion_tokens}c tokens
          | {response.latency_ms.toFixed(0)}ms
        </span>
      </button>

      {isExpanded && (
        <div className="p-3 space-y-3">
          {/* Reasoning/thinking content */}
          {response.reasoning_content && (
            <div>
              <div className="text-xs font-semibold text-purple-400 mb-1 uppercase">
                Chain of Thought:
              </div>
              <div className="bg-purple-900/20 p-3 rounded text-sm text-gray-200 whitespace-pre-wrap font-mono max-h-80 overflow-y-auto">
                {response.reasoning_content}
              </div>
            </div>
          )}

          {/* Main output content */}
          {response.content && (
            <div>
              <div className="text-xs font-semibold text-green-400 mb-1 uppercase">
                Output:
              </div>
              <div className="bg-green-900/20 p-3 rounded text-sm text-gray-200 whitespace-pre-wrap font-mono">
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
      <div className="text-gray-500 text-center py-8">
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
      <div className="border-t border-gray-600 pt-4 mt-4">
        <div className="text-xs font-semibold text-yellow-400 mb-2 uppercase">
          Final Reasoning:
        </div>
        <p className="text-sm text-gray-300 italic bg-gray-800 p-3 rounded">
          "{finalAction.reasoning}"
        </p>
      </div>
    </div>
  );
}

export default ThinkingView;
