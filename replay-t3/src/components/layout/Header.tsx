"use client";

import { TopNavigation } from "./TopNavigation";
import { TournamentSelector } from "./TournamentSelector";
import { HandNavigation } from "~/components/controls/HandNavigation";
import { usePathname } from "next/navigation";

interface HeaderProps {
  tournamentId?: string;
  currentHandNumber?: number;
  blindLevel?: { level: number; sb: number; bb: number } | null;
}

export function Header({ tournamentId, currentHandNumber, blindLevel }: HeaderProps) {
  const pathname = usePathname();
  const isReplayView = pathname.startsWith("/replay");
  const showTournamentSelector = !pathname.startsWith("/overall") && pathname !== "/about";
  const showBlinds = isReplayView && blindLevel && currentHandNumber;

  return (
    <header className="border-b border-gray-700 bg-gray-900 px-4 py-3">
      <div className="mx-auto flex max-w-screen-2xl items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-bold text-white">
            Poker Tournament Replay
          </h1>
          <TopNavigation />
          {showTournamentSelector && <TournamentSelector currentId={tournamentId} />}
        </div>

        {showBlinds && tournamentId && currentHandNumber && (
          <div className="flex items-center gap-6">
            <HandNavigation tournamentId={tournamentId} currentHandNumber={currentHandNumber} />
            <div className="text-sm text-gray-400">
              Level {blindLevel.level} ({blindLevel.sb}/{blindLevel.bb})
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
