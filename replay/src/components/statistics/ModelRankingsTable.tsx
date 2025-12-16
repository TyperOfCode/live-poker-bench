import clsx from 'clsx';
import type { ModelRanking } from '../../types';

interface ModelRankingsTableProps {
  rankings: ModelRanking[];
}

export function ModelRankingsTable({ rankings }: ModelRankingsTableProps) {
  if (rankings.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 text-center text-gray-500">
        No ranking data available
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-700">
            <tr>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Rank</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Model</th>
              <th className="text-right px-4 py-3 text-gray-400 font-medium">Win Rate</th>
              <th className="text-right px-4 py-3 text-gray-400 font-medium">Avg Placement</th>
              <th className="text-right px-4 py-3 text-gray-400 font-medium">Consistency</th>
              <th className="text-right px-4 py-3 text-gray-400 font-medium">Tournaments</th>
            </tr>
          </thead>
          <tbody>
            {rankings.map((model, index) => (
              <tr key={model.modelName} className="border-t border-gray-700 hover:bg-gray-750">
                <td className="px-4 py-3">
                  <span className={clsx(
                    'font-bold',
                    index === 0 && 'text-yellow-400',
                    index === 1 && 'text-gray-300',
                    index === 2 && 'text-orange-400',
                    index > 2 && 'text-gray-500',
                  )}>
                    {index === 0 && '🏆 '}
                    {index + 1}
                  </span>
                </td>
                <td className="px-4 py-3 text-white font-medium">{model.modelName}</td>
                <td className={clsx(
                  'px-4 py-3 text-right font-mono',
                  model.winRate >= 30 && 'text-green-400',
                  model.winRate >= 15 && model.winRate < 30 && 'text-gray-300',
                  model.winRate < 15 && 'text-gray-500',
                )}>
                  {model.winRate.toFixed(1)}%
                </td>
                <td className="px-4 py-3 text-right font-mono text-gray-300">
                  {model.avgPlacement.toFixed(2)}
                </td>
                <td className={clsx(
                  'px-4 py-3 text-right font-mono',
                  model.consistency < 1 && 'text-green-400',
                  model.consistency >= 1 && model.consistency < 1.5 && 'text-gray-300',
                  model.consistency >= 1.5 && 'text-orange-400',
                )}>
                  {model.consistency.toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-gray-300">
                  {model.tournamentsPlayed}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
