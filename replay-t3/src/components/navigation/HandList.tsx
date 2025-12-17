"use client";

import clsx from "clsx";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { getBlindLevelForHand } from "~/utils/tournament";

interface HandListItemProps {
  handNumber: number;
  isActive: boolean;
  blindLevel: { level: number; sb: number; bb: number };
  onClick: () => void;
}

function HandListItem({
  handNumber,
  isActive,
  blindLevel,
  onClick,
}: HandListItemProps) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex w-full items-center gap-2 px-3 py-2 text-left",
        "transition-colors hover:bg-gray-700",
        isActive && "border-l-4 border-blue-500 bg-blue-900",
      )}
    >
      <span className="font-mono text-sm text-gray-300">#{handNumber}</span>
      <span className="text-xs text-gray-500">
        L{blindLevel.level} ({blindLevel.sb}/{blindLevel.bb})
      </span>
    </button>
  );
}

interface HandListProps {
  tournamentId: string;
  currentHandNumber: number;
}

export function HandList({ tournamentId, currentHandNumber }: HandListProps) {
  const router = useRouter();
  const { data: meta } = api.tournament.getMeta.useQuery({ tournamentId });
  const { data: handCount } = api.tournament.getHandCount.useQuery({
    tournamentId,
  });

  if (!meta || !handCount) {
    return (
      <div className="p-4 text-center text-sm text-gray-400">Loading...</div>
    );
  }

  const hands = Array.from({ length: handCount }, (_, i) => i + 1);

  const goToHand = (handNumber: number) => {
    router.push(`/replay/${tournamentId}/${handNumber}`);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex-shrink-0 border-b border-gray-700 p-3">
        <h3 className="text-sm font-semibold text-gray-300">
          Hands ({handCount})
        </h3>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {hands.map((handNumber) => (
          <HandListItem
            key={handNumber}
            handNumber={handNumber}
            isActive={handNumber === currentHandNumber}
            blindLevel={getBlindLevelForHand(handNumber, meta)}
            onClick={() => goToHand(handNumber)}
          />
        ))}
      </div>
    </div>
  );
}
