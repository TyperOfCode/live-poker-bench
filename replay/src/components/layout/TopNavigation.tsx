import clsx from 'clsx';
import { useReplayStore, type ActiveView } from '../../state/replayStore';

const views: Array<{ id: ActiveView; label: string }> = [
  { id: 'about', label: 'About' },
  { id: 'replay', label: 'Hand Replay' },
  { id: 'summary', label: 'Tournament Summary' },
  { id: 'overall', label: 'Overall Statistics' },
];

export function TopNavigation() {
  const activeView = useReplayStore((state) => state.activeView);
  const setActiveView = useReplayStore((state) => state.setActiveView);

  return (
    <div className="flex gap-1 bg-gray-800 p-1 rounded-lg">
      {views.map((view) => (
        <button
          key={view.id}
          onClick={() => setActiveView(view.id)}
          className={clsx(
            'px-4 py-1.5 text-sm font-medium rounded-md transition-colors',
            activeView === view.id
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          )}
        >
          {view.label}
        </button>
      ))}
    </div>
  );
}
