import { useReplayStore } from '../../state/replayStore';
import { useOverallStatistics } from '../../hooks';
import { StatCard } from './StatCard';
import { ModelRankingsTable } from './ModelRankingsTable';
import { PlacementDistributionChart } from './PlacementDistributionChart';
import { STAT_EXPLAINERS } from '../../utils/statistics/statExplainers';

function LoadingSpinner({ progress }: { progress: { loaded: number; total: number } }) {
  const percentage = progress.total > 0 ? (progress.loaded / progress.total) * 100 : 0;

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
        <div className="text-gray-400 mb-2">Loading overall statistics...</div>
        <div className="text-gray-500 text-sm">
          {progress.loaded} / {progress.total} tournaments
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

export function OverallStatistics() {
  const availableTournaments = useReplayStore((state) => state.availableTournaments);
  const { stats, loading, progress, error, reload } = useOverallStatistics();

  if (loading) {
    return <LoadingSpinner progress={progress} />;
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-4xl mb-4">!</div>
          <div className="text-white text-lg mb-2">Error Loading Statistics</div>
          <div className="text-gray-400 mb-4">{error}</div>
          <button
            onClick={reload}
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!stats || stats.tournamentsLoaded === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <div className="text-gray-500 text-4xl mb-4">📊</div>
          <div className="text-gray-400 mb-2">No tournament data available</div>
          <div className="text-gray-500 text-sm">
            Found {availableTournaments.length} tournaments but none could be loaded
          </div>
        </div>
      </div>
    );
  }

  // Calculate aggregate metrics
  const models = Object.values(stats.modelStats);
  const totalDecisions = models.reduce((sum, m) => sum + m.totalDecisions, 0);
  const totalErrors = models.reduce((sum, m) => sum + m.totalErrors, 0);

  // Find best model
  const bestModel = stats.rankings[0];

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-white">Overall Statistics</h2>
            <p className="text-gray-400 mt-1">
              Aggregate performance across {stats.tournamentsLoaded} tournament{stats.tournamentsLoaded !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={reload}
            className="text-gray-400 hover:text-white transition-colors"
            title="Reload statistics"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Tournaments Analyzed"
            value={stats.tournamentsLoaded}
            subValue={`${availableTournaments.length} available`}
            tooltip={STAT_EXPLAINERS.tournaments}
          />
          <StatCard
            label="Models Tracked"
            value={models.length}
          />
          <StatCard
            label="Total Decisions"
            value={totalDecisions.toLocaleString()}
            subValue={`${totalErrors} errors (${((totalErrors / totalDecisions) * 100).toFixed(2)}%)`}
            tooltip={STAT_EXPLAINERS.decisions}
          />
          <StatCard
            label="Best Performer"
            value={bestModel?.modelName || '-'}
            subValue={bestModel ? `${bestModel.winRate.toFixed(1)}% win rate` : undefined}
            tooltip={STAT_EXPLAINERS.winRate}
          />
        </div>

        {/* Overall Poker Metrics */}
        <section>
          <h3 className="text-lg font-semibold text-gray-300 mb-3">Overall Poker Metrics</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
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
          <h3 className="text-lg font-semibold text-gray-300 mb-3">Model Rankings</h3>
          <ModelRankingsTable rankings={stats.rankings} />
        </section>

        {/* Placement Distribution */}
        <section>
          <h3 className="text-lg font-semibold text-gray-300 mb-3">Placement Distribution</h3>
          <div className="bg-gray-800 rounded-lg p-4 h-80">
            <PlacementDistributionChart modelStats={stats.modelStats} />
          </div>
        </section>

        {/* Model Details Grid */}
        <section>
          <h3 className="text-lg font-semibold text-gray-300 mb-3">Model Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {models
              .sort((a, b) => {
                const aRank = stats.rankings.findIndex((r) => r.modelName === a.modelName);
                const bRank = stats.rankings.findIndex((r) => r.modelName === b.modelName);
                return aRank - bRank;
              })
              .map((model, idx) => (
                <div key={model.modelName} className="bg-gray-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-gray-500 text-sm">#{idx + 1}</span>
                    <span className="text-white font-medium truncate" title={model.modelName}>
                      {idx === 0 && '🏆 '}
                      {model.modelName}
                    </span>
                  </div>

                  <div className="space-y-2 text-sm">
                    {/* Tournament Stats */}
                    <div className="flex justify-between" title={STAT_EXPLAINERS.tournaments}>
                      <span className="text-gray-500">Tournaments</span>
                      <span className="text-gray-300 font-mono">{model.tournamentsPlayed}</span>
                    </div>
                    <div className="flex justify-between" title={STAT_EXPLAINERS.wins}>
                      <span className="text-gray-500">Wins</span>
                      <span className="text-green-400 font-mono">{model.wins}</span>
                    </div>
                    <div className="flex justify-between" title={STAT_EXPLAINERS.winRate}>
                      <span className="text-gray-500">Win Rate</span>
                      <span className="text-gray-300 font-mono">
                        {((model.wins / model.tournamentsPlayed) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex justify-between" title={STAT_EXPLAINERS.avgPlacement}>
                      <span className="text-gray-500">Avg Placement</span>
                      <span className="text-gray-300 font-mono">{model.avgPlacement.toFixed(2)}</span>
                    </div>

                    {/* Poker Stats */}
                    <div className="border-t border-gray-700 pt-2 mt-2">
                      <div className="text-gray-500 text-xs mb-1">Poker Stats</div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        <div className="flex justify-between" title={STAT_EXPLAINERS.vpip}>
                          <span className="text-gray-500">VPIP</span>
                          <span className="text-gray-300 font-mono">{model.avgVpip.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between" title={STAT_EXPLAINERS.pfr}>
                          <span className="text-gray-500">PFR</span>
                          <span className="text-gray-300 font-mono">{model.avgPfr.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between" title={STAT_EXPLAINERS.af}>
                          <span className="text-gray-500">AF</span>
                          <span className="text-gray-300 font-mono">{model.avgAggressionFactor.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between" title={STAT_EXPLAINERS.threeBet}>
                          <span className="text-gray-500">3-Bet</span>
                          <span className="text-gray-300 font-mono">{model.avgThreeBetPercent.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between" title={STAT_EXPLAINERS.wtsd}>
                          <span className="text-gray-500">WTSD</span>
                          <span className="text-gray-300 font-mono">{model.avgWtsd.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between" title={STAT_EXPLAINERS.wasd}>
                          <span className="text-gray-500">W$SD</span>
                          <span className="text-gray-300 font-mono">{model.avgWasd.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Hands & Decisions */}
                    <div className="border-t border-gray-700 pt-2 mt-2">
                      <div className="text-gray-500 text-xs mb-1">Performance</div>
                      <div className="flex justify-between" title={STAT_EXPLAINERS.handsPlayed}>
                        <span className="text-gray-500">Hands Played</span>
                        <span className="text-gray-300 font-mono">{model.totalHandsPlayed.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between" title={STAT_EXPLAINERS.handsWon}>
                        <span className="text-gray-500">Hands Won</span>
                        <span className="text-gray-300 font-mono">{model.totalHandsWon.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between" title={STAT_EXPLAINERS.decisions}>
                        <span className="text-gray-500">Total Decisions</span>
                        <span className="text-gray-300 font-mono">{model.totalDecisions.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between" title={STAT_EXPLAINERS.errorRate}>
                        <span className="text-gray-500">Error Rate</span>
                        <span className={model.totalErrors > 0 ? 'text-red-400 font-mono' : 'text-gray-500 font-mono'}>
                          {model.totalDecisions > 0
                            ? `${((model.totalErrors / model.totalDecisions) * 100).toFixed(2)}%`
                            : '-'}
                        </span>
                      </div>
                      {model.avgEliminationHand > 0 && (
                        <div className="flex justify-between" title={STAT_EXPLAINERS.avgEliminationHand}>
                          <span className="text-gray-500">Avg Elim Hand</span>
                          <span className="text-gray-300 font-mono">{model.avgEliminationHand.toFixed(1)}</span>
                        </div>
                      )}
                    </div>

                    {/* Placement distribution mini bar */}
                    <div className="border-t border-gray-700 pt-2 mt-2">
                      <div className="text-gray-500 text-xs mb-1">Placements</div>
                      <div className="flex gap-1">
                        {Object.entries(model.placementDistribution)
                          .sort(([a], [b]) => Number(a) - Number(b))
                          .map(([place, count]) => (
                            <div
                              key={place}
                              className="flex-1 text-center"
                              title={`${getOrdinal(Number(place))} place: ${count} time${count !== 1 ? 's' : ''}`}
                            >
                              <div
                                className="h-4 rounded-sm mb-1"
                                style={{
                                  backgroundColor: getPlacementColor(Number(place)),
                                  opacity: 0.3 + (count / model.tournamentsPlayed) * 0.7,
                                }}
                              />
                              <div className="text-gray-500 text-xs">{place}</div>
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

function getOrdinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function getPlacementColor(placement: number): string {
  const colors: Record<number, string> = {
    1: '#FFD700',
    2: '#C0C0C0',
    3: '#CD7F32',
    4: '#6B7280',
    5: '#4B5563',
  };
  return colors[placement] || '#374151';
}
