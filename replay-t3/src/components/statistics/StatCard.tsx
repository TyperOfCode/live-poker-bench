"use client";

import clsx from "clsx";

interface StatCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  tooltip?: string;
  trend?: "up" | "down" | "neutral";
  size?: "sm" | "md" | "lg";
}

export function StatCard({
  label,
  value,
  subValue,
  tooltip,
  trend,
  size = "md",
}: StatCardProps) {
  const formattedValue =
    typeof value === "number"
      ? Number.isInteger(value)
        ? value.toString()
        : value.toFixed(1)
      : value;

  return (
    <div className="group relative rounded-lg bg-gray-800 p-4" title={tooltip}>
      <div className="mb-1 flex items-center gap-1 text-xs uppercase tracking-wider text-gray-500">
        {label}
        {tooltip && <span className="cursor-help text-gray-600">ⓘ</span>}
      </div>
      <div
        className={clsx(
          "flex items-baseline gap-2 font-bold text-white",
          size === "sm" && "text-lg",
          size === "md" && "text-2xl",
          size === "lg" && "text-3xl"
        )}
      >
        {formattedValue}
        {trend && (
          <span
            className={clsx(
              "text-sm",
              trend === "up" && "text-green-400",
              trend === "down" && "text-red-400",
              trend === "neutral" && "text-gray-400"
            )}
          >
            {trend === "up" ? "↑" : trend === "down" ? "↓" : "–"}
          </span>
        )}
      </div>
      {subValue && <div className="mt-1 text-sm text-gray-400">{subValue}</div>}
    </div>
  );
}
