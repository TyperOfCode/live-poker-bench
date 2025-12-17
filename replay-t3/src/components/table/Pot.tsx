import clsx from "clsx";

interface PotProps {
  amount: number;
  className?: string;
}

export function Pot({ amount, className }: PotProps) {
  return (
    <div className={clsx("flex flex-col items-center gap-1", className)}>
      {/* Chip stack visualization */}
      <div className="relative h-8 w-12">
        {/* Stack of chips */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2">
          <div className="relative">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="absolute h-2 w-10 rounded-full border border-red-400 bg-gradient-to-b from-red-500 to-red-700"
                style={{ bottom: i * 3 }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Pot amount */}
      <div className="rounded-full bg-black/60 px-3 py-1">
        <span className="text-sm font-bold text-yellow-400">
          {amount.toLocaleString()}
        </span>
      </div>
    </div>
  );
}
