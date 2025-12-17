"use client";

import clsx from "clsx";
import { api } from "~/trpc/react";
import { getSortedPlacements } from "~/utils/tournament";

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  const suffix = s[(v - 20) % 10] ?? s[v] ?? "th";
  return `${n}${suffix}`;
}

interface EliminationTrackerProps {
  tournamentId: string;
}

export function EliminationTracker({ tournamentId }: EliminationTrackerProps) {
  const { data: results } = api.tournament.getResults.useQuery({ tournamentId });

  if (!results) {
    return null;
  }

  const placements = getSortedPlacements(results);

  return (
    <div className="p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-400">
        FINAL STANDINGS
      </h3>
      <div className="space-y-1">
        {placements.map(({ name, placement }) => (
          <div
            key={name}
            className={clsx(
              "flex items-center justify-between rounded p-2 text-sm",
              placement === 1 && "bg-yellow-900/30 text-yellow-400",
              placement === 2 && "bg-gray-600/30 text-gray-300",
              placement === 3 && "bg-orange-900/30 text-orange-400",
              placement > 3 && "bg-gray-800/50 text-gray-400",
            )}
          >
            <span className="flex-1 truncate">{name}</span>
            <span className="ml-2 font-mono">
              {placement === 1 && "  "}
              {ordinal(placement)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
