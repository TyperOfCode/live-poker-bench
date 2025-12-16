import clsx from 'clsx';
import { CommunityCards } from '../cards';
import { Seat } from './Seat';
import { Pot } from './Pot';
import type { ReplayFrame } from '../../types';

interface PlayerStateForTable {
  seat: number;
  name: string;
  stack: number;
  holeCards?: [string, string];
  hasFolded: boolean;
  isEliminated: boolean;
}

interface PokerTableProps {
  players: PlayerStateForTable[];
  communityCards: string[];
  pot: number;
  buttonSeat: number;
  currentFrame?: ReplayFrame | null;
  selectedSeat: number | null;
  onSelectSeat: (seat: number) => void;
  className?: string;
}

// Seat positions for 5-6 players (as percentage of container)
const SEAT_POSITIONS: Record<number, { left: string; top: string }> = {
  1: { left: '15%', top: '70%' },   // Bottom left - typically BTN position
  2: { left: '15%', top: '30%' },   // Top left
  3: { left: '50%', top: '8%' },    // Top center
  4: { left: '85%', top: '30%' },   // Top right
  5: { left: '85%', top: '70%' },   // Bottom right
  6: { left: '50%', top: '85%' },   // Bottom center (if 6 players)
};

export function PokerTable({
  players,
  communityCards,
  pot,
  buttonSeat,
  currentFrame,
  selectedSeat,
  onSelectSeat,
  className,
}: PokerTableProps) {
  return (
    <div className={clsx('relative w-full aspect-[16/10] max-w-4xl mx-auto', className)}>
      {/* Table felt background */}
      <svg viewBox="0 0 100 62" className="absolute inset-0 w-full h-full">
        {/* Outer rail */}
        <ellipse
          cx="50"
          cy="31"
          rx="48"
          ry="29"
          fill="#0f2918"
          stroke="#1a3d26"
          strokeWidth="1"
        />
        {/* Main felt */}
        <ellipse
          cx="50"
          cy="31"
          rx="45"
          ry="26"
          fill="#1a472a"
        />
        {/* Inner felt highlight */}
        <ellipse
          cx="50"
          cy="31"
          rx="42"
          ry="23"
          fill="#2d5a3e"
        />
        {/* Center line */}
        <ellipse
          cx="50"
          cy="31"
          rx="20"
          ry="10"
          fill="none"
          stroke="#3d7a5e"
          strokeWidth="0.3"
          strokeDasharray="2 2"
        />
      </svg>

      {/* Community cards */}
      <div className="absolute left-1/2 top-[32%] -translate-x-1/2 -translate-y-1/2 z-10">
        <CommunityCards cards={communityCards} size="md" />
      </div>

      {/* Pot display */}
      <div className="absolute left-1/2 top-[52%] -translate-x-1/2 -translate-y-1/2 z-10">
        <Pot amount={pot} />
      </div>

      {/* Player seats */}
      {players.map((player) => {
        const position = SEAT_POSITIONS[player.seat];
        if (!position) return null;

        const isActive = currentFrame?.seat === player.seat;

        return (
          <div
            key={player.seat}
            className="absolute z-20"
            style={{
              left: position.left,
              top: position.top,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <Seat
              seat={player.seat}
              name={player.name}
              stack={player.stack}
              holeCards={player.holeCards}
              isButton={player.seat === buttonSeat}
              isActive={isActive}
              isFolded={player.hasFolded}
              isSelected={player.seat === selectedSeat}
              isEliminated={player.isEliminated}
              currentAction={
                isActive && currentFrame
                  ? { action: currentFrame.action, amount: currentFrame.amount }
                  : null
              }
              onClick={() => onSelectSeat(player.seat)}
            />
          </div>
        );
      })}
    </div>
  );
}

export default PokerTable;
