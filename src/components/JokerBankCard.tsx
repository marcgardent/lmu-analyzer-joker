import { memo } from 'react';
import { Sparkles, ArrowRight, Lock, Flame } from 'lucide-react';
import type { JokerProgression, RaceCollisionDetail } from '../lib/types';
import { trackLabel } from '../lib/racepace';

interface JokerBankCardProps {
  progression: JokerProgression;
  topCandidate?: RaceCollisionDetail | null;
  onNavigateRace?: (fileName: string, sessionIndex: number, driverName: string) => void;
  compact?: boolean;
}

export const JokerBankCard = memo(function JokerBankCard({
  progression,
  topCandidate,
  onNavigateRace,
  compact = false,
}: JokerBankCardProps) {
  const { totalRaces, jokersEarned, maxJokers, racesToNextJoker, progressPct } = progression;

  // Build array of 3 slot states: 'unlocked' | 'locked'
  const slots: Array<{ unlocked: boolean; label: string; threshold: number }> = [
    {
      unlocked: jokersEarned >= 1,
      label: '1st Joker (10 races)',
      threshold: 10,
    },
    {
      unlocked: jokersEarned >= 2,
      label: '2nd Joker (+20 races = 30)',
      threshold: 30,
    },
    {
      unlocked: jokersEarned >= 3,
      label: '3rd Joker (+30 races = 60)',
      threshold: 60,
    },
  ];

  if (compact) {
    return (
      <div className="data-card carbon-fiber p-3 flex flex-wrap items-center justify-between gap-3 border border-racing-border/60">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-racing-purple/20 border border-racing-purple/40 flex items-center justify-center text-base">
            🃏
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-racing text-xs font-bold text-white tracking-wider">EVENT JOKERS STATUS</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-racing-purple/20 text-racing-purple border border-racing-purple/30">
                {jokersEarned} / {maxJokers} Earned in LMU
              </span>
            </div>
            <p className="text-[11px] text-racing-muted">
              {racesToNextJoker > 0
                ? `${racesToNextJoker} races until next card (${progressPct}%)`
                : 'Maximum capacity earned (3/3 cards)'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {slots.map((slot, i) => (
            <div
              key={i}
              className={`w-7 h-9 rounded flex flex-col items-center justify-center border text-[10px] font-mono font-bold transition-all ${
                slot.unlocked
                  ? 'bg-racing-purple/20 border-racing-purple text-racing-purple shadow-[0_0_8px_rgba(168,85,247,0.3)]'
                  : 'bg-racing-black/60 border-racing-border/40 text-racing-muted/30'
              }`}
              title={slot.label}
            >
              <span>🃏</span>
              <span className="text-[8px]">{i + 1}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="data-card carbon-fiber p-4 sm:p-5 border border-racing-border/70 relative overflow-hidden">
      {/* Background ambient gradient */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-racing-purple/10 via-transparent to-transparent pointer-events-none" />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-racing-border/40">
        {/* Left: Title & Inventory Slots */}
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-racing-purple/30 to-racing-red/20 border border-racing-purple/40 flex items-center justify-center text-2xl shadow-[0_0_15px_rgba(168,85,247,0.25)]">
            🃏
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-racing text-sm sm:text-base font-bold text-white tracking-wider">
                EVENT JOKERS TRACKER
              </h3>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-racing-purple/25 text-racing-purple border border-racing-purple/40">
                {jokersEarned} of {maxJokers} EARNED (LMU V1.4)
              </span>
            </div>
            <p className="text-xs text-racing-muted mt-0.5">
              Event Jokers help protect your rank in LMU against disconnections, crashes & hardware failures.
            </p>
          </div>
        </div>

        {/* Right: 3 Visual Joker Card Slots */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {slots.map((slot, index) => {
            const isUnlocked = slot.unlocked;

            return (
              <div
                key={index}
                className={`relative w-16 sm:w-20 h-20 sm:h-24 rounded-lg border flex flex-col items-center justify-between p-2 text-center transition-all ${
                  isUnlocked
                    ? 'bg-gradient-to-b from-racing-purple/25 to-racing-purple/10 border-racing-purple/60 shadow-[0_0_15px_rgba(168,85,247,0.25)]'
                    : 'bg-racing-dark/40 border-racing-border/40 opacity-40'
                }`}
              >
                <div className="flex items-center justify-between w-full text-[9px] font-mono uppercase">
                  <span className={isUnlocked ? 'text-racing-purple font-bold' : 'text-racing-muted'}>
                    #{index + 1}
                  </span>
                  {isUnlocked && <Sparkles className="w-3 h-3 text-racing-purple animate-pulse" />}
                  {!isUnlocked && <Lock className="w-3 h-3 text-racing-muted" />}
                </div>

                <div className="text-xl sm:text-2xl my-auto">
                  {isUnlocked ? '🃏' : '🔒'}
                </div>

                <div className="text-[9px] font-mono leading-none">
                  {isUnlocked ? (
                    <span className="text-racing-purple font-bold">UNLOCKED</span>
                  ) : (
                    <span className="text-racing-muted">{slot.threshold} Races</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Progression Bar */}
      <div className="pt-4 space-y-2">
        <div className="flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-racing-muted">LMU Joker Unlock Progression:</span>
            <span className="text-white font-bold">{totalRaces} Races Completed</span>
          </div>
          <div className="text-racing-purple font-bold">
            {racesToNextJoker > 0 ? (
              <span>{racesToNextJoker} more race{racesToNextJoker > 1 ? 's' : ''} to unlock #{jokersEarned + 1} ({progressPct}%)</span>
            ) : (
              <span className="text-racing-green font-bold">All 3 Cards Earned</span>
            )}
          </div>
        </div>

        {/* Custom Segmented Progress Bar */}
        <div className="w-full bg-racing-dark rounded-full h-2.5 overflow-hidden border border-racing-border/50 flex">
          <div
            className="bg-gradient-to-r from-racing-purple to-racing-red h-full transition-all duration-500 rounded-full"
            style={{ width: `${Math.min(100, Math.max(0, (totalRaces / 60) * 100))}%` }}
          />
        </div>

        <div className="flex justify-between text-[10px] font-mono text-racing-muted/60 px-0.5">
          <span>0 (Start)</span>
          <span className={totalRaces >= 10 ? 'text-racing-purple font-bold' : ''}>10 Races (#1)</span>
          <span className={totalRaces >= 30 ? 'text-racing-purple font-bold' : ''}>30 Races (#2)</span>
          <span className={totalRaces >= 60 ? 'text-racing-purple font-bold' : ''}>60 Races (#3)</span>
        </div>
      </div>

      {/* Top Joker Target Recommendation Banner */}
      {topCandidate && (
        <div className="mt-4 pt-3 border-t border-racing-border/40">
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Flame className="w-5 h-5 text-red-400 shrink-0" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-racing text-xs font-bold text-white tracking-wider">
                    PRIME JOKER TARGET IN LMU:
                  </span>
                  <span className="text-white font-bold text-xs">{trackLabel(topCandidate.file.trackCourse)}</span>
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                    Impact: {topCandidate.jokerImpact?.score ?? 0}/100
                  </span>
                </div>
                <p className="text-[11px] text-racing-muted mt-0.5">
                  {topCandidate.file.timeString} &middot; Finished P{topCandidate.classPosition}/{topCandidate.classDrivers}
                  {topCandidate.rrDelta < 0 && ` · Lost ${Math.abs(topCandidate.rrDelta)} RR`}
                  {topCandidate.isDnf && ' · DNF Recorded'}
                  {topCandidate.totalIncidents > 0 && ` · ${topCandidate.totalIncidents} contacts`}
                </p>
              </div>
            </div>

            {onNavigateRace && (
              <button
                onClick={() => onNavigateRace(topCandidate.file.fileName, topCandidate.session.sessionIndex, topCandidate.driver.name)}
                className="px-3 py-1.5 rounded text-xs font-medium text-white bg-racing-dark border border-racing-border hover:border-racing-red/60 transition-colors cursor-pointer flex items-center gap-1.5 self-end sm:self-center shrink-0"
              >
                <span>View Session</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
});
