import { api, HydrateClient } from "~/trpc/server";
import { Header } from "~/components/layout";
import { SummaryContent } from "./SummaryContent";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ tournamentId: string }>;
}

export default async function SummaryPage({ params }: Props) {
  const { tournamentId } = await params;

  // Prefetch statistics for this tournament
  void api.statistics.tournament.prefetch({ tournamentId });

  return (
    <HydrateClient>
      <div className="flex h-screen flex-col overflow-hidden">
        <Header tournamentId={tournamentId} />
        <SummaryContent tournamentId={tournamentId} />
      </div>
    </HydrateClient>
  );
}
