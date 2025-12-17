"use client";

import { usePlaybackStore, selectProgress } from "~/store/playbackStore";
import { getStreetFrameIndices } from "~/utils/merger";

export function Timeline() {
  const frames = usePlaybackStore((state) => state.frames);
  const currentFrameIndex = usePlaybackStore((state) => state.currentFrameIndex);
  const jumpToFrame = usePlaybackStore((state) => state.jumpToFrame);
  const progress = usePlaybackStore(selectProgress);

  const streetIndices = getStreetFrameIndices(frames);
  const totalFrames = frames.length;

  // Calculate street marker positions
  const streetMarkers = Object.entries(streetIndices)
    .filter(([, idx]) => idx >= 0)
    .map(([street, idx]) => ({
      street,
      position: totalFrames > 1 ? (idx / (totalFrames - 1)) * 100 : 0,
    }));

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const frameIndex = Math.round(percentage * (totalFrames - 1));
    jumpToFrame(frameIndex);
  };

  return (
    <div className="w-full">
      {/* Timeline track */}
      <div
        className="relative h-2 cursor-pointer rounded-full bg-gray-700"
        onClick={handleClick}
      >
        {/* Progress fill */}
        <div
          className="absolute h-full rounded-full bg-blue-500 transition-all duration-100"
          style={{ width: `${progress}%` }}
        />

        {/* Street markers */}
        {streetMarkers.map(({ street, position }) => (
          <div
            key={street}
            className="absolute top-0 h-full w-0.5 bg-gray-500"
            style={{ left: `${position}%` }}
            title={street}
          />
        ))}

        {/* Current position indicator */}
        <div
          className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-white shadow-md transition-all duration-100"
          style={{ left: `calc(${progress}% - 6px)` }}
        />
      </div>

      {/* Frame counter */}
      <div className="mt-1 flex justify-between text-xs text-gray-400">
        <span>
          Frame {currentFrameIndex + 1} / {totalFrames}
        </span>
        <span>{frames[currentFrameIndex]?.street ?? "-"}</span>
      </div>
    </div>
  );
}
