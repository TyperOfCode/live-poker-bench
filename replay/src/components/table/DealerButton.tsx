import clsx from 'clsx';

interface DealerButtonProps {
  className?: string;
}

export function DealerButton({ className }: DealerButtonProps) {
  return (
    <div
      className={clsx(
        'w-7 h-7 rounded-full',
        'bg-gradient-to-b from-white to-gray-200',
        'border-2 border-gray-300',
        'flex items-center justify-center',
        'shadow-md',
        'text-xs font-bold text-gray-800',
        className
      )}
    >
      D
    </div>
  );
}

export default DealerButton;
