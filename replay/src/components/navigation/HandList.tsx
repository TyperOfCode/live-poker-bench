import clsx from 'clsx';
import { useReplayStore } from '../../state/replayStore';
import { getBlindLevelForHand } from '../../data/tournament';

interface HandListItemProps {
  handNumber: number;
  isActive: boolean;
  blindLevel: { level: number; sb: number; bb: number };
  onClick: () => void;
}

function HandListItem({ handNumber, isActive, blindLevel, onClick }: HandListItemProps) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full px-3 py-2 text-left flex items-center gap-2',
        'hover:bg-gray-700 transition-colors',
        isActive && 'bg-blue-900 border-l-4 border-blue-500'
      )}
    >
      <span className="font-mono text-sm text-gray-300">#{handNumber}</span>
      <span className="text-xs text-gray-500">
        L{blindLevel.level} ({blindLevel.sb}/{blindLevel.bb})
      </span>
    </button>
  );
}

export function HandList() {
  const tournament = useReplayStore((state) => state.tournament);
  const currentHandNumber = useReplayStore((state) => state.currentHandNumber);
  const goToHand = useReplayStore((state) => state.goToHand);

  if (!tournament) {
    return (
      <div className="p-4 text-gray-400 text-sm text-center">
        No tournament loaded
      </div>
    );
  }

  const handCount = tournament.handCount;
  const hands = Array.from({ length: handCount }, (_, i) => i + 1);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="p-3 border-b border-gray-700 flex-shrink-0">
        <h3 className="text-sm font-semibold text-gray-300">
          Hands ({handCount})
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        {hands.map((handNumber) => (
          <HandListItem
            key={handNumber}
            handNumber={handNumber}
            isActive={handNumber === currentHandNumber}
            blindLevel={getBlindLevelForHand(handNumber, tournament.meta)}
            onClick={() => goToHand(handNumber)}
          />
        ))}
      </div>
    </div>
  );
}

export default HandList;
