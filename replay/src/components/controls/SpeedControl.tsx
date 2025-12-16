import clsx from 'clsx';
import { useReplayStore } from '../../state/replayStore';

const SPEED_OPTIONS = [0.5, 1, 2, 4];

export function SpeedControl() {
  const playbackSpeed = useReplayStore((state) => state.playbackSpeed);
  const setSpeed = useReplayStore((state) => state.setSpeed);

  return (
    <div className="flex items-center gap-2">
      <span className="text-gray-400 text-sm">Speed:</span>
      <div className="flex rounded-lg overflow-hidden border border-gray-600">
        {SPEED_OPTIONS.map((speed) => (
          <button
            key={speed}
            onClick={() => setSpeed(speed)}
            className={clsx(
              'px-2 py-1 text-sm transition-colors',
              playbackSpeed === speed
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            )}
          >
            {speed}x
          </button>
        ))}
      </div>
    </div>
  );
}

export default SpeedControl;
