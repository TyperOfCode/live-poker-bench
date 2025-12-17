import { api, HydrateClient } from "~/trpc/server";
import { notFound } from "next/navigation";
import { ReplayContent } from "./ReplayContent";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ tournamentId: string; handNumber: string }>;
}

export default async function ReplayPage({ params }: Props) {
  const { tournamentId, handNumber: handNumberStr } = await params;
  const handNumber = parseInt(handNumberStr, 10);

  if (isNaN(handNumber) || handNumber < 1) {
    notFound();
  }

  // Prefetch data for this hand
  void api.tournament.getHand.prefetch({ tournamentId, handNumber });
  void api.tournament.getMeta.prefetch({ tournamentId });
  void api.tournament.getHandCount.prefetch({ tournamentId });

  return (
    <HydrateClient>
      <ReplayContent tournamentId={tournamentId} handNumber={handNumber} />
    </HydrateClient>
  );
}
