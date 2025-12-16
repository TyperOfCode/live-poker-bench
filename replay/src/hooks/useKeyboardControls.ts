import { useEffect } from 'react';
import { useReplayStore } from '../state/replayStore';

export function useKeyboardControls() {
  const togglePlay = useReplayStore((state) => state.togglePlay);
  const stepForward = useReplayStore((state) => state.stepForward);
  const stepBackward = useReplayStore((state) => state.stepBackward);
  const nextHand = useReplayStore((state) => state.nextHand);
  const previousHand = useReplayStore((state) => state.previousHand);

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
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowRight':
          e.preventDefault();
          stepForward();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          stepBackward();
          break;
        case 'ArrowUp':
          e.preventDefault();
          previousHand();
          break;
        case 'ArrowDown':
          e.preventDefault();
          nextHand();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, stepForward, stepBackward, nextHand, previousHand]);
}
