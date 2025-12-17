import clsx from "clsx";

interface CardBackProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  sm: { width: 40, height: 56 },
  md: { width: 56, height: 78 },
  lg: { width: 72, height: 100 },
};

export function CardBack({ size = "md", className }: CardBackProps) {
  const { width, height } = SIZES[size];

  return (
    <svg
      viewBox="0 0 60 84"
      width={width}
      height={height}
      className={clsx("drop-shadow-md", className)}
    >
      <defs>
        <pattern
          id="cardBackPattern"
          patternUnits="userSpaceOnUse"
          width="8"
          height="8"
        >
          <rect width="8" height="8" fill="#1e40af" />
          <circle cx="4" cy="4" r="1.5" fill="#3b82f6" />
        </pattern>
        <linearGradient
          id="cardBackGradient"
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop offset="0%" stopColor="#1e3a8a" />
          <stop offset="100%" stopColor="#1e40af" />
        </linearGradient>
      </defs>

      {/* Card background */}
      <rect
        width="60"
        height="84"
        rx="4"
        fill="url(#cardBackGradient)"
        stroke="#1e3a8a"
        strokeWidth="2"
      />

      {/* Pattern fill */}
      <rect
        x="4"
        y="4"
        width="52"
        height="76"
        rx="2"
        fill="url(#cardBackPattern)"
      />

      {/* Inner border */}
      <rect
        x="4"
        y="4"
        width="52"
        height="76"
        rx="2"
        fill="none"
        stroke="#60a5fa"
        strokeWidth="1"
      />
    </svg>
  );
}
