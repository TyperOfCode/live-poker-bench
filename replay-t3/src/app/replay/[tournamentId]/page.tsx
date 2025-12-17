import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ tournamentId: string }>;
}

export default async function TournamentIndex({ params }: Props) {
  const { tournamentId } = await params;
  redirect(`/replay/${tournamentId}/1`);
}
