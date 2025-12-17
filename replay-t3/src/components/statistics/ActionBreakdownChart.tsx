"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { ActionDistribution } from "~/types";

const COLORS: Record<keyof ActionDistribution, string> = {
  fold: "#EF4444", // red
  check: "#6B7280", // gray
  call: "#3B82F6", // blue
  raise: "#10B981", // green
  bet: "#F59E0B", // amber
};

const LABELS: Record<keyof ActionDistribution, string> = {
  fold: "Fold",
  check: "Check",
  call: "Call",
  raise: "Raise",
  bet: "Bet",
};

interface ActionBreakdownChartProps {
  data: ActionDistribution;
}

export function ActionBreakdownChart({ data }: ActionBreakdownChartProps) {
  const total = (Object.values(data) as number[]).reduce((a, b) => a + b, 0);

  if (total === 0) {
    return (
      <div className="flex h-full items-center justify-center text-gray-500">
        No action data available
      </div>
    );
  }

  const chartData = (
    Object.entries(data) as [keyof ActionDistribution, number][]
  )
    .filter(([, value]) => value > 0)
    .map(([key, value]) => ({
      name: LABELS[key],
      value,
      percentage: ((value / total) * 100).toFixed(1),
      color: COLORS[key],
    }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          dataKey="value"
          nameKey="name"
          label={({ name, percent }) =>
            `${name}: ${((percent ?? 0) * 100).toFixed(1)}%`
          }
          labelLine={{ stroke: "#6B7280" }}
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: "#1F2937",
            border: "1px solid #374151",
            borderRadius: "8px",
          }}
          formatter={(value, name) => [
            `${Number(value).toLocaleString()} (${((Number(value) / total) * 100).toFixed(1)}%)`,
            name,
          ]}
        />
        <Legend
          formatter={(value) => (
            <span className="text-sm text-gray-300">{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
