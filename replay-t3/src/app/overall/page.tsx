import { api, HydrateClient } from "~/trpc/server";
import { Header } from "~/components/layout";
import { OverallContent } from "./OverallContent";

export const dynamic = "force-dynamic";

export default async function OverallPage() {
  // Prefetch overall statistics
  void api.statistics.overall.prefetch();

  return (
    <HydrateClient>
      <div className="flex h-screen flex-col overflow-hidden">
        <Header />
        <OverallContent />
      </div>
    </HydrateClient>
  );
}
