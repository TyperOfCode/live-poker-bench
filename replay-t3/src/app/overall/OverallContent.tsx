"use client";

import { api } from "~/trpc/react";
import {
  StatCard,
  ModelRankingsTable,
  PlacementDistributionChart,
} from "~/components/statistics";
import { STAT_EXPLAINERS } from "~/server/statistics/statExplainers";

function getOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0] ?? "th");
}

function getPlacementColor(placement: number): string {
  const colors: Record<number, string> = {
    1: "#FFD700",
    2: "#C0C0C0",
    3: "#CD7F32",
    4: "#6B7280",
    5: "#4B5563",
  };
  return colors[placement] ?? "#374151";
}

export function OverallContent() {
  const { data: stats, isLoading, refetch } = api.statistics.overall.useQuery(
    undefined,
    { staleTime: Infinity }
  );

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <div className="text-gray-400">Loading overall statistics...</div>
        </div>
      </div>
    );
  }

  if (!stats || stats.tournamentsLoaded === 0) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center text-gray-400">
          No statistics available.
        </div>
      </div>
    );
  }

  const models = Object.values(stats.modelStats);
  const totalDecisions = models.reduce((sum, m) => sum + m.totalDecisions, 0);
  const totalErrors = models.reduce((sum, m) => sum + m.totalErrors, 0);
  const bestModel = stats.rankings[0];

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Overall Statistics</h1>
            <p className="mt-1 text-gray-400">
              Aggregate performance across {stats.tournamentsLoaded} tournament
              {stats.tournamentsLoaded !== 1 ? "s" : ""}
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="text-gray-400 transition-colors hover:text-white"
            title="Reload statistics"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard
            label="Tournaments Analyzed"
            value={stats.tournamentsLoaded}
            subValue={`${stats.tournamentsTotal} available`}
            tooltip={STAT_EXPLAINERS.tournaments}
          />
          <StatCard label="Models Tracked" value={models.length} />
          <StatCard
            label="Total Decisions"
            value={totalDecisions.toLocaleString()}
            subValue={`${totalErrors} errors (${((totalErrors / totalDecisions) * 100).toFixed(2)}%)`}
            tooltip={STAT_EXPLAINERS.decisions}
          />
          <StatCard
            label="Best Performer"
            value={bestModel?.modelName ?? "-"}
            subValue={
              bestModel ? `${bestModel.winRate.toFixed(1)}% win rate` : undefined
            }
            tooltip={STAT_EXPLAINERS.winRate}
          />
        </div>

        {/* Overall Poker Metrics */}
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-300">
            Overall Poker Metrics
          </h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7">
            <StatCard
              label="Avg VPIP"
              value={`${stats.overallAvgVpip.toFixed(1)}%`}
              tooltip={STAT_EXPLAINERS.vpip}
              size="sm"
            />
            <StatCard
              label="Avg PFR"
              value={`${stats.overallAvgPfr.toFixed(1)}%`}
              tooltip={STAT_EXPLAINERS.pfr}
              size="sm"
            />
            <StatCard
              label="Avg AF"
              value={stats.overallAvgAf.toFixed(2)}
              tooltip={STAT_EXPLAINERS.af}
              size="sm"
            />
            <StatCard
              label="Avg WTSD"
              value={`${stats.overallAvgWtsd.toFixed(1)}%`}
              tooltip={STAT_EXPLAINERS.wtsd}
              size="sm"
            />
            <StatCard
              label="Avg W$SD"
              value={`${stats.overallAvgWasd.toFixed(1)}%`}
              tooltip={STAT_EXPLAINERS.wasd}
              size="sm"
            />
            <StatCard
              label="Total Hands"
              value={stats.totalHandsPlayed.toLocaleString()}
              tooltip={STAT_EXPLAINERS.handsPlayed}
              size="sm"
            />
            <StatCard
              label="Hands Won"
              value={stats.totalHandsWon.toLocaleString()}
              subValue={`${((stats.totalHandsWon / stats.totalHandsPlayed) * 100).toFixed(1)}%`}
              tooltip={STAT_EXPLAINERS.handsWon}
              size="sm"
            />
          </div>
        </section>

        {/* Model Rankings */}
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-300">
            Model Rankings
          </h2>
          <ModelRankingsTable rankings={stats.rankings} />
        </section>

        {/* Placement Distribution */}
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-300">
            Placement Distribution
          </h2>
          <div className="h-80 rounded-lg bg-gray-800 p-4">
            <PlacementDistributionChart modelStats={stats.modelStats} />
          </div>
        </section>

        {/* Model Details Grid */}
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-300">
            Model Details
          </h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {models
              .sort((a, b) => {
                const aRank = stats.rankings.findIndex(
                  (r) => r.modelName === a.modelName
                );
                const bRank = stats.rankings.findIndex(
                  (r) => r.modelName === b.modelName
                );
                return aRank - bRank;
              })
              .map((model, idx) => (
                <div key={model.modelName} className="rounded-lg bg-gray-800 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-sm text-gray-500">#{idx + 1}</span>
                    <span
                      className="truncate font-medium text-white"
                      title={model.modelName}
                    >
                      {idx === 0 && "🏆 "}
                      {model.modelName}
                    </span>
                  </div>

                  <div className="space-y-2 text-sm">
                    {/* Tournament Stats */}
                    <div
                      className="flex justify-between"
                      title={STAT_EXPLAINERS.tournaments}
                    >
                      <span className="text-gray-500">Tournaments</span>
                      <span className="font-mono text-gray-300">
                        {model.tournamentsPlayed}
                      </span>
                    </div>
                    <div
                      className="flex justify-between"
                      title={STAT_EXPLAINERS.wins}
                    >
                      <span className="text-gray-500">Wins</span>
                      <span className="font-mono text-green-400">
                        {model.wins}
                      </span>
                    </div>
                    <div
                      className="flex justify-between"
                      title={STAT_EXPLAINERS.winRate}
                    >
                      <span className="text-gray-500">Win Rate</span>
                      <span className="font-mono text-gray-300">
                        {((model.wins / model.tournamentsPlayed) * 100).toFixed(
                          1
                        )}
                        %
                      </span>
                    </div>
                    <div
                      className="flex justify-between"
                      title={STAT_EXPLAINERS.avgPlacement}
                    >
                      <span className="text-gray-500">Avg Placement</span>
                      <span className="font-mono text-gray-300">
                        {model.avgPlacement.toFixed(2)}
                      </span>
                    </div>

                    {/* Poker Stats */}
                    <div className="mt-2 border-t border-gray-700 pt-2">
                      <div className="mb-1 text-xs text-gray-500">
                        Poker Stats
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        <div
                          className="flex justify-between"
                          title={STAT_EXPLAINERS.vpip}
                        >
                          <span className="text-gray-500">VPIP</span>
                          <span className="font-mono text-gray-300">
                            {model.avgVpip.toFixed(1)}%
                          </span>
                        </div>
                        <div
                          className="flex justify-between"
                          title={STAT_EXPLAINERS.pfr}
                        >
                          <span className="text-gray-500">PFR</span>
                          <span className="font-mono text-gray-300">
                            {model.avgPfr.toFixed(1)}%
                          </span>
                        </div>
                        <div
                          className="flex justify-between"
                          title={STAT_EXPLAINERS.af}
                        >
                          <span className="text-gray-500">AF</span>
                          <span className="font-mono text-gray-300">
                            {model.avgAggressionFactor.toFixed(2)}
                          </span>
                        </div>
                        <div
                          className="flex justify-between"
                          title={STAT_EXPLAINERS.threeBet}
                        >
                          <span className="text-gray-500">3-Bet</span>
                          <span className="font-mono text-gray-300">
                            {model.avgThreeBetPercent.toFixed(1)}%
                          </span>
                        </div>
                        <div
                          className="flex justify-between"
                          title={STAT_EXPLAINERS.wtsd}
                        >
                          <span className="text-gray-500">WTSD</span>
                          <span className="font-mono text-gray-300">
                            {model.avgWtsd.toFixed(1)}%
                          </span>
                        </div>
                        <div
                          className="flex justify-between"
                          title={STAT_EXPLAINERS.wasd}
                        >
                          <span className="text-gray-500">W$SD</span>
                          <span className="font-mono text-gray-300">
                            {model.avgWasd.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Hands & Decisions */}
                    <div className="mt-2 border-t border-gray-700 pt-2">
                      <div className="mb-1 text-xs text-gray-500">
                        Performance
                      </div>
                      <div
                        className="flex justify-between"
                        title={STAT_EXPLAINERS.handsPlayed}
                      >
                        <span className="text-gray-500">Hands Played</span>
                        <span className="font-mono text-gray-300">
                          {model.totalHandsPlayed.toLocaleString()}
                        </span>
                      </div>
                      <div
                        className="flex justify-between"
                        title={STAT_EXPLAINERS.handsWon}
                      >
                        <span className="text-gray-500">Hands Won</span>
                        <span className="font-mono text-gray-300">
                          {model.totalHandsWon.toLocaleString()}
                        </span>
                      </div>
                      <div
                        className="flex justify-between"
                        title={STAT_EXPLAINERS.decisions}
                      >
                        <span className="text-gray-500">Total Decisions</span>
                        <span className="font-mono text-gray-300">
                          {model.totalDecisions.toLocaleString()}
                        </span>
                      </div>
                      <div
                        className="flex justify-between"
                        title={STAT_EXPLAINERS.errorRate}
                      >
                        <span className="text-gray-500">Error Rate</span>
                        <span
                          className={
                            model.totalErrors > 0
                              ? "font-mono text-red-400"
                              : "font-mono text-gray-500"
                          }
                        >
                          {model.totalDecisions > 0
                            ? `${((model.totalErrors / model.totalDecisions) * 100).toFixed(2)}%`
                            : "-"}
                        </span>
                      </div>
                      {model.avgEliminationHand > 0 && (
                        <div
                          className="flex justify-between"
                          title={STAT_EXPLAINERS.avgEliminationHand}
                        >
                          <span className="text-gray-500">Avg Elim Hand</span>
                          <span className="font-mono text-gray-300">
                            {model.avgEliminationHand.toFixed(1)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Placement distribution mini bar */}
                    <div className="mt-2 border-t border-gray-700 pt-2">
                      <div className="mb-1 text-xs text-gray-500">
                        Placements
                      </div>
                      <div className="flex gap-1">
                        {Object.entries(model.placementDistribution)
                          .sort(([a], [b]) => Number(a) - Number(b))
                          .map(([place, count]) => (
                            <div
                              key={place}
                              className="flex-1 text-center"
                              title={`${getOrdinal(Number(place))} place: ${count} time${count !== 1 ? "s" : ""}`}
                            >
                              <div
                                className="mb-1 h-4 rounded-sm"
                                style={{
                                  backgroundColor: getPlacementColor(
                                    Number(place)
                                  ),
                                  opacity:
                                    0.3 + (count / model.tournamentsPlayed) * 0.7,
                                }}
                              />
                              <div className="text-xs text-gray-500">{place}</div>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </section>
      </div>
    </div>
  );
}
