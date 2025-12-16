import clsx from 'clsx';
import { CardPair } from '../cards';
import { ActionBubble } from './ActionBubble';
import { DealerButton } from './DealerButton';

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
  onClick,
  className,
}: SeatProps) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        'relative flex flex-col items-center gap-1 p-2 rounded-lg',
        'transition-all duration-200 cursor-pointer',
        'hover:bg-white/10',
        isSelected && 'ring-2 ring-yellow-400 bg-white/15',
        isActive && 'bg-white/20 scale-105',
        isFolded && 'opacity-50',
        isEliminated && 'opacity-30',
        className
      )}
    >
      {/* Action bubble */}
      {isActive && currentAction && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 z-10">
          <ActionBubble
            action={currentAction.action}
            amount={currentAction.amount}
          />
        </div>
      )}

      {/* Dealer button */}
      {isButton && (
        <div className="absolute -top-2 -right-2 z-10">
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
          'bg-gray-800 text-white px-3 py-1.5 rounded-lg',
          'min-w-[100px] text-center',
          'border',
          isSelected ? 'border-yellow-400' : 'border-gray-600'
        )}
      >
        <div className="font-medium text-sm truncate max-w-[90px]" title={name}>
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

export default Seat;
