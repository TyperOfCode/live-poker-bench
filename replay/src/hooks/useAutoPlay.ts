import { useEffect, useRef } from 'react';
import { useReplayStore } from '../state/replayStore';

const BASE_FRAME_DURATION = 1500; // ms

export function useAutoPlay() {
  const isPlaying = useReplayStore((state) => state.isPlaying);
  const playbackSpeed = useReplayStore((state) => state.playbackSpeed);
  const currentFrameIndex = useReplayStore((state) => state.currentFrameIndex);
  const framesLength = useReplayStore((state) => state.frames.length);
  const stepForward = useReplayStore((state) => state.stepForward);
  const pause = useReplayStore((state) => state.pause);

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
