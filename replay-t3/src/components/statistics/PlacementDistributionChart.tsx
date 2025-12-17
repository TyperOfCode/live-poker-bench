"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { ModelAggregateStats } from "~/types";

const PLACEMENT_COLORS: Record<number, string> = {
  1: "#FFD700", // gold
  2: "#C0C0C0", // silver
  3: "#CD7F32", // bronze
  4: "#6B7280", // gray
  5: "#4B5563", // darker gray
};

interface PlacementDistributionChartProps {
  modelStats: Record<string, ModelAggregateStats>;
}

function getOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0] ?? "th");
}

export function PlacementDistributionChart({
  modelStats,
}: PlacementDistributionChartProps) {
  const models = Object.values(modelStats);

  if (models.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-gray-500">
        No placement data available
      </div>
    );
  }

  const allPlacements = new Set<number>();
  for (const model of models) {
    for (const placement of Object.keys(model.placementDistribution)) {
      allPlacements.add(Number(placement));
    }
  }
  const placements = Array.from(allPlacements).sort((a, b) => a - b);

  const chartData = models.map((model) => {
    const data: Record<string, string | number> = {
      name:
        model.modelName.length > 15
          ? model.modelName.substring(0, 12) + "..."
          : model.modelName,
      fullName: model.modelName,
    };

    for (const placement of placements) {
      data[`place_${placement}`] = model.placementDistribution[placement] ?? 0;
    }

    return data;
  });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={chartData}
        margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis
          dataKey="name"
          stroke="#9CA3AF"
          tick={{ fill: "#9CA3AF", fontSize: 11 }}
          angle={-45}
          textAnchor="end"
          interval={0}
          height={60}
        />
        <YAxis
          stroke="#9CA3AF"
          tick={{ fill: "#9CA3AF", fontSize: 12 }}
          label={{
            value: "Count",
            angle: -90,
            position: "insideLeft",
            fill: "#9CA3AF",
          }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#1F2937",
            border: "1px solid #374151",
            borderRadius: "8px",
          }}
          labelStyle={{ color: "#F3F4F6" }}
          formatter={(value, name) => {
            const placement = String(name).replace("place_", "");
            return [Number(value), `${getOrdinal(Number(placement))} Place`];
          }}
          labelFormatter={(_, payload) =>
            (payload?.[0]?.payload as { fullName?: string } | undefined)
              ?.fullName ?? ""
          }
        />
        <Legend
          formatter={(value: string) => {
            const placement = value.replace("place_", "");
            return (
              <span className="text-sm text-gray-300">
                {getOrdinal(Number(placement))} Place
              </span>
            );
          }}
        />
        {placements.map((placement) => (
          <Bar
            key={placement}
            dataKey={`place_${placement}`}
            fill={PLACEMENT_COLORS[placement] ?? "#6B7280"}
            name={`place_${placement}`}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
