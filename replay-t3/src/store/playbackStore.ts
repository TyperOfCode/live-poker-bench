"use client";

import { create } from "zustand";
import type { ReplayFrame, AgentHandData, AgentDecision } from "~/types";

interface PlaybackStore {
  // Playback state
  currentFrameIndex: number;
  isPlaying: boolean;
  playbackSpeed: number; // 0.5, 1, 2, 4

  // Current frames (set when hand data loads)
  frames: ReplayFrame[];

  // Current agent data (for decision lookup)
  agentData: AgentHandData | null;

  // Selected agent for reasoning panel
  selectedSeat: number | null;

  // Actions
  setFrames: (frames: ReplayFrame[], agentData: AgentHandData | null) => void;
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  stepForward: () => void;
  stepBackward: () => void;
  jumpToFrame: (index: number) => void;
  jumpToStreet: (street: string) => void;
  setSpeed: (speed: number) => void;
  selectSeat: (seat: number | null) => void;
  reset: () => void;
}

export const usePlaybackStore = create<PlaybackStore>((set, get) => ({
  // Initial state
  currentFrameIndex: 0,
  isPlaying: false,
  playbackSpeed: 1,
  frames: [],
  agentData: null,
  selectedSeat: null,

  // Set frames when hand data loads
  setFrames: (frames, agentData) =>
    set({
      frames,
      agentData,
      currentFrameIndex: 0,
      isPlaying: false,
      selectedSeat: null,
    }),

  // Playback controls
  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  togglePlay: () => set((state) => ({ isPlaying: !state.isPlaying })),

  stepForward: () => {
    const { currentFrameIndex, frames } = get();
    if (currentFrameIndex < frames.length - 1) {
      set({ currentFrameIndex: currentFrameIndex + 1 });
    }
  },

  stepBackward: () => {
    const { currentFrameIndex } = get();
    if (currentFrameIndex > 0) {
      set({ currentFrameIndex: currentFrameIndex - 1 });
    }
  },

  jumpToFrame: (index: number) => {
    const { frames } = get();
    if (index >= 0 && index < frames.length) {
      set({ currentFrameIndex: index, isPlaying: false });
    }
  },

  jumpToStreet: (street: string) => {
    const { frames } = get();
    const targetIndex = frames.findIndex((f) => f.street === street);
    if (targetIndex >= 0) {
      set({ currentFrameIndex: targetIndex, isPlaying: false });
    }
  },

  setSpeed: (speed: number) => set({ playbackSpeed: speed }),

  // Agent selection
  selectSeat: (seat: number | null) => set({ selectedSeat: seat }),

  // Reset
  reset: () =>
    set({
      currentFrameIndex: 0,
      isPlaying: false,
      playbackSpeed: 1,
      frames: [],
      agentData: null,
      selectedSeat: null,
    }),
}));

// Selectors
export const selectCurrentFrame = (state: PlaybackStore): ReplayFrame | null =>
  state.frames[state.currentFrameIndex] ?? null;

export const selectProgress = (state: PlaybackStore): number =>
  state.frames.length > 0
    ? (state.currentFrameIndex / (state.frames.length - 1)) * 100
    : 0;

export const selectCanStepForward = (state: PlaybackStore): boolean =>
  state.currentFrameIndex < state.frames.length - 1;

export const selectCanStepBackward = (state: PlaybackStore): boolean =>
  state.currentFrameIndex > 0;

export const selectSelectedDecision = (state: PlaybackStore): AgentDecision | null => {
  const currentFrame = selectCurrentFrame(state);
  if (!currentFrame || state.selectedSeat === null) return null;

  // Find agent decision for selected seat around current frame
  const { agentData } = state;
  if (!agentData) return null;

  const seatDecisions = agentData.decisions[String(state.selectedSeat)];
  if (!seatDecisions || seatDecisions.length === 0) return null;

  // Find the most recent decision for this seat up to current frame
  const currentFrameStreet = currentFrame.street;
  return (
    seatDecisions.find((d) => d.street === currentFrameStreet) ??
    seatDecisions[seatDecisions.length - 1] ??
    null
  );
};
