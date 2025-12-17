"use client";

import clsx from "clsx";
import { usePlaybackStore } from "~/store/playbackStore";

const SPEED_OPTIONS = [0.5, 1, 2, 4];

export function SpeedControl() {
  const playbackSpeed = usePlaybackStore((state) => state.playbackSpeed);
  const setSpeed = usePlaybackStore((state) => state.setSpeed);

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-400">Speed:</span>
      <div className="flex overflow-hidden rounded-lg border border-gray-600">
        {SPEED_OPTIONS.map((speed) => (
          <button
            key={speed}
            onClick={() => setSpeed(speed)}
            className={clsx(
              "px-2 py-1 text-sm transition-colors",
              playbackSpeed === speed
                ? "bg-blue-600 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600",
            )}
          >
            {speed}x
          </button>
        ))}
      </div>
    </div>
  );
}
