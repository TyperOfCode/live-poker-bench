"use client";

import { useState } from "react";
import type { ToolCall } from "~/types";

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
    <div className="overflow-hidden rounded-lg border border-gray-600">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-2 bg-gray-800 px-3 py-2 font-mono text-sm transition-colors hover:bg-gray-700"
      >
        <span className="text-gray-400">{isExpanded ? "  " : "  "}</span>
        <span className="text-blue-400">{call.tool_name}</span>
        <span className="text-gray-500">(</span>
        <span className="flex-1 truncate text-left text-green-400">
          {JSON.stringify(call.arguments)}
        </span>
        <span className="text-gray-500">)</span>
      </button>

      {isExpanded && (
        <div className="border-t border-gray-700 bg-gray-900/50 p-3">
          <div className="mb-2">
            <div className="mb-1 text-xs text-gray-500">Arguments:</div>
            <pre className="overflow-x-auto text-xs text-yellow-400">
              {JSON.stringify(call.arguments, null, 2)}
            </pre>
          </div>
          <div>
            <div className="mb-1 text-xs text-gray-500">Result:</div>
            <pre className="max-h-60 overflow-x-auto overflow-y-auto whitespace-pre-wrap text-xs text-gray-300">
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
      <div className="py-8 text-center text-gray-500">
        No tool calls made for this decision
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="mb-2 text-xs text-gray-400">
        {toolCalls.length} tool call{toolCalls.length !== 1 ? "s" : ""}
      </div>
      {toolCalls.map((call, idx) => (
        <ToolCallCard key={idx} call={call} />
      ))}
    </div>
  );
}
