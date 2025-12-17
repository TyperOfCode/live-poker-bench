import clsx from "clsx";

interface ActionBubbleProps {
  action: string;
  amount?: number;
  className?: string;
}

const ACTION_STYLES: Record<string, string> = {
  fold: "bg-gray-500",
  check: "bg-blue-500",
  call: "bg-green-500",
  bet: "bg-orange-500",
  raise: "bg-red-500",
  all_in: "bg-purple-600",
  post_sb: "bg-gray-400",
  post_bb: "bg-gray-400",
  showdown: "bg-yellow-500",
};

export function ActionBubble({ action, amount, className }: ActionBubbleProps) {
  const bgClass = ACTION_STYLES[action] ?? "bg-gray-500";
  const displayAction = action.replace("_", " ").toUpperCase();

  return (
    <div
      className={clsx(
        "rounded-full px-2 py-1 text-xs font-bold text-white",
        "animate-pulse shadow-lg",
        bgClass,
        className,
      )}
    >
      {displayAction}
      {amount !== undefined && amount > 0 && (
        <span className="ml-1">{amount}</span>
      )}
    </div>
  );
}
