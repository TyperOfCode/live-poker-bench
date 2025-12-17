"use client";

import { useRouter, usePathname } from "next/navigation";
import { api } from "~/trpc/react";

interface TournamentSelectorProps {
  currentId?: string;
}

export function TournamentSelector({ currentId }: TournamentSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: tournaments } = api.tournament.list.useQuery();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;

    // Determine which route pattern we're on and navigate accordingly
    if (pathname.startsWith("/replay")) {
      router.push(`/replay/${newId}/1`);
    } else if (pathname.startsWith("/summary")) {
      router.push(`/summary/${newId}`);
    }
  };

  if (!tournaments || tournaments.length === 0) {
    return null;
  }

  return (
    <select
      value={currentId ?? ""}
      onChange={handleChange}
      className="rounded border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-white hover:border-gray-500 focus:border-blue-500 focus:outline-none"
    >
      {tournaments.map((id) => (
        <option key={id} value={id}>
          Tournament {parseInt(id.replace("tournament_", ""), 10)}
        </option>
      ))}
    </select>
  );
}
