import clsx from 'clsx';
import { useReplayStore, selectCurrentFrame } from '../../state/replayStore';
import { getStreetFrameIndices } from '../../data/merger';

const STREETS = ['preflop', 'flop', 'turn', 'river', 'showdown'] as const;

const STREET_LABELS: Record<string, string> = {
  preflop: 'Pre',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
  showdown: 'SD',
};

export function StreetJump() {
  const frames = useReplayStore((state) => state.frames);
  const currentFrame = useReplayStore(selectCurrentFrame);
  const jumpToStreet = useReplayStore((state) => state.jumpToStreet);

  const streetIndices = getStreetFrameIndices(frames);

  return (
    <div className="flex items-center gap-1">
      {STREETS.map((street) => {
        const hasStreet = streetIndices[street] >= 0;
        const isActive = currentFrame?.street === street;

        return (
          <button
            key={street}
            onClick={() => hasStreet && jumpToStreet(street)}
            disabled={!hasStreet}
            className={clsx(
              'px-2 py-1 text-xs rounded transition-colors',
              isActive && 'bg-blue-600 text-white',
              !isActive && hasStreet && 'bg-gray-700 text-gray-300 hover:bg-gray-600',
              !hasStreet && 'bg-gray-800 text-gray-500 cursor-not-allowed'
            )}
          >
            {STREET_LABELS[street]}
          </button>
        );
      })}
    </div>
  );
}

export default StreetJump;
