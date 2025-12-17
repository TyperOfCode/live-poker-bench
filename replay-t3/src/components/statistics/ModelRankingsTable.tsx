"use client";

import clsx from "clsx";
import type { ModelRanking } from "~/types";

interface ModelRankingsTableProps {
  rankings: ModelRanking[];
}

export function ModelRankingsTable({ rankings }: ModelRankingsTableProps) {
  if (rankings.length === 0) {
    return (
      <div className="rounded-lg bg-gray-800 p-6 text-center text-gray-500">
        No ranking data available
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg bg-gray-800">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-400">
                Rank
              </th>
              <th className="px-4 py-3 text-left font-medium text-gray-400">
                Model
              </th>
              <th className="px-4 py-3 text-right font-medium text-gray-400">
                Win Rate
              </th>
              <th className="px-4 py-3 text-right font-medium text-gray-400">
                Avg Placement
              </th>
              <th className="px-4 py-3 text-right font-medium text-gray-400">
                Consistency
              </th>
              <th className="px-4 py-3 text-right font-medium text-gray-400">
                Tournaments
              </th>
            </tr>
          </thead>
          <tbody>
            {rankings.map((model, index) => (
              <tr
                key={model.modelName}
                className="border-t border-gray-700 hover:bg-gray-700/50"
              >
                <td className="px-4 py-3">
                  <span
                    className={clsx(
                      "font-bold",
                      index === 0 && "text-yellow-400",
                      index === 1 && "text-gray-300",
                      index === 2 && "text-orange-400",
                      index > 2 && "text-gray-500"
                    )}
                  >
                    {index === 0 && "🏆 "}
                    {index + 1}
                  </span>
                </td>
                <td className="px-4 py-3 font-medium text-white">
                  {model.modelName}
                </td>
                <td
                  className={clsx(
                    "px-4 py-3 text-right font-mono",
                    model.winRate >= 30 && "text-green-400",
                    model.winRate >= 15 && model.winRate < 30 && "text-gray-300",
                    model.winRate < 15 && "text-gray-500"
                  )}
                >
                  {model.winRate.toFixed(1)}%
                </td>
                <td className="px-4 py-3 text-right font-mono text-gray-300">
                  {model.avgPlacement.toFixed(2)}
                </td>
                <td
                  className={clsx(
                    "px-4 py-3 text-right font-mono",
                    model.consistency < 1 && "text-green-400",
                    model.consistency >= 1 &&
                      model.consistency < 1.5 &&
                      "text-gray-300",
                    model.consistency >= 1.5 && "text-orange-400"
                  )}
                >
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
