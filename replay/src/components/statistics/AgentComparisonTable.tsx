import clsx from 'clsx';
import type { AgentPokerStats } from '../../types';

interface AgentComparisonTableProps {
  stats: AgentPokerStats[];
}

export function AgentComparisonTable({ stats }: AgentComparisonTableProps) {
  const sorted = [...stats].sort((a, b) => a.placement - b.placement);

  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-700">
            <tr>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Place</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Agent</th>
              <th className="text-right px-4 py-3 text-gray-400 font-medium" title="Voluntarily Put $ In Pot">VPIP</th>
              <th className="text-right px-4 py-3 text-gray-400 font-medium" title="Pre-Flop Raise">PFR</th>
              <th className="text-right px-4 py-3 text-gray-400 font-medium" title="Aggression Factor">AF</th>
              <th className="text-right px-4 py-3 text-gray-400 font-medium" title="Went to Showdown %">WTSD</th>
              <th className="text-right px-4 py-3 text-gray-400 font-medium" title="Won at Showdown %">W$SD</th>
              <th className="text-right px-4 py-3 text-gray-400 font-medium">Hands Won</th>
              <th className="text-right px-4 py-3 text-gray-400 font-medium">Decisions</th>
              <th className="text-right px-4 py-3 text-gray-400 font-medium">Errors</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((agent) => (
              <tr key={agent.seat} className="border-t border-gray-700 hover:bg-gray-750">
                <td className="px-4 py-3">
                  <span className={clsx(
                    'font-bold',
                    agent.placement === 1 && 'text-yellow-400',
                    agent.placement === 2 && 'text-gray-300',
                    agent.placement === 3 && 'text-orange-400',
                    agent.placement > 3 && 'text-gray-500',
                  )}>
                    {agent.placement === 1 && '🏆 '}
                    {agent.placement}
                  </span>
                </td>
                <td className="px-4 py-3 text-white font-medium">{agent.agentName}</td>
                <td className="px-4 py-3 text-right font-mono text-gray-300">{agent.vpip.toFixed(1)}%</td>
                <td className="px-4 py-3 text-right font-mono text-gray-300">{agent.pfr.toFixed(1)}%</td>
                <td className="px-4 py-3 text-right font-mono text-gray-300">{agent.aggressionFactor.toFixed(2)}</td>
                <td className="px-4 py-3 text-right font-mono text-gray-300">{agent.wtsd.toFixed(1)}%</td>
                <td className="px-4 py-3 text-right font-mono text-gray-300">{agent.wasd.toFixed(1)}%</td>
                <td className="px-4 py-3 text-right font-mono text-gray-300">{agent.handsWon}</td>
                <td className="px-4 py-3 text-right font-mono text-gray-300">{agent.totalDecisions}</td>
                <td className={clsx(
                  'px-4 py-3 text-right font-mono',
                  agent.errorCount > 0 ? 'text-red-400' : 'text-gray-500'
                )}>
                  {agent.errorCount > 0 ? agent.errorCount : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
