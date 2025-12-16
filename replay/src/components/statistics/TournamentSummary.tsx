import { useReplayStore } from '../../state/replayStore';
import { useTournamentStatistics } from '../../hooks';
import { StatCard } from './StatCard';
import { AgentComparisonTable } from './AgentComparisonTable';
import { ChipProgressionChart } from './ChipProgressionChart';
import { ActionBreakdownChart } from './ActionBreakdownChart';
import { TokenUsageChart } from './TokenUsageChart';
import { TimingStatsChart } from './TimingStatsChart';

function LoadingSpinner({ progress }: { progress: { loaded: number; total: number } }) {
  const percentage = progress.total > 0 ? (progress.loaded / progress.total) * 100 : 0;

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
        <div className="text-gray-400 mb-2">Loading statistics...</div>
        <div className="text-gray-500 text-sm">
          {progress.loaded} / {progress.total} hands
        </div>
        <div className="w-48 bg-gray-700 rounded-full h-2 mt-2 mx-auto">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function TournamentSummary() {
  const tournamentId = useReplayStore((state) => state.tournamentId);
  const tournament = useReplayStore((state) => state.tournament);
  const { stats, loading, progress, error } = useTournamentStatistics(tournamentId);

  if (!tournament) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        No tournament loaded
      </div>
    );
  }

  if (loading) {
    return <LoadingSpinner progress={progress} />;
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-4xl mb-4">!</div>
          <div className="text-white text-lg mb-2">Error Loading Statistics</div>
          <div className="text-gray-400">{error}</div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        No statistics available
      </div>
    );
  }

  // Calculate some aggregate stats
  const totalActions = Object.values(stats.actionDistribution).reduce((a, b) => a + b, 0);
  const totalTokens = stats.agentStats.reduce(
    (sum, a) => sum + a.totalPromptTokens + a.totalCompletionTokens,
    0
  );
  const avgThinkingTime =
    stats.agentStats.reduce((sum, a) => sum + a.avgThinkingTimeMs, 0) / stats.agentStats.length;

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white">
              Tournament {tournamentId} Statistics
            </h2>
            <p className="text-gray-400 mt-1">
              Comprehensive analysis of poker performance metrics
            </p>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Hands" value={stats.totalHands} />
          <StatCard label="Players" value={stats.numPlayers} />
          <StatCard label="Starting Stack" value={stats.startingStack} />
          <StatCard label="Total Actions" value={totalActions} />
        </div>

        {/* Final Standings */}
        <section>
          <h3 className="text-lg font-semibold text-gray-300 mb-3">Final Standings</h3>
          <AgentComparisonTable stats={stats.agentStats} />
        </section>

        {/* Chip Progression Chart */}
        <section>
          <h3 className="text-lg font-semibold text-gray-300 mb-3">Chip Progression</h3>
          <div className="bg-gray-800 rounded-lg p-4 h-80">
            <ChipProgressionChart data={stats.chipProgression} />
          </div>
        </section>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Action Distribution */}
          <section>
            <h3 className="text-lg font-semibold text-gray-300 mb-3">Action Distribution</h3>
            <div className="bg-gray-800 rounded-lg p-4 h-80">
              <ActionBreakdownChart data={stats.actionDistribution} />
            </div>
          </section>

          {/* Token Usage */}
          <section>
            <h3 className="text-lg font-semibold text-gray-300 mb-3">
              Token Usage ({(totalTokens / 1000000).toFixed(2)}M total)
            </h3>
            <div className="bg-gray-800 rounded-lg p-4 h-80">
              <TokenUsageChart agents={stats.agentStats} />
            </div>
          </section>
        </div>

        {/* Timing Stats */}
        <section>
          <h3 className="text-lg font-semibold text-gray-300 mb-3">
            Thinking Time (Avg: {(avgThinkingTime / 1000).toFixed(2)}s)
          </h3>
          <div className="bg-gray-800 rounded-lg p-4 h-80">
            <TimingStatsChart agents={stats.agentStats} />
          </div>
        </section>

        {/* Additional Stats Grid */}
        <section>
          <h3 className="text-lg font-semibold text-gray-300 mb-3">Performance Metrics</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {stats.agentStats.map((agent) => (
              <div key={agent.seat} className="bg-gray-800 rounded-lg p-4">
                <div className="text-white font-medium mb-2 truncate" title={agent.agentName}>
                  {agent.placement === 1 && '🏆 '}
                  {agent.agentName}
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">VPIP</span>
                    <span className="text-gray-300 font-mono">{agent.vpip.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">PFR</span>
                    <span className="text-gray-300 font-mono">{agent.pfr.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">3-Bet</span>
                    <span className="text-gray-300 font-mono">{agent.threeBetPercent.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">AF</span>
                    <span className="text-gray-300 font-mono">{agent.aggressionFactor.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Chips Won</span>
                    <span className="text-gray-300 font-mono">{agent.totalChipsWon}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Elimination Order */}
        {stats.eliminationOrder.length > 0 && (
          <section>
            <h3 className="text-lg font-semibold text-gray-300 mb-3">Elimination Order</h3>
            <div className="bg-gray-800 rounded-lg p-4">
              <div className="flex flex-wrap gap-4">
                {stats.eliminationOrder
                  .sort((a, b) => a.handNumber - b.handNumber)
                  .map((elim, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 bg-gray-700 rounded-lg px-3 py-2"
                    >
                      <span className="text-gray-500 text-sm">Hand {elim.handNumber}</span>
                      <span className="text-white">{elim.agentName}</span>
                      <span className="text-gray-400 text-sm">
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

function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
