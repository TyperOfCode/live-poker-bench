"use client";

import { useState } from "react";
import clsx from "clsx";

interface Message {
  role: string;
  content: string;
}

interface ConversationViewProps {
  messages: Message[];
}

function CollapsibleContent({
  content,
  maxLength = 500,
}: {
  content: string;
  maxLength?: number;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const shouldCollapse = content.length > maxLength;

  if (!shouldCollapse) {
    return <span className="whitespace-pre-wrap">{content}</span>;
  }

  return (
    <div>
      <span className="whitespace-pre-wrap">
        {isExpanded ? content : content.slice(0, maxLength) + "..."}
      </span>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="ml-2 text-xs text-blue-400 hover:text-blue-300"
      >
        {isExpanded ? "Show less" : "Show more"}
      </button>
    </div>
  );
}

export function ConversationView({ messages }: ConversationViewProps) {
  if (!messages || messages.length === 0) {
    return (
      <div className="py-8 text-center text-gray-500">
        No conversation data available
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {messages.map((msg, idx) => (
        <div
          key={idx}
          className={clsx(
            "rounded-lg p-3 text-sm",
            msg.role === "system" &&
              "border-l-4 border-purple-500 bg-purple-900/30",
            msg.role === "user" && "border-l-4 border-blue-500 bg-blue-900/30",
            msg.role === "assistant" &&
              "border-l-4 border-green-500 bg-green-900/30",
          )}
        >
          <div className="mb-2 text-xs font-semibold uppercase text-gray-400">
            {msg.role}
          </div>
          <div className="font-mono text-xs leading-relaxed text-gray-200">
            <CollapsibleContent content={msg.content} />
          </div>
        </div>
      ))}
    </div>
  );
}
