import clsx from "clsx";
import { CardPair } from "~/components/cards";
import { ActionBubble } from "./ActionBubble";
import { DealerButton } from "./DealerButton";

interface SeatProps {
  seat: number;
  name: string;
  stack: number;
  holeCards?: [string, string];
  isButton: boolean;
  isActive: boolean;
  isFolded: boolean;
  isSelected: boolean;
  isEliminated?: boolean;
  currentAction?: { action: string; amount: number } | null;
  reasoning?: string;
  onClick?: () => void;
  className?: string;
}

export function Seat({
  seat: _seat,
  name,
  stack,
  holeCards,
  isButton,
  isActive,
  isFolded,
  isSelected,
  isEliminated = false,
  currentAction,
  reasoning,
  onClick,
  className,
}: SeatProps) {
  void _seat; // Mark as intentionally unused

  return (
    <div
      onClick={onClick}
      className={clsx(
        "relative flex flex-col items-center gap-1 rounded-lg p-2",
        "cursor-pointer transition-all duration-200",
        "hover:bg-white/10",
        isSelected && "bg-white/15 ring-2 ring-yellow-400",
        isActive && "scale-105 bg-white/20",
        isFolded && "opacity-50",
        isEliminated && "opacity-30",
        className,
      )}
    >
      {/* Action bubble - below the seat */}
      {isActive && currentAction && (
        <div className="absolute left-1/2 top-full z-10 mt-1 -translate-x-1/2">
          <ActionBubble
            action={currentAction.action}
            amount={currentAction.amount}
          />
        </div>
      )}

      {/* Reasoning bubble - above the seat, always on top */}
      {isActive && reasoning && (
        <div className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2">
          <div className="group w-[320px] cursor-default rounded-lg border border-gray-700 bg-gray-900/80 px-3 py-2 text-sm text-gray-200 shadow-lg transition-all hover:bg-gray-900/95">
            <div className="line-clamp-4 leading-relaxed transition-all group-hover:line-clamp-none">
              {reasoning}
            </div>
          </div>
        </div>
      )}

      {/* Dealer button */}
      {isButton && (
        <div className="absolute -right-2 -top-2 z-10">
          <DealerButton />
        </div>
      )}

      {/* Hole cards */}
      <div className="mb-1">
        <CardPair
          cards={holeCards}
          faceDown={!holeCards || isEliminated}
          folded={isFolded}
          size="sm"
        />
      </div>

      {/* Player info card */}
      <div
        className={clsx(
          "rounded-lg bg-gray-800 px-3 py-1.5 text-white",
          "min-w-[100px] text-center",
          "border",
          isSelected ? "border-yellow-400" : "border-gray-600",
        )}
      >
        <div className="max-w-[90px] truncate text-sm font-medium" title={name}>
          {name}
        </div>
        <div className="font-mono text-xs text-gray-300">
          {isEliminated ? (
            <span className="text-red-400">OUT</span>
          ) : (
            stack.toLocaleString()
          )}
        </div>
      </div>
    </div>
  );
}
