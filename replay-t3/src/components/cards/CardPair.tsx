import clsx from "clsx";
import { Card } from "./Card";
import { CardBack } from "./CardBack";

interface CardPairProps {
  cards?: [string, string];
  faceDown?: boolean;
  size?: "sm" | "md" | "lg";
  highlighted?: boolean;
  folded?: boolean;
  className?: string;
}

export function CardPair({
  cards,
  faceDown = false,
  size = "md",
  highlighted = false,
  folded = false,
  className,
}: CardPairProps) {
  const showFaceDown = faceDown || !cards;

  return (
    <div
      className={clsx(
        "flex gap-0.5",
        folded && "opacity-40 grayscale",
        className,
      )}
    >
      {showFaceDown ? (
        <>
          <CardBack size={size} />
          <CardBack size={size} />
        </>
      ) : (
        <>
          <Card card={cards[0]} size={size} highlighted={highlighted} />
          <Card card={cards[1]} size={size} highlighted={highlighted} />
        </>
      )}
    </div>
  );
}
