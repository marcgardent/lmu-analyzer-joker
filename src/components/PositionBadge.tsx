import { memo } from 'react';

interface PositionBadgeProps {
  position: number | null | undefined;
  total?: number | null;
  isProvisional?: boolean;
  className?: string;
  showPrefix?: boolean;
  colorClass?: string;
}

export const PositionBadge = memo(function PositionBadge({
  position,
  total,
  isProvisional = false,
  className = '',
  showPrefix = true,
  colorClass,
}: PositionBadgeProps) {
  if (position === null || position === undefined || position <= 0) {
    return <span className="text-racing-muted font-mono">--</span>;
  }

  const defaultColor =
    position === 1
      ? 'text-racing-gold font-bold'
      : position <= 3
      ? 'text-racing-orange font-bold'
      : 'text-white font-bold';

  const appliedColor = colorClass ?? defaultColor;
  const tooltip = isProvisional
    ? 'Provisional standing — data collection was interrupted before race completion'
    : undefined;

  return (
    <span
      className={`inline-flex items-baseline font-mono ${className}`}
      title={tooltip}
    >
      <span className={appliedColor}>
        {showPrefix ? 'P' : ''}{position}
      </span>
      {isProvisional && (
        <span
          className="text-amber-400 font-bold ml-0.5 select-none"
          title={tooltip}
        >
          ?
        </span>
      )}
      {total !== undefined && total !== null && total > 0 && (
        <span className="text-racing-muted text-xs font-normal">
          /{total}
        </span>
      )}
    </span>
  );
});
