import clsx from 'clsx';
import { useReplayStore, selectCanStepForward, selectCanStepBackward } from '../../state/replayStore';

export function PlaybackControls() {
  const isPlaying = useReplayStore((state) => state.isPlaying);
  const togglePlay = useReplayStore((state) => state.togglePlay);
  const stepForward = useReplayStore((state) => state.stepForward);
  const stepBackward = useReplayStore((state) => state.stepBackward);
  const canStepForward = useReplayStore(selectCanStepForward);
  const canStepBackward = useReplayStore(selectCanStepBackward);

  return (
    <div className="flex items-center gap-2">
      {/* Step backward */}
      <button
        onClick={stepBackward}
        disabled={!canStepBackward}
        className={clsx(
          'p-2 rounded-lg transition-colors',
          'bg-gray-700 hover:bg-gray-600 text-white',
          'disabled:opacity-40 disabled:cursor-not-allowed'
        )}
        title="Step backward (Left Arrow)"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
        </svg>
      </button>

      {/* Play/Pause */}
      <button
        onClick={togglePlay}
        className={clsx(
          'p-3 rounded-full transition-colors',
          'bg-blue-600 hover:bg-blue-500 text-white',
          'shadow-lg'
        )}
        title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
      >
        {isPlaying ? (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Step forward */}
      <button
        onClick={stepForward}
        disabled={!canStepForward}
        className={clsx(
          'p-2 rounded-lg transition-colors',
          'bg-gray-700 hover:bg-gray-600 text-white',
          'disabled:opacity-40 disabled:cursor-not-allowed'
        )}
        title="Step forward (Right Arrow)"
      >
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
        </svg>
      </button>
    </div>
  );
}

export default PlaybackControls;
