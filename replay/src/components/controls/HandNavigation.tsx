import clsx from 'clsx';
import { useReplayStore } from '../../state/replayStore';

export function HandNavigation() {
  const currentHandNumber = useReplayStore((state) => state.currentHandNumber);
  const tournament = useReplayStore((state) => state.tournament);
  const previousHand = useReplayStore((state) => state.previousHand);
  const nextHand = useReplayStore((state) => state.nextHand);
  const isLoadingHand = useReplayStore((state) => state.isLoadingHand);

  const handCount = tournament?.handCount || 0;
  const canGoPrev = currentHandNumber > 1 && !isLoadingHand;
  const canGoNext = currentHandNumber < handCount && !isLoadingHand;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={previousHand}
        disabled={!canGoPrev}
        className={clsx(
          'p-1 rounded transition-colors',
          'bg-gray-700 hover:bg-gray-600 text-white',
          'disabled:opacity-40 disabled:cursor-not-allowed'
        )}
        title="Previous hand (Up Arrow)"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" />
        </svg>
      </button>

      <div className="text-white font-mono text-sm min-w-[80px] text-center">
        {isLoadingHand ? (
          <span className="text-gray-400">Loading...</span>
        ) : (
          <>
            Hand <span className="font-bold">{currentHandNumber}</span>
            <span className="text-gray-400">/{handCount}</span>
          </>
        )}
      </div>

      <button
        onClick={nextHand}
        disabled={!canGoNext}
        className={clsx(
          'p-1 rounded transition-colors',
          'bg-gray-700 hover:bg-gray-600 text-white',
          'disabled:opacity-40 disabled:cursor-not-allowed'
        )}
        title="Next hand (Down Arrow)"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
        </svg>
      </button>
    </div>
  );
}

export default HandNavigation;
