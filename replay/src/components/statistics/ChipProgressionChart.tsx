import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { ChipProgression } from '../../types';

// Color palette for different agents
const COLORS = [
  '#3B82F6', // blue-500
  '#10B981', // emerald-500
  '#F59E0B', // amber-500
  '#EF4444', // red-500
  '#8B5CF6', // violet-500
  '#EC4899', // pink-500
  '#06B6D4', // cyan-500
  '#84CC16', // lime-500
];

interface ChipProgressionChartProps {
  data: ChipProgression[];
}

export function ChipProgressionChart({ data }: ChipProgressionChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        No chip progression data available
      </div>
    );
  }

  // Get agent names from first data point
  const agentNames = Object.keys(data[0]?.stacks || {});

  // Transform data for Recharts
  const chartData = data.map((point) => ({
    hand: point.handNumber,
    ...point.stacks,
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis
          dataKey="hand"
          stroke="#9CA3AF"
          tick={{ fill: '#9CA3AF', fontSize: 12 }}
          label={{ value: 'Hand #', position: 'insideBottomRight', offset: -5, fill: '#9CA3AF' }}
        />
        <YAxis
          stroke="#9CA3AF"
          tick={{ fill: '#9CA3AF', fontSize: 12 }}
          label={{ value: 'Chips', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1F2937',
            border: '1px solid #374151',
            borderRadius: '8px',
          }}
          labelStyle={{ color: '#F3F4F6' }}
          itemStyle={{ color: '#D1D5DB' }}
          formatter={(value) => [Number(value).toLocaleString(), 'Chips']}
          labelFormatter={(label) => `Hand ${label}`}
        />
        <Legend
          wrapperStyle={{ paddingTop: '10px' }}
          formatter={(value) => <span className="text-gray-300 text-sm">{value}</span>}
        />
        {agentNames.map((name, index) => (
          <Line
            key={name}
            type="monotone"
            dataKey={name}
            stroke={COLORS[index % COLORS.length]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: COLORS[index % COLORS.length] }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
