"use client";

import { api } from "~/trpc/react";
import {
  StatCard,
  ChipProgressionChart,
  ActionBreakdownChart,
  TokenUsageChart,
  TimingStatsChart,
} from "~/components/statistics";

interface SummaryContentProps {
  tournamentId: string;
}

function getOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0] ?? "th");
}

export function SummaryContent({ tournamentId }: SummaryContentProps) {
  const { data: stats, isLoading } = api.statistics.tournament.useQuery(
    { tournamentId },
    { staleTime: Infinity }
  );

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <div className="text-gray-400">Loading tournament statistics...</div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center text-gray-400">
          No statistics available for this tournament.
        </div>
      </div>
    );
  }

  const totalActions = Object.values(stats.actionDistribution).reduce(
    (a, b) => a + b,
    0
  );
  const totalTokens = stats.agentStats.reduce(
    (sum, a) => sum + a.totalPromptTokens + a.totalCompletionTokens,
    0
  );
  const avgThinkingTime =
    stats.agentStats.length > 0
      ? stats.agentStats.reduce((sum, a) => sum + a.avgThinkingTimeMs, 0) /
        stats.agentStats.length
      : 0;

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">
            Tournament{" "}
            {parseInt(tournamentId.replace("tournament_", ""), 10)} Statistics
          </h1>
          <p className="mt-1 text-gray-400">
            Comprehensive analysis of poker performance metrics
          </p>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Total Hands" value={stats.totalHands} />
          <StatCard label="Players" value={stats.numPlayers} />
          <StatCard label="Starting Stack" value={stats.startingStack} />
          <StatCard label="Total Actions" value={totalActions} />
        </div>

        {/* Final Standings Table */}
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-300">
            Final Standings
          </h2>
          <div className="overflow-hidden rounded-lg bg-gray-800">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-400">
                      Place
                    </th>
                    <th className="px-4 py-3 text-left font-medium text-gray-400">
                      Agent
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-gray-400">
                      VPIP
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-gray-400">
                      PFR
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-gray-400">
                      AF
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-gray-400">
                      WTSD
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-gray-400">
                      W$SD
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-gray-400">
                      Hands Won
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-gray-400">
                      Decisions
                    </th>
                    <th className="px-4 py-3 text-right font-medium text-gray-400">
                      Errors
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {stats.agentStats
                    .sort((a, b) => a.placement - b.placement)
                    .map((agent) => (
                      <tr
                        key={agent.agentName}
                        className="border-t border-gray-700 hover:bg-gray-700/50"
                      >
                        <td className="px-4 py-3">
                          <span
                            className={
                              agent.placement === 1
                                ? "font-bold text-yellow-400"
                                : agent.placement === 2
                                  ? "text-gray-300"
                                  : agent.placement === 3
                                    ? "text-orange-400"
                                    : "text-gray-500"
                            }
                          >
                            {agent.placement === 1 && "🏆 "}
                            {agent.placement}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-white">
                          {agent.agentName}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-gray-300">
                          {agent.vpip.toFixed(1)}%
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-gray-300">
                          {agent.pfr.toFixed(1)}%
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-gray-300">
                          {agent.aggressionFactor.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-gray-300">
                          {agent.wtsd.toFixed(1)}%
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-gray-300">
                          {agent.wasd.toFixed(1)}%
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-gray-300">
                          {agent.handsWon}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-gray-300">
                          {agent.totalDecisions}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={
                              agent.errorCount > 0
                                ? "font-mono text-red-400"
                                : "font-mono text-gray-500"
                            }
                          >
                            {agent.errorCount}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Chip Progression Chart */}
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-300">
            Chip Progression
          </h2>
          <div className="h-80 rounded-lg bg-gray-800 p-4">
            <ChipProgressionChart data={stats.chipProgression} />
          </div>
        </section>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Action Distribution */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-300">
              Action Distribution
            </h2>
            <div className="h-80 rounded-lg bg-gray-800 p-4">
              <ActionBreakdownChart data={stats.actionDistribution} />
            </div>
          </section>

          {/* Token Usage */}
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-300">
              Token Usage ({(totalTokens / 1000000).toFixed(2)}M total)
            </h2>
            <div className="h-80 rounded-lg bg-gray-800 p-4">
              <TokenUsageChart agents={stats.agentStats} />
            </div>
          </section>
        </div>

        {/* Timing Stats */}
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-300">
            Thinking Time (Avg: {(avgThinkingTime / 1000).toFixed(2)}s)
          </h2>
          <div className="h-80 rounded-lg bg-gray-800 p-4">
            <TimingStatsChart agents={stats.agentStats} />
          </div>
        </section>

        {/* Performance Metrics Grid */}
        <section>
          <h2 className="mb-3 text-lg font-semibold text-gray-300">
            Performance Metrics
          </h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            {stats.agentStats.map((agent) => (
              <div key={agent.seat} className="rounded-lg bg-gray-800 p-4">
                <div
                  className="mb-2 truncate font-medium text-white"
                  title={agent.agentName}
                >
                  {agent.placement === 1 && "🏆 "}
                  {agent.agentName}
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">VPIP</span>
                    <span className="font-mono text-gray-300">
                      {agent.vpip.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">PFR</span>
                    <span className="font-mono text-gray-300">
                      {agent.pfr.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">3-Bet</span>
                    <span className="font-mono text-gray-300">
                      {agent.threeBetPercent.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">AF</span>
                    <span className="font-mono text-gray-300">
                      {agent.aggressionFactor.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Chips Won</span>
                    <span className="font-mono text-gray-300">
                      {agent.totalChipsWon.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Elimination Order */}
        {stats.eliminationOrder.length > 0 && (
          <section>
            <h2 className="mb-3 text-lg font-semibold text-gray-300">
              Elimination Order
            </h2>
            <div className="rounded-lg bg-gray-800 p-4">
              <div className="flex flex-wrap gap-4">
                {stats.eliminationOrder
                  .sort((a, b) => a.handNumber - b.handNumber)
                  .map((elim, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 rounded-lg bg-gray-700 px-3 py-2"
                    >
                      <span className="text-sm text-gray-500">
                        Hand {elim.handNumber}
                      </span>
                      <span className="text-white">{elim.agentName}</span>
                      <span className="text-sm text-gray-400">
                        ({getOrdinal(elim.placement)} place)
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
