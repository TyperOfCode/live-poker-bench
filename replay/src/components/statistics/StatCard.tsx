import clsx from 'clsx';

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  tooltip?: string;
  trend?: 'up' | 'down' | 'neutral';
  size?: 'sm' | 'md' | 'lg';
}

export function StatCard({ label, value, subValue, tooltip, trend, size = 'md' }: StatCardProps) {
  const formattedValue = typeof value === 'number'
    ? Number.isInteger(value) ? value.toString() : value.toFixed(1)
    : value;

  return (
    <div className="bg-gray-800 rounded-lg p-4 group relative" title={tooltip}>
      <div className="text-gray-500 text-xs uppercase tracking-wider mb-1 flex items-center gap-1">
        {label}
        {tooltip && (
          <span className="text-gray-600 cursor-help">ⓘ</span>
        )}
      </div>
      <div className={clsx(
        'font-bold text-white flex items-baseline gap-2',
        size === 'sm' && 'text-lg',
        size === 'md' && 'text-2xl',
        size === 'lg' && 'text-3xl',
      )}>
        {formattedValue}
        {trend && (
          <span className={clsx(
            'text-sm',
            trend === 'up' && 'text-green-400',
            trend === 'down' && 'text-red-400',
            trend === 'neutral' && 'text-gray-400',
          )}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '–'}
          </span>
        )}
      </div>
      {subValue && <div className="text-gray-400 text-sm mt-1">{subValue}</div>}
    </div>
  );
}
