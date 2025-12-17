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
  ErrorBar,
} from "recharts";
import type { AgentPokerStats } from "~/types";

interface TimingStatsChartProps {
  agents: AgentPokerStats[];
}

export function TimingStatsChart({ agents }: TimingStatsChartProps) {
  if (agents.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-gray-500">
        No timing data available
      </div>
    );
  }

  const chartData = agents
    .sort((a, b) => a.placement - b.placement)
    .map((agent) => ({
      name:
        agent.agentName.length > 15
          ? agent.agentName.substring(0, 12) + "..."
          : agent.agentName,
      fullName: agent.agentName,
      avgTime: agent.avgThinkingTimeMs / 1000,
      minTime: agent.minThinkingTimeMs / 1000,
      maxTime: agent.maxThinkingTimeMs / 1000,
      range: [
        (agent.avgThinkingTimeMs - agent.minThinkingTimeMs) / 1000,
        (agent.maxThinkingTimeMs - agent.avgThinkingTimeMs) / 1000,
      ],
    }));

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
            value: "Time (s)",
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
          formatter={(value) => [`${Number(value).toFixed(2)}s`, "Avg Time"]}
          labelFormatter={(_, payload) =>
            (payload?.[0]?.payload as { fullName?: string } | undefined)
              ?.fullName ?? ""
          }
        />
        <Legend
          formatter={() => (
            <span className="text-sm text-gray-300">Avg Thinking Time</span>
          )}
        />
        <Bar dataKey="avgTime" fill="#8B5CF6" name="avgTime">
          <ErrorBar dataKey="range" width={4} strokeWidth={2} stroke="#A78BFA" />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
