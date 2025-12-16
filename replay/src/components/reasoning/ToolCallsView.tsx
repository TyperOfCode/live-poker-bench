import { useState } from 'react';
import type { ToolCall } from '../../types';

interface ToolCallsViewProps {
  toolCalls: ToolCall[];
}

function formatJSON(str: string): string {
  try {
    return JSON.stringify(JSON.parse(str), null, 2);
  } catch {
    return str;
  }
}

function ToolCallCard({ call }: { call: ToolCall }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const formattedResult = formatJSON(call.result);

  return (
    <div className="border border-gray-600 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full bg-gray-800 px-3 py-2 font-mono text-sm flex items-center gap-2 hover:bg-gray-700 transition-colors"
      >
        <span className="text-gray-400">{isExpanded ? '▼' : '▶'}</span>
        <span className="text-blue-400">{call.tool_name}</span>
        <span className="text-gray-500">(</span>
        <span className="text-green-400 truncate flex-1 text-left">
          {JSON.stringify(call.arguments)}
        </span>
        <span className="text-gray-500">)</span>
      </button>

      {isExpanded && (
        <div className="p-3 bg-gray-900/50 border-t border-gray-700">
          <div className="mb-2">
            <div className="text-xs text-gray-500 mb-1">Arguments:</div>
            <pre className="text-xs text-yellow-400 overflow-x-auto">
              {JSON.stringify(call.arguments, null, 2)}
            </pre>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Result:</div>
            <pre className="text-xs text-gray-300 overflow-x-auto whitespace-pre-wrap max-h-60 overflow-y-auto">
              {formattedResult}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

export function ToolCallsView({ toolCalls }: ToolCallsViewProps) {
  if (!toolCalls || toolCalls.length === 0) {
    return (
      <div className="text-gray-500 text-center py-8">
        No tool calls made for this decision
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-400 mb-2">
        {toolCalls.length} tool call{toolCalls.length !== 1 ? 's' : ''}
      </div>
      {toolCalls.map((call, idx) => (
        <ToolCallCard key={idx} call={call} />
      ))}
    </div>
  );
}

export default ToolCallsView;
