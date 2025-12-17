"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePlaybackStore } from "~/store/playbackStore";

interface UseKeyboardControlsOptions {
  tournamentId: string;
  currentHandNumber: number;
  totalHands: number;
}

export function useKeyboardControls({
  tournamentId,
  currentHandNumber,
  totalHands,
}: UseKeyboardControlsOptions) {
  const router = useRouter();
  const togglePlay = usePlaybackStore((state) => state.togglePlay);
  const stepForward = usePlaybackStore((state) => state.stepForward);
  const stepBackward = usePlaybackStore((state) => state.stepBackward);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key) {
        case " ":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowRight":
          e.preventDefault();
          stepForward();
          break;
        case "ArrowLeft":
          e.preventDefault();
          stepBackward();
          break;
        case "ArrowUp":
          e.preventDefault();
          // Previous hand - navigate via URL
          if (currentHandNumber > 1) {
            router.push(`/replay/${tournamentId}/${currentHandNumber - 1}`);
          }
          break;
        case "ArrowDown":
          e.preventDefault();
          // Next hand - navigate via URL
          if (currentHandNumber < totalHands) {
            router.push(`/replay/${tournamentId}/${currentHandNumber + 1}`);
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    togglePlay,
    stepForward,
    stepBackward,
    router,
    tournamentId,
    currentHandNumber,
    totalHands,
  ]);
}
