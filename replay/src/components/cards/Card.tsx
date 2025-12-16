import clsx from 'clsx';

interface CardProps {
  card: string; // "As", "Kh", "2c", "Td"
  size?: 'sm' | 'md' | 'lg';
  highlighted?: boolean;
  className?: string;
}

const RANKS: Record<string, string> = {
  'A': 'A', 'K': 'K', 'Q': 'Q', 'J': 'J', 'T': '10',
  '9': '9', '8': '8', '7': '7', '6': '6', '5': '5',
  '4': '4', '3': '3', '2': '2',
};

const SUITS: Record<string, { symbol: string; color: string }> = {
  's': { symbol: '\u2660', color: '#1a1a1a' },  // Spades
  'h': { symbol: '\u2665', color: '#dc2626' },  // Hearts
  'd': { symbol: '\u2666', color: '#2563eb' },  // Diamonds
  'c': { symbol: '\u2663', color: '#16a34a' },  // Clubs
};

const SIZES = {
  sm: { width: 40, height: 56 },
  md: { width: 56, height: 78 },
  lg: { width: 72, height: 100 },
};

export function Card({ card, size = 'md', highlighted, className }: CardProps) {
  const rank = card[0].toUpperCase();
  const suit = card[1].toLowerCase();
  const { width, height } = SIZES[size];
  const suitInfo = SUITS[suit] || SUITS['s'];
  const rankDisplay = RANKS[rank] || rank;

  return (
    <svg
      viewBox="0 0 60 84"
      width={width}
      height={height}
      className={clsx(
        'drop-shadow-md transition-transform',
        highlighted && 'ring-2 ring-yellow-400 rounded',
        className
      )}
    >
      {/* Card background */}
      <rect
        width="60"
        height="84"
        rx="4"
        fill="white"
        stroke={highlighted ? '#facc15' : '#d1d5db'}
        strokeWidth={highlighted ? 2 : 1}
      />

      {/* Rank - top left */}
      <text
        x="6"
        y="16"
        fontSize="13"
        fontWeight="bold"
        fontFamily="system-ui, sans-serif"
        fill={suitInfo.color}
      >
        {rankDisplay}
      </text>

      {/* Small suit - top left */}
      <text
        x="6"
        y="28"
        fontSize="12"
        fontFamily="system-ui, sans-serif"
        fill={suitInfo.color}
      >
        {suitInfo.symbol}
      </text>

      {/* Large center suit */}
      <text
        x="30"
        y="52"
        fontSize="28"
        textAnchor="middle"
        fontFamily="system-ui, sans-serif"
        fill={suitInfo.color}
      >
        {suitInfo.symbol}
      </text>

      {/* Rank - bottom right (rotated) */}
      <g transform="rotate(180 30 42)">
        <text
          x="6"
          y="16"
          fontSize="13"
          fontWeight="bold"
          fontFamily="system-ui, sans-serif"
          fill={suitInfo.color}
        >
          {rankDisplay}
        </text>
        <text
          x="6"
          y="28"
          fontSize="12"
          fontFamily="system-ui, sans-serif"
          fill={suitInfo.color}
        >
          {suitInfo.symbol}
        </text>
      </g>
    </svg>
  );
}

export default Card;
