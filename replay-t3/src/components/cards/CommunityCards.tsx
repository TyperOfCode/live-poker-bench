import clsx from "clsx";
import { Card } from "./Card";

interface CommunityCardsProps {
  cards: string[];
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  sm: { width: 40, height: 56 },
  md: { width: 56, height: 78 },
  lg: { width: 72, height: 100 },
};

export function CommunityCards({
  cards,
  size = "lg",
  className,
}: CommunityCardsProps) {
  const { width, height } = SIZES[size];

  // Always show 5 slots
  const slots = Array.from({ length: 5 }, (_, i) => cards[i] ?? null);

  return (
    <div className={clsx("flex justify-center gap-2", className)}>
      {slots.map((card, index) => (
        <div
          key={index}
          className="transition-all duration-300"
          style={{ width, height }}
        >
          {card ? (
            <Card card={card} size={size} />
          ) : (
            <div
              className="h-full w-full rounded border-2 border-dashed border-gray-600/50 bg-gray-800/30"
              style={{ width, height }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
