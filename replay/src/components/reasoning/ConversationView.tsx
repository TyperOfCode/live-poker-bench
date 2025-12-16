import { useState } from 'react';
import clsx from 'clsx';

interface Message {
  role: string;
  content: string;
}

interface ConversationViewProps {
  messages: Message[];
}

function CollapsibleContent({ content, maxLength = 500 }: { content: string; maxLength?: number }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const shouldCollapse = content.length > maxLength;

  if (!shouldCollapse) {
    return <span className="whitespace-pre-wrap">{content}</span>;
  }

  return (
    <div>
      <span className="whitespace-pre-wrap">
        {isExpanded ? content : content.slice(0, maxLength) + '...'}
      </span>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="ml-2 text-blue-400 hover:text-blue-300 text-xs"
      >
        {isExpanded ? 'Show less' : 'Show more'}
      </button>
    </div>
  );
}

export function ConversationView({ messages }: ConversationViewProps) {
  if (!messages || messages.length === 0) {
    return (
      <div className="text-gray-500 text-center py-8">
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
            'p-3 rounded-lg text-sm',
            msg.role === 'system' && 'bg-purple-900/30 border-l-4 border-purple-500',
            msg.role === 'user' && 'bg-blue-900/30 border-l-4 border-blue-500',
            msg.role === 'assistant' && 'bg-green-900/30 border-l-4 border-green-500'
          )}
        >
          <div className="text-xs font-semibold uppercase text-gray-400 mb-2">
            {msg.role}
          </div>
          <div className="font-mono text-xs text-gray-200 leading-relaxed">
            <CollapsibleContent content={msg.content} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default ConversationView;
