"use client";

import clsx from "clsx";
import {
  usePlaybackStore,
  selectCanStepForward,
  selectCanStepBackward,
} from "~/store/playbackStore";

export function PlaybackControls() {
  const isPlaying = usePlaybackStore((state) => state.isPlaying);
  const togglePlay = usePlaybackStore((state) => state.togglePlay);
  const stepForward = usePlaybackStore((state) => state.stepForward);
  const stepBackward = usePlaybackStore((state) => state.stepBackward);
  const canStepForward = usePlaybackStore(selectCanStepForward);
  const canStepBackward = usePlaybackStore(selectCanStepBackward);

  return (
    <div className="flex items-center gap-2">
      {/* Step backward */}
      <button
        onClick={stepBackward}
        disabled={!canStepBackward}
        className={clsx(
          "rounded-lg p-2 transition-colors",
          "bg-gray-700 text-white hover:bg-gray-600",
          "disabled:cursor-not-allowed disabled:opacity-40",
        )}
        title="Step backward (Left Arrow)"
      >
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
        </svg>
      </button>

      {/* Play/Pause */}
      <button
        onClick={togglePlay}
        className={clsx(
          "rounded-full p-3 transition-colors",
          "bg-blue-600 text-white shadow-lg hover:bg-blue-500",
        )}
        title={isPlaying ? "Pause (Space)" : "Play (Space)"}
      >
        {isPlaying ? (
          <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
        ) : (
          <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Step forward */}
      <button
        onClick={stepForward}
        disabled={!canStepForward}
        className={clsx(
          "rounded-lg p-2 transition-colors",
          "bg-gray-700 text-white hover:bg-gray-600",
          "disabled:cursor-not-allowed disabled:opacity-40",
        )}
        title="Step forward (Right Arrow)"
      >
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
        </svg>
      </button>
    </div>
  );
}
