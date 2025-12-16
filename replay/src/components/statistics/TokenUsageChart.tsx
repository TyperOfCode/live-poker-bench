import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { AgentPokerStats } from '../../types';

interface TokenUsageChartProps {
  agents: AgentPokerStats[];
}

export function TokenUsageChart({ agents }: TokenUsageChartProps) {
  if (agents.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        No token usage data available
      </div>
    );
  }

  // Transform data for chart
  const chartData = agents
    .sort((a, b) => a.placement - b.placement)
    .map((agent) => ({
      name: agent.agentName.length > 15
        ? agent.agentName.substring(0, 12) + '...'
        : agent.agentName,
      fullName: agent.agentName,
      prompt: Math.round(agent.totalPromptTokens / 1000),
      completion: Math.round(agent.totalCompletionTokens / 1000),
    }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis
          dataKey="name"
          stroke="#9CA3AF"
          tick={{ fill: '#9CA3AF', fontSize: 11 }}
          angle={-45}
          textAnchor="end"
          interval={0}
          height={60}
        />
        <YAxis
          stroke="#9CA3AF"
          tick={{ fill: '#9CA3AF', fontSize: 12 }}
          label={{ value: 'Tokens (K)', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1F2937',
            border: '1px solid #374151',
            borderRadius: '8px',
          }}
          labelStyle={{ color: '#F3F4F6' }}
          formatter={(value, name) => [
            `${Number(value).toLocaleString()}K tokens`,
            name === 'prompt' ? 'Prompt' : 'Completion',
          ]}
          labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''}
        />
        <Legend
          formatter={(value) => (
            <span className="text-gray-300 text-sm">
              {value === 'prompt' ? 'Prompt Tokens' : 'Completion Tokens'}
            </span>
          )}
        />
        <Bar dataKey="prompt" stackId="a" fill="#3B82F6" name="prompt" />
        <Bar dataKey="completion" stackId="a" fill="#10B981" name="completion" />
      </BarChart>
    </ResponsiveContainer>
  );
}
