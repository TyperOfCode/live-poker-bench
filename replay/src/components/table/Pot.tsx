import clsx from 'clsx';

interface PotProps {
  amount: number;
  className?: string;
}

export function Pot({ amount, className }: PotProps) {
  return (
    <div className={clsx('flex flex-col items-center gap-1', className)}>
      {/* Chip stack visualization */}
      <div className="relative w-12 h-8">
        {/* Stack of chips */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2">
          <div className="relative">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="absolute w-10 h-2 rounded-full bg-gradient-to-b from-red-500 to-red-700 border border-red-400"
                style={{ bottom: i * 3 }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Pot amount */}
      <div className="bg-black/60 px-3 py-1 rounded-full">
        <span className="text-yellow-400 font-bold text-sm">
          {amount.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

export default Pot;
