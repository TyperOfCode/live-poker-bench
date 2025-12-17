"use client";

import { useEffect, useRef } from "react";
import { usePlaybackStore } from "~/store/playbackStore";

const BASE_FRAME_DURATION = 1500; // ms

export function useAutoPlay() {
  const isPlaying = usePlaybackStore((state) => state.isPlaying);
  const playbackSpeed = usePlaybackStore((state) => state.playbackSpeed);
  const currentFrameIndex = usePlaybackStore((state) => state.currentFrameIndex);
  const framesLength = usePlaybackStore((state) => state.frames.length);
  const stepForward = usePlaybackStore((state) => state.stepForward);
  const pause = usePlaybackStore((state) => state.pause);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Clear any existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // If playing and not at end, schedule next frame
    if (isPlaying && currentFrameIndex < framesLength - 1) {
      const duration = BASE_FRAME_DURATION / playbackSpeed;

      timerRef.current = setTimeout(() => {
        stepForward();
      }, duration);
    } else if (isPlaying && currentFrameIndex >= framesLength - 1) {
      // Auto-pause at end
      pause();
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [isPlaying, currentFrameIndex, framesLength, playbackSpeed, stepForward, pause]);
}
