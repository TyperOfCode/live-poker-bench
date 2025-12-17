"use client";

import { useEffect, useCallback } from "react";
import { api } from "~/trpc/react";
import { usePlaybackStore, selectCurrentFrame } from "~/store/playbackStore";
import { mergeHandAndAgentData, computeGameStateAtFrame } from "~/utils/merger";
import { getBlindLevelForHand } from "~/utils/tournament";
import { Header } from "~/components/layout";
import { PokerTable } from "~/components/table";
import {
  PlaybackControls,
  SpeedControl,
  StreetJump,
  Timeline,
  HandNavigation,
} from "~/components/controls";
import { HandList, EliminationTracker, ChipLeaderboard } from "~/components/navigation";
import { AIReasoningPanel } from "~/components/reasoning";
import { useAutoPlay, useKeyboardControls } from "~/hooks";

interface ReplayContentProps {
  tournamentId: string;
  handNumber: number;
}

export function ReplayContent({ tournamentId, handNumber }: ReplayContentProps) {
  const { data: handData, isLoading: isLoadingHand } = api.tournament.getHand.useQuery(
    { tournamentId, handNumber },
    { staleTime: Infinity },
  );

  const { data: meta } = api.tournament.getMeta.useQuery(
    { tournamentId },
    { staleTime: Infinity },
  );

  const { data: handCount } = api.tournament.getHandCount.useQuery(
    { tournamentId },
    { staleTime: Infinity },
  );

  const setFrames = usePlaybackStore((state) => state.setFrames);
  const currentFrameIndex = usePlaybackStore((state) => state.currentFrameIndex);
  const currentFrame = usePlaybackStore(selectCurrentFrame);
  const selectedSeat = usePlaybackStore((state) => state.selectedSeat);
  const selectSeat = usePlaybackStore((state) => state.selectSeat);

  // Handler for seat selection
  const handleSelectSeat = useCallback(
    (seat: number) => {
      selectSeat(selectedSeat === seat ? null : seat);
    },
    [selectedSeat, selectSeat],
  );

  // Compute blind level for this hand
  const blindLevel = meta ? getBlindLevelForHand(handNumber, meta) : null;

  // When hand data changes, compute frames and update store
  useEffect(() => {
    if (handData?.hand) {
      const mergedFrames = mergeHandAndAgentData(handData.hand, handData.agent);
      setFrames(mergedFrames, handData.agent);
    }
  }, [handData, setFrames]);

  // Auto-play functionality
  useAutoPlay();

  // Keyboard controls
  useKeyboardControls({
    tournamentId,
    currentHandNumber: handNumber,
    totalHands: handCount ?? 1,
  });

  if (isLoadingHand || !handData?.hand) {
    return (
      <div className="flex h-screen flex-col overflow-hidden">
        <Header tournamentId={tournamentId} />
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
            <div className="text-gray-400">Loading hand {handNumber}...</div>
          </div>
        </div>
      </div>
    );
  }

  // Compute game state at current frame
  const gameState = computeGameStateAtFrame(
    handData.hand,
    handData.agent,
    currentFrameIndex,
  );

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header
        tournamentId={tournamentId}
        currentHandNumber={handNumber}
        blindLevel={blindLevel}
      />

      <div className="flex min-h-0 flex-1 gap-4 overflow-hidden p-4">
        {/* Left sidebar - Navigation */}
        <div className="flex max-h-[calc(100vh-100px)] w-64 flex-shrink-0 flex-col overflow-hidden rounded-lg bg-gray-900">
          <div className="min-h-0 flex-1 overflow-hidden">
            <HandList
              tournamentId={tournamentId}
              currentHandNumber={handNumber}
            />
          </div>
          <div className="flex-shrink-0 border-t border-gray-700">
            <EliminationTracker tournamentId={tournamentId} />
          </div>
        </div>

        {/* Main area - Table + Controls */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Poker Table */}
          <div className="relative flex flex-1 items-center justify-center">
            <PokerTable
              players={gameState.players.map((p) => ({
                ...p,
                isEliminated: p.stack <= 0,
              }))}
              communityCards={gameState.communityCards}
              pot={gameState.pot}
              buttonSeat={gameState.buttonSeat}
              currentFrame={currentFrame}
              selectedSeat={selectedSeat}
              onSelectSeat={handleSelectSeat}
            />
          </div>

          {/* Playback Controls */}
          <div className="mt-4 space-y-3 rounded-lg bg-gray-900 p-4">
            {/* Main controls row */}
            <div className="flex items-center justify-between gap-4">
              <StreetJump />
              <PlaybackControls />
              <SpeedControl />
            </div>

            {/* Timeline */}
            <Timeline />

            {/* Hand navigation */}
            <div className="flex justify-center border-t border-gray-700 pt-3">
              <HandNavigation
                tournamentId={tournamentId}
                currentHandNumber={handNumber}
              />
            </div>
          </div>
        </div>

        {/* Right sidebar - AI Reasoning + Chip Leaderboard */}
        <div className="flex max-h-[calc(100vh-100px)] w-96 flex-shrink-0 flex-col gap-4 overflow-hidden">
          <div className="min-h-0 flex-1 overflow-hidden">
            <AIReasoningPanel
              tournamentId={tournamentId}
              handNumber={handNumber}
            />
          </div>
          <div className="flex-shrink-0 overflow-hidden rounded-lg bg-gray-900">
            <ChipLeaderboard
              tournamentId={tournamentId}
              handNumber={handNumber}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
