import { memo, useState, useRef } from 'react';
import { Info } from 'lucide-react';
import type { RaceJokerEvaluation } from '../lib/types';
import { getJokerTierClasses } from '../lib/joker';
import { useClickOutside } from '../lib/useClickOutside';

interface JokerImpactBadgeProps {
  evaluation: RaceJokerEvaluation;
  variant?: 'badge' | 'compact' | 'detailed';
  showTooltip?: boolean;
}

export const JokerImpactBadge = memo(function JokerImpactBadge({
  evaluation,
  variant = 'badge',
  showTooltip = true,
}: JokerImpactBadgeProps) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useClickOutside(popoverRef, () => setTooltipOpen(false));

  const tierStyle = getJokerTierClasses(evaluation.tier);

  if (variant === 'compact') {
    return (
      <div className="relative inline-block" ref={popoverRef}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (showTooltip) setTooltipOpen(!tooltipOpen);
          }}
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-xs font-mono font-bold transition-all cursor-pointer ${tierStyle.badge} ${tierStyle.glow}`}
          title={`Race Joker Impact: ${evaluation.score}/100 (${evaluation.tierLabel})`}
        >
          <span className="text-[10px]">🃏</span>
          <span>{evaluation.score}</span>
          <span className="text-[9px] font-normal uppercase opacity-75 hidden sm:inline">{evaluation.tierLabel.split(' ')[0]}</span>
        </button>

        {tooltipOpen && (
          <div
            className="absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-2 w-72 p-3.5 bg-racing-card border border-racing-border rounded-lg shadow-2xl text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-racing-border/50 pb-1.5 mb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-base">🃏</span>
                <div>
                  <div className="font-racing text-xs font-bold text-white tracking-wider">RACE JOKER IMPACT</div>
                  <div className={`text-[10px] font-bold ${tierStyle.accent}`}>{evaluation.score}/100 &middot; {evaluation.tierLabel}</div>
                </div>
              </div>
            </div>

            <p className="text-xs text-racing-muted leading-tight mb-2.5">
              {evaluation.recommendation}
            </p>

            {evaluation.reasons.length > 0 && (
              <div className="space-y-1 pt-1.5 border-t border-racing-border/40">
                <div className="text-[9px] uppercase font-mono text-racing-muted/70 tracking-wider">Diagnostic</div>
                {evaluation.reasons.map((r, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[10px] text-racing-text">
                    <span className="text-racing-red font-bold">&bull;</span>
                    <span>{r}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  if (variant === 'detailed') {
    return (
      <div className="data-card carbon-fiber p-4 border border-racing-border/60">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-racing-dark border border-racing-border flex items-center justify-center text-lg">
              🃏
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-racing text-sm font-bold text-white tracking-wider">RACE JOKER IMPACT</h4>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${tierStyle.badge}`}>
                  {evaluation.tierLabel}
                </span>
              </div>
              <p className="text-racing-muted text-xs">LMU Event Joker Worthiness Index</p>
            </div>
          </div>

          <div className="text-right">
            <div className={`font-racing text-2xl font-black ${tierStyle.accent}`}>
              {evaluation.score}
              <span className="text-xs text-racing-muted font-normal font-sans">/100</span>
            </div>
          </div>
        </div>

        {/* Impact breakdown */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3 text-xs">
          <div className="p-2 rounded bg-racing-dark/60 border border-racing-border/40">
            <div className="text-[10px] text-racing-muted uppercase font-mono">Rank Loss (RR)</div>
            <div className="font-bold text-white mt-0.5">
              {evaluation.rrPointsProtected > 0 ? (
                <span className="text-racing-red font-mono">-{evaluation.rrPointsProtected} RR</span>
              ) : (
                <span className="text-racing-green font-mono">0 (Positive/Safe)</span>
              )}
            </div>
          </div>

          <div className="p-2 rounded bg-racing-dark/60 border border-racing-border/40">
            <div className="text-[10px] text-racing-muted uppercase font-mono">Race Outcome</div>
            <div className="font-bold text-white mt-0.5">
              {evaluation.dnfProtected ? (
                <span className="text-racing-red font-mono">DNF Recorded</span>
              ) : (
                <span className="text-racing-green font-mono">Finished</span>
              )}
            </div>
          </div>

          <div className="p-2 rounded bg-racing-dark/60 border border-racing-border/40">
            <div className="text-[10px] text-racing-muted uppercase font-mono">Safety Delta (SR)</div>
            <div className="font-bold text-white mt-0.5">
              {evaluation.srProtected > 0 ? (
                <span className="text-racing-orange font-mono">-{evaluation.srProtected.toFixed(2)} SR</span>
              ) : (
                <span className="text-racing-green font-mono">Clean / Safe</span>
              )}
            </div>
          </div>
        </div>

        <div className="bg-racing-dark/40 rounded-lg p-2.5 border border-racing-border/30 mb-3">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-racing-muted shrink-0 mt-0.5" />
            <p className="text-xs text-racing-text leading-snug">{evaluation.recommendation}</p>
          </div>
        </div>

        {evaluation.reasons.length > 0 && (
          <div className="space-y-1">
            <div className="text-[10px] uppercase font-mono text-racing-muted tracking-wider">Evaluation Factors</div>
            <div className="flex flex-wrap gap-1.5">
              {evaluation.reasons.map((r, idx) => (
                <span key={idx} className="px-2 py-0.5 rounded text-[10px] bg-racing-card border border-racing-border/50 text-racing-text">
                  {r}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Default Badge
  return (
    <div className="relative inline-flex items-center" ref={popoverRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (showTooltip) setTooltipOpen(!tooltipOpen);
        }}
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-mono font-bold transition-all cursor-pointer ${tierStyle.badge} ${tierStyle.glow}`}
      >
        <span className="text-xs">🃏</span>
        <span>{evaluation.score}</span>
        <span className="text-[10px] font-normal uppercase opacity-80 hidden sm:inline">&middot; {evaluation.tierLabel}</span>
      </button>

      {tooltipOpen && (
        <div
          className="absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-2 w-72 p-3.5 bg-racing-card border border-racing-border rounded-lg shadow-2xl text-left"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-racing-border/50 pb-1.5 mb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-base">🃏</span>
              <div>
                <div className="font-racing text-xs font-bold text-white tracking-wider">RACE JOKER IMPACT</div>
                <div className={`text-[10px] font-bold ${tierStyle.accent}`}>{evaluation.score}/100 &middot; {evaluation.tierLabel}</div>
              </div>
            </div>
          </div>

          <p className="text-xs text-racing-muted leading-tight mb-2.5">
            {evaluation.recommendation}
          </p>

          {evaluation.reasons.length > 0 && (
            <div className="space-y-1 pt-1.5 border-t border-racing-border/40">
              <div className="text-[9px] uppercase font-mono text-racing-muted/70 tracking-wider">Diagnostic</div>
              {evaluation.reasons.map((r, i) => (
                <div key={i} className="flex items-start gap-1.5 text-[10px] text-racing-text">
                  <span className="text-racing-red font-bold">&bull;</span>
                  <span>{r}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});
