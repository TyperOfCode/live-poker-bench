"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";

interface HandNavigationProps {
  tournamentId: string;
  currentHandNumber: number;
}

export function HandNavigation({ tournamentId, currentHandNumber }: HandNavigationProps) {
  const router = useRouter();
  const { data: handCount } = api.tournament.getHandCount.useQuery({ tournamentId });

  const canGoPrev = currentHandNumber > 1;
  const canGoNext = handCount !== undefined && currentHandNumber < handCount;

  const goToHand = (handNumber: number) => {
    router.push(`/replay/${tournamentId}/${handNumber}`);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => goToHand(currentHandNumber - 1)}
        disabled={!canGoPrev}
        className={clsx(
          "rounded p-1 transition-colors",
          "bg-gray-700 text-white hover:bg-gray-600",
          "disabled:cursor-not-allowed disabled:opacity-40",
        )}
        title="Previous hand (Up Arrow)"
      >
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" />
        </svg>
      </button>

      <div className="min-w-[80px] text-center font-mono text-sm text-white">
        Hand <span className="font-bold">{currentHandNumber}</span>
        <span className="text-gray-400">/{handCount ?? "..."}</span>
      </div>

      <button
        onClick={() => goToHand(currentHandNumber + 1)}
        disabled={!canGoNext}
        className={clsx(
          "rounded p-1 transition-colors",
          "bg-gray-700 text-white hover:bg-gray-600",
          "disabled:cursor-not-allowed disabled:opacity-40",
        )}
        title="Next hand (Down Arrow)"
      >
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
        </svg>
      </button>
    </div>
  );
}
