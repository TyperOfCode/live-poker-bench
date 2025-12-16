import { useReplayStore, selectProgress } from '../../state/replayStore';
import { getStreetFrameIndices } from '../../data/merger';

export function Timeline() {
  const frames = useReplayStore((state) => state.frames);
  const currentFrameIndex = useReplayStore((state) => state.currentFrameIndex);
  const jumpToFrame = useReplayStore((state) => state.jumpToFrame);
  const progress = useReplayStore(selectProgress);

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
        className="relative h-2 bg-gray-700 rounded-full cursor-pointer"
        onClick={handleClick}
      >
        {/* Progress fill */}
        <div
          className="absolute h-full bg-blue-500 rounded-full transition-all duration-100"
          style={{ width: `${progress}%` }}
        />

        {/* Street markers */}
        {streetMarkers.map(({ street, position }) => (
          <div
            key={street}
            className="absolute top-0 w-0.5 h-full bg-gray-500"
            style={{ left: `${position}%` }}
            title={street}
          />
        ))}

        {/* Current position indicator */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md transition-all duration-100"
          style={{ left: `calc(${progress}% - 6px)` }}
        />
      </div>

      {/* Frame counter */}
      <div className="flex justify-between mt-1 text-xs text-gray-400">
        <span>Frame {currentFrameIndex + 1} / {totalFrames}</span>
        <span>{frames[currentFrameIndex]?.street || '-'}</span>
      </div>
    </div>
  );
}

export default Timeline;
