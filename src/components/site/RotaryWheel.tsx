type Props = {
  size?: number;
  className?: string;
  extraSpokes?: boolean;
};

export function RotaryWheel({ size = 42, className = "", extraSpokes = false }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label="Rotary wheel emblem"
    >
      <circle cx="50" cy="50" r="12" className="fill-gold" />
      <circle cx="50" cy="50" r="34" fill="none" strokeWidth="5" className="stroke-gold" />
      <g strokeWidth="4" className="stroke-gold">
        <line x1="50" y1="16" x2="50" y2="84" />
        <line x1="16" y1="50" x2="84" y2="50" />
        <line x1="26" y1="26" x2="74" y2="74" />
        <line x1="74" y1="26" x2="26" y2="74" />
        {extraSpokes ? (
          <>
            <line x1="50" y1="16" x2="50" y2="84" transform="rotate(30 50 50)" />
            <line x1="50" y1="16" x2="50" y2="84" transform="rotate(60 50 50)" />
          </>
        ) : null}
      </g>
      <g className="fill-gold">
        <rect x="46" y="4" width="8" height="12" rx="2" />
        <rect x="46" y="84" width="8" height="12" rx="2" />
        <rect x="4" y="46" width="12" height="8" rx="2" />
        <rect x="84" y="46" width="12" height="8" rx="2" />
        <rect x="15" y="15" width="10" height="10" rx="2" transform="rotate(45 20 20)" />
        <rect x="75" y="15" width="10" height="10" rx="2" transform="rotate(45 80 20)" />
        <rect x="15" y="75" width="10" height="10" rx="2" transform="rotate(45 20 80)" />
        <rect x="75" y="75" width="10" height="10" rx="2" transform="rotate(45 80 80)" />
      </g>
    </svg>
  );
}
