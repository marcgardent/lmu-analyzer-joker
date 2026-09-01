import { memo, useState, useRef } from 'react';
import { Info, CheckCircle2, Flame, X } from 'lucide-react';
import type { RaceJokerEvaluation } from '../lib/types';
import { getJokerTierClasses } from '../lib/joker';
import { useClickOutside } from '../lib/useClickOutside';

interface JokerImpactBadgeProps {
  evaluation: RaceJokerEvaluation;
  isConsumed?: boolean;
  onToggleJoker?: () => void;
  variant?: 'badge' | 'compact' | 'detailed';
  showTooltip?: boolean;
}

export const JokerImpactBadge = memo(function JokerImpactBadge({
  evaluation,
  isConsumed = false,
  onToggleJoker,
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
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-xs font-mono font-bold transition-all cursor-pointer ${
            isConsumed
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
              : `${tierStyle.badge} ${tierStyle.glow}`
          }`}
          title={
            isConsumed
              ? `Joker Active: -${evaluation.rrPointsProtected} RR Protected`
              : `Race Joker Impact: ${evaluation.score}/100 (${evaluation.tierLabel})`
          }
        >
          <span className="text-[10px]">{isConsumed ? '🔥' : '🃏'}</span>
          <span>{isConsumed ? 'ACTIVE' : evaluation.score}</span>
          {!isConsumed && (
            <span className="text-[9px] font-normal uppercase opacity-75 hidden sm:inline">
              {evaluation.tierLabel.split(' ')[0]}
            </span>
          )}
        </button>

        {tooltipOpen && (
          <div
            className="absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-2 w-72 p-3.5 bg-racing-card border border-racing-border rounded-lg shadow-2xl text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-racing-border/50 pb-1.5 mb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-base">{isConsumed ? '🔥' : '🃏'}</span>
                <div>
                  <div className="font-racing text-xs font-bold text-white tracking-wider">
                    {isConsumed ? 'JOKER ACTIVE ON THIS RACE' : 'RACE JOKER IMPACT'}
                  </div>
                  <div className={`text-[10px] font-bold ${isConsumed ? 'text-amber-400' : tierStyle.accent}`}>
                    {evaluation.score}/100 &middot; {evaluation.tierLabel}
                  </div>
                </div>
              </div>
            </div>

            <p className="text-xs text-racing-muted leading-tight mb-2.5">
              {isConsumed
                ? `Protected: ${evaluation.rrPointsProtected} RR Points, ${evaluation.srProtected} SR and DNF Penalty wiped out.`
                : evaluation.recommendation}
            </p>

            {evaluation.reasons.length > 0 && (
              <div className="space-y-1 pt-1.5 border-t border-racing-border/40 mb-3">
                <div className="text-[9px] uppercase font-mono text-racing-muted/70 tracking-wider">Diagnostic</div>
                {evaluation.reasons.map((r, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[10px] text-racing-text">
                    <span className="text-racing-red font-bold">&bull;</span>
                    <span>{r}</span>
                  </div>
                ))}
              </div>
            )}

            {onToggleJoker && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleJoker();
                  setTooltipOpen(false);
                }}
                className={`w-full py-1.5 px-3 rounded text-xs font-bold font-mono transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  isConsumed
                    ? 'bg-racing-dark border border-racing-border text-racing-muted hover:text-white hover:border-racing-red'
                    : 'bg-gradient-to-r from-racing-purple to-racing-red text-white shadow-[0_0_10px_rgba(168,85,247,0.3)] hover:brightness-110'
                }`}
              >
                {isConsumed ? (
                  <>
                    <X className="w-3.5 h-3.5" />
                    <span>Unapply Joker (Refund)</span>
                  </>
                ) : (
                  <>
                    <Flame className="w-3.5 h-3.5 text-amber-300" />
                    <span>Burn Event Joker Here</span>
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  if (variant === 'detailed') {
    return (
      <div className={`data-card carbon-fiber p-4 border relative overflow-hidden transition-all ${
        isConsumed ? 'border-amber-500/70 bg-gradient-to-b from-amber-500/10 to-transparent' : 'border-racing-border/60'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-lg border flex items-center justify-center text-lg ${
              isConsumed ? 'bg-amber-500/20 border-amber-500 text-amber-400' : 'bg-racing-dark border-racing-border'
            }`}>
              {isConsumed ? '🔥' : '🃏'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-racing text-sm font-bold text-white tracking-wider">
                  {isConsumed ? 'EVENT JOKER APPLIED' : 'RACE JOKER IMPACT'}
                </h4>
                <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${
                  isConsumed ? 'bg-amber-500/20 text-amber-400 border-amber-500/40' : tierStyle.badge
                }`}>
                  {isConsumed ? 'PROTECTION ACTIVE' : evaluation.tierLabel}
                </span>
              </div>
              <p className="text-racing-muted text-xs">
                {isConsumed ? 'All rank loss & penalties negated on this race' : 'LMU Event Joker Worthiness Index'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className={`font-racing text-2xl font-black ${isConsumed ? 'text-amber-400' : tierStyle.accent}`}>
                {evaluation.score}
                <span className="text-xs text-racing-muted font-normal font-sans">/100</span>
              </div>
            </div>

            {onToggleJoker && (
              <button
                type="button"
                onClick={onToggleJoker}
                className={`px-3 py-1.5 rounded text-xs font-bold font-mono transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                  isConsumed
                    ? 'bg-racing-dark border border-racing-border text-racing-muted hover:text-white hover:border-racing-red'
                    : 'bg-gradient-to-r from-racing-purple to-racing-red text-white shadow-[0_0_10px_rgba(168,85,247,0.3)] hover:brightness-110'
                }`}
              >
                {isConsumed ? (
                  <>
                    <X className="w-3.5 h-3.5" />
                    <span>Unapply Joker</span>
                  </>
                ) : (
                  <>
                    <Flame className="w-3.5 h-3.5 text-amber-300" />
                    <span>Apply Joker</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Impact breakdown */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3 text-xs">
          <div className="p-2 rounded bg-racing-dark/60 border border-racing-border/40">
            <div className="text-[10px] text-racing-muted uppercase font-mono">Rank Loss (RR)</div>
            <div className="font-bold text-white mt-0.5">
              {evaluation.rrPointsProtected > 0 ? (
                isConsumed ? (
                  <span className="text-emerald-400 font-mono flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    +{evaluation.rrPointsProtected} RR Protected
                  </span>
                ) : (
                  <span className="text-racing-red font-mono">-{evaluation.rrPointsProtected} RR</span>
                )
              ) : (
                <span className="text-racing-green font-mono">0 (Positive/Safe)</span>
              )}
            </div>
          </div>

          <div className="p-2 rounded bg-racing-dark/60 border border-racing-border/40">
            <div className="text-[10px] text-racing-muted uppercase font-mono">Race Outcome</div>
            <div className="font-bold text-white mt-0.5">
              {evaluation.dnfProtected ? (
                isConsumed ? (
                  <span className="text-emerald-400 font-mono">DNF Wiped Out</span>
                ) : (
                  <span className="text-racing-red font-mono">DNF Recorded</span>
                )
              ) : (
                <span className="text-racing-green font-mono">Finished</span>
              )}
            </div>
          </div>

          <div className="p-2 rounded bg-racing-dark/60 border border-racing-border/40">
            <div className="text-[10px] text-racing-muted uppercase font-mono">Safety Delta (SR)</div>
            <div className="font-bold text-white mt-0.5">
              {evaluation.srProtected > 0 ? (
                isConsumed ? (
                  <span className="text-emerald-400 font-mono">+{evaluation.srProtected.toFixed(2)} SR Saved</span>
                ) : (
                  <span className="text-racing-orange font-mono">-{evaluation.srProtected.toFixed(2)} SR</span>
                )
              ) : (
                <span className="text-racing-green font-mono">Clean / Safe</span>
              )}
            </div>
          </div>
        </div>

        <div className="bg-racing-dark/40 rounded-lg p-2.5 border border-racing-border/30 mb-3">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-racing-muted shrink-0 mt-0.5" />
            <p className="text-xs text-racing-text leading-snug">
              {isConsumed
                ? 'Joker active: This race result is excluded from your Rank Rating & Safety Rating degradation.'
                : evaluation.recommendation}
            </p>
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
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-mono font-bold transition-all cursor-pointer ${
          isConsumed
            ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
            : `${tierStyle.badge} ${tierStyle.glow}`
        }`}
      >
        <span className="text-xs">{isConsumed ? '🔥' : '🃏'}</span>
        <span>{isConsumed ? 'JOKER' : evaluation.score}</span>
        <span className="text-[10px] font-normal uppercase opacity-80 hidden sm:inline">
          &middot; {isConsumed ? 'ACTIVE' : evaluation.tierLabel}
        </span>
      </button>

      {tooltipOpen && (
        <div
          className="absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-2 w-72 p-3.5 bg-racing-card border border-racing-border rounded-lg shadow-2xl text-left"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-racing-border/50 pb-1.5 mb-2">
            <div className="flex items-center gap-1.5">
              <span className="text-base">{isConsumed ? '🔥' : '🃏'}</span>
              <div>
                <div className="font-racing text-xs font-bold text-white tracking-wider">
                  {isConsumed ? 'EVENT JOKER ACTIVE' : 'RACE JOKER IMPACT'}
                </div>
                <div className={`text-[10px] font-bold ${isConsumed ? 'text-amber-400' : tierStyle.accent}`}>
                  {evaluation.score}/100 &middot; {evaluation.tierLabel}
                </div>
              </div>
            </div>
          </div>

          <p className="text-xs text-racing-muted leading-tight mb-2.5">
            {isConsumed
              ? `Protected: ${evaluation.rrPointsProtected} RR Points & ${evaluation.srProtected} SR saved.`
              : evaluation.recommendation}
          </p>

          {evaluation.reasons.length > 0 && (
            <div className="space-y-1 pt-1.5 border-t border-racing-border/40 mb-3">
              <div className="text-[9px] uppercase font-mono text-racing-muted/70 tracking-wider">Diagnostic</div>
              {evaluation.reasons.map((r, i) => (
                <div key={i} className="flex items-start gap-1.5 text-[10px] text-racing-text">
                  <span className="text-racing-red font-bold">&bull;</span>
                  <span>{r}</span>
                </div>
              ))}
            </div>
          )}

          {onToggleJoker && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleJoker();
                setTooltipOpen(false);
              }}
              className={`w-full py-1.5 px-3 rounded text-xs font-bold font-mono transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                isConsumed
                  ? 'bg-racing-dark border border-racing-border text-racing-muted hover:text-white hover:border-racing-red'
                  : 'bg-gradient-to-r from-racing-purple to-racing-red text-white shadow-[0_0_10px_rgba(168,85,247,0.3)] hover:brightness-110'
              }`}
            >
              {isConsumed ? (
                <>
                  <X className="w-3.5 h-3.5" />
                  <span>Unapply Joker</span>
                </>
              ) : (
                <>
                  <Flame className="w-3.5 h-3.5 text-amber-300" />
                  <span>Burn Event Joker</span>
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
});
