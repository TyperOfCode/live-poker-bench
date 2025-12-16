import { create } from 'zustand';
import type { HandData, AgentHandData, TournamentState, ReplayFrame } from '../types';
import { loadHandAndAgentData, loadFullTournament, mergeHandAndAgentData, listAvailableTournaments } from '../data';

export type ActiveView = 'replay' | 'summary' | 'overall' | 'about';

interface ReplayStore {
  // View state
  activeView: ActiveView;

  // Tournament state
  tournamentId: string | null;
  tournament: TournamentState | null;
  availableTournaments: string[];
  isLoadingTournament: boolean;

  // Current hand state
  currentHandNumber: number;
  handData: HandData | null;
  agentData: AgentHandData | null;
  frames: ReplayFrame[];
  isLoadingHand: boolean;

  // Playback state
  currentFrameIndex: number;
  isPlaying: boolean;
  playbackSpeed: number; // 0.5, 1, 2, 4

  // Selected agent for reasoning panel
  selectedSeat: number | null;

  // Error state
  error: string | null;

  // Actions
  setActiveView: (view: ActiveView) => void;
  loadAvailableTournaments: () => Promise<void>;
  loadTournament: (id: string) => Promise<void>;
  loadHand: (handNumber: number) => Promise<void>;

  // Playback controls
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  stepForward: () => void;
  stepBackward: () => void;
  jumpToFrame: (index: number) => void;
  jumpToStreet: (street: string) => void;
  setSpeed: (speed: number) => void;

  // Navigation
  nextHand: () => void;
  previousHand: () => void;
  goToHand: (handNumber: number) => void;

  // Agent selection
  selectSeat: (seat: number | null) => void;

  // Reset
  reset: () => void;
}

export const useReplayStore = create<ReplayStore>((set, get) => ({
  // Initial state
  activeView: 'replay',
  tournamentId: null,
  tournament: null,
  availableTournaments: [],
  isLoadingTournament: false,
  currentHandNumber: 1,
  handData: null,
  agentData: null,
  frames: [],
  isLoadingHand: false,
  currentFrameIndex: 0,
  isPlaying: false,
  playbackSpeed: 1,
  selectedSeat: null,
  error: null,

  // View actions
  setActiveView: (view) => set({ activeView: view }),

  // Load available tournaments
  loadAvailableTournaments: async () => {
    const available = await listAvailableTournaments();
    set({ availableTournaments: available });
  },

  // Load tournament
  loadTournament: async (id: string) => {
    set({ isLoadingTournament: true, error: null });
    try {
      const tournament = await loadFullTournament(id);
      set({
        tournamentId: id,
        tournament,
        isLoadingTournament: false,
        currentHandNumber: 1,
      });
      // Auto-load first hand
      await get().loadHand(1);
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to load tournament',
        isLoadingTournament: false,
      });
    }
  },

  // Load hand
  loadHand: async (handNumber: number) => {
    const { tournamentId } = get();
    if (!tournamentId) return;

    set({ isLoadingHand: true, error: null, isPlaying: false });
    try {
      const { hand, agent } = await loadHandAndAgentData(tournamentId, handNumber);
      const frames = mergeHandAndAgentData(hand, agent);

      set({
        currentHandNumber: handNumber,
        handData: hand,
        agentData: agent,
        frames,
        currentFrameIndex: 0,
        isLoadingHand: false,
        selectedSeat: null,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : `Failed to load hand ${handNumber}`,
        isLoadingHand: false,
      });
    }
  },

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

  // Navigation
  nextHand: async () => {
    const { currentHandNumber, tournament } = get();
    if (tournament && currentHandNumber < tournament.handCount) {
      await get().loadHand(currentHandNumber + 1);
    }
  },

  previousHand: async () => {
    const { currentHandNumber } = get();
    if (currentHandNumber > 1) {
      await get().loadHand(currentHandNumber - 1);
    }
  },

  goToHand: async (handNumber: number) => {
    const { tournament } = get();
    if (tournament && handNumber >= 1 && handNumber <= tournament.handCount) {
      await get().loadHand(handNumber);
    }
  },

  // Agent selection
  selectSeat: (seat: number | null) => set({ selectedSeat: seat }),

  // Reset
  reset: () =>
    set({
      activeView: 'replay',
      tournamentId: null,
      tournament: null,
      availableTournaments: [],
      currentHandNumber: 1,
      handData: null,
      agentData: null,
      frames: [],
      currentFrameIndex: 0,
      isPlaying: false,
      playbackSpeed: 1,
      selectedSeat: null,
      error: null,
    }),
}));

// Selectors
export const selectCurrentFrame = (state: ReplayStore) =>
  state.frames[state.currentFrameIndex] || null;

export const selectProgress = (state: ReplayStore) =>
  state.frames.length > 0
    ? (state.currentFrameIndex / (state.frames.length - 1)) * 100
    : 0;

export const selectCanStepForward = (state: ReplayStore) =>
  state.currentFrameIndex < state.frames.length - 1;

export const selectCanStepBackward = (state: ReplayStore) =>
  state.currentFrameIndex > 0;

export const selectSelectedDecision = (state: ReplayStore) => {
  const currentFrame = selectCurrentFrame(state);
  if (!currentFrame || state.selectedSeat === null) return null;

  // Find agent decision for selected seat around current frame
  const { agentData } = state;
  if (!agentData) return null;

  const seatDecisions = agentData.decisions[String(state.selectedSeat)];
  if (!seatDecisions || seatDecisions.length === 0) return null;

  // Find the most recent decision for this seat up to current frame
  const currentFrameStreet = currentFrame.street;
  return seatDecisions.find(
    (d) => d.street === currentFrameStreet
  ) || seatDecisions[seatDecisions.length - 1];
};
