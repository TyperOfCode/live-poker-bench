"use client";

import clsx from "clsx";
import { usePlaybackStore } from "~/store/playbackStore";
import { api } from "~/trpc/react";

interface ChipLeaderboardProps {
  tournamentId: string;
  handNumber: number;
}

export function ChipLeaderboard({
  tournamentId,
  handNumber,
}: ChipLeaderboardProps) {
  const { data: handData } = api.tournament.getHand.useQuery({
    tournamentId,
    handNumber,
  });
  const agentData = usePlaybackStore((state) => state.agentData);
  const selectedSeat = usePlaybackStore((state) => state.selectedSeat);
  const selectSeat = usePlaybackStore((state) => state.selectSeat);

  if (!handData) {
    return null;
  }

  // Build player list with current stacks
  // Use agent observation data for more accurate stacks when available
  const players = handData.hand.players.map((player) => {
    // Try to get accurate stack from agent observation
    let stack = player.stack_start;

    // If we have agent data, look for this player's observation
    if (agentData) {
      const decisions = agentData.decisions[String(player.seat)];
      if (decisions && decisions.length > 0) {
        // Get the latest observation for this player
        const latestDecision = decisions[decisions.length - 1];
        if (latestDecision?.observation) {
          stack = latestDecision.observation.my_stack;
        }
      }
    }

    return {
      seat: player.seat,
      name: player.name,
      stack,
      isEliminated: stack <= 0,
    };
  });

  // Sort by stack descending
  const sorted = [...players].sort((a, b) => b.stack - a.stack);
  const totalChips = players.reduce(
    (sum, p) => sum + Math.max(0, p.stack),
    0,
  );

  return (
    <div className="p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-400">
        CHIP STANDINGS
      </h3>
      <div className="space-y-2">
        {sorted.map((player, idx) => (
          <button
            key={player.seat}
            onClick={() =>
              selectSeat(player.seat === selectedSeat ? null : player.seat)
            }
            className={clsx(
              "flex w-full items-center gap-2 rounded p-2 transition-colors",
              "hover:bg-gray-700",
              selectedSeat === player.seat &&
                "bg-gray-700 ring-1 ring-yellow-400",
              player.isEliminated && "opacity-50",
            )}
          >
            <span className="w-5 text-center text-sm font-bold text-gray-500">
              {idx + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm text-white">{player.name}</div>
              <div className="mt-1 h-1.5 overflow-hidden rounded bg-gray-700">
                <div
                  className="h-full bg-green-500 transition-all duration-300"
                  style={{
                    width: `${totalChips > 0 ? (Math.max(0, player.stack) / totalChips) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
            <span className="font-mono text-sm tabular-nums text-gray-300">
              {player.isEliminated ? (
                <span className="text-red-400">OUT</span>
              ) : (
                player.stack.toLocaleString()
              )}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
