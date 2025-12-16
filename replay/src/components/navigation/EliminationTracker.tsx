import clsx from 'clsx';
import { useReplayStore } from '../../state/replayStore';
import { getSortedPlacements } from '../../data/tournament';

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function EliminationTracker() {
  const tournament = useReplayStore((state) => state.tournament);

  if (!tournament) {
    return null;
  }

  const placements = getSortedPlacements(tournament.results);

  return (
    <div className="p-4">
      <h3 className="text-sm font-semibold text-gray-400 mb-3">FINAL STANDINGS</h3>
      <div className="space-y-1">
        {placements.map(({ name, placement }) => (
          <div
            key={name}
            className={clsx(
              'text-sm p-2 rounded flex justify-between items-center',
              placement === 1 && 'bg-yellow-900/30 text-yellow-400',
              placement === 2 && 'bg-gray-600/30 text-gray-300',
              placement === 3 && 'bg-orange-900/30 text-orange-400',
              placement > 3 && 'bg-gray-800/50 text-gray-400'
            )}
          >
            <span className="truncate flex-1">{name}</span>
            <span className="font-mono ml-2">
              {placement === 1 && '🏆 '}
              {ordinal(placement)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default EliminationTracker;
