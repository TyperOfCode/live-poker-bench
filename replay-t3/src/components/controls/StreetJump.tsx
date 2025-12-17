"use client";

import clsx from "clsx";
import { usePlaybackStore, selectCurrentFrame } from "~/store/playbackStore";
import { getStreetFrameIndices } from "~/utils/merger";

const STREETS = ["preflop", "flop", "turn", "river", "showdown"] as const;

const STREET_LABELS: Record<string, string> = {
  preflop: "Pre",
  flop: "Flop",
  turn: "Turn",
  river: "River",
  showdown: "SD",
};

export function StreetJump() {
  const frames = usePlaybackStore((state) => state.frames);
  const currentFrame = usePlaybackStore(selectCurrentFrame);
  const jumpToStreet = usePlaybackStore((state) => state.jumpToStreet);

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
              "rounded px-2 py-1 text-xs transition-colors",
              isActive && "bg-blue-600 text-white",
              !isActive &&
                hasStreet &&
                "bg-gray-700 text-gray-300 hover:bg-gray-600",
              !hasStreet && "cursor-not-allowed bg-gray-800 text-gray-500",
            )}
          >
            {STREET_LABELS[street]}
          </button>
        );
      })}
    </div>
  );
}
