import { useState, useMemo, memo } from 'react';
import {
  Sparkles,
  Flame,
  CheckCircle2,
  Info,
  Sliders,
  ExternalLink,
  Shield,
  Trophy,
  Scale,
} from 'lucide-react';
import { ClassBadge } from '../components/ClassBadge';
import { PositionBadge } from '../components/PositionBadge';
import { DataCardHeader } from '../components/DataCardHeader';
import { FilterButtonGroup } from '../components/FilterButtonGroup';
import { SortableTable, type Column } from '../components/SortableTable';
import { ExportButton } from '../components/ExportButton';
import { getSafetyAndRatingStats, isIncompleteRace } from '../lib/analytics';
import { getJokerProgression, getRaceKey, computeRaceJokerImpact } from '../lib/joker';
import { useJokers } from '../lib/JokerContext';
import { trackLabel } from '../lib/racepace';
import { buildSessionContext } from '../lib/sessionContext';
import type { RaceFile, RaceCollisionDetail, CarClass, JokerStrategy } from '../lib/types';

interface JokersViewProps {
  files: RaceFile[];
  driverNames: string[];
  onNavigate?: (view: string, context?: string) => void;
}

export const JokersView = memo(function JokersView({
  files,
  driverNames,
  onNavigate,
}: JokersViewProps) {
  const {
    isConsumed,
    toggleJoker,
    consumedCount,
    manualStock,
    setManualStock,
    strategy,
    setStrategy,
  } = useJokers();

  const [filter, setFilter] = useState<'all' | 'candidates' | 'consumed'>('all');

  // Compute all base safety & rating stats
  const fullStats = useMemo(() => getSafetyAndRatingStats(files, driverNames), [files, driverNames]);
  const allRaces = fullStats.raceDetails;

  // Progression info based on official rules
  const progression = useMemo(() => getJokerProgression(fullStats.totalRaces), [fullStats.totalRaces]);

  // Dynamically evaluate races according to the selected Strategy
  const evaluatedRaces: RaceCollisionDetail[] = useMemo(() => {
    return allRaces.map(r => {
      const evaluation = computeRaceJokerImpact({
        rrDelta: r.rrDelta,
        srImpact: r.srImpact,
        isDnf: r.isDnf,
        lapsCompleted: r.lapsCompleted,
        position: r.driver.position,
        classPosition: r.classPosition,
        classGridPosition: r.driver.classGridPosition,
      }, strategy);

      return {
        ...r,
        jokerImpact: evaluation,
      };
    });
  }, [allRaces, strategy]);

  // Unconsumed disaster candidates for recommendation (exclude races already marked with a Joker)
  const unconsumedCandidates = useMemo(() => {
    return evaluatedRaces
      .filter(r => !isConsumed(getRaceKey(r.file.fileName, r.session.sessionIndex, r.driver.name)))
      .sort((a, b) => {
        if (strategy === 'rr_first') {
          // 1. Primary: Worst RR loss (most negative first)
          const rrDiff = a.rrDelta - b.rrDelta;
          if (rrDiff !== 0) return rrDiff;
          // 2. Secondary: Worst SR impact (most negative first)
          const srDiff = a.srImpact - b.srImpact;
          if (srDiff !== 0) return srDiff;
        } else if (strategy === 'sr_first') {
          // 1. Primary: Worst SR impact (most negative first)
          const srDiff = a.srImpact - b.srImpact;
          if (srDiff !== 0) return srDiff;
          // 2. Secondary: Worst RR loss (most negative first)
          const rrDiff = a.rrDelta - b.rrDelta;
          if (rrDiff !== 0) return rrDiff;
        } else {
          // Balanced: 1. Combined 50/50 score
          const scoreDiff = (b.jokerImpact?.score ?? 0) - (a.jokerImpact?.score ?? 0);
          if (scoreDiff !== 0) return scoreDiff;
          // 2. Secondary: Worst RR loss
          const rrDiff = a.rrDelta - b.rrDelta;
          if (rrDiff !== 0) return rrDiff;
          // 3. Tertiary: Worst SR impact
          const srDiff = a.srImpact - b.srImpact;
          if (srDiff !== 0) return srDiff;
        }

        // Final tie-breaker: date (most recent first)
        return b.file.timeString.localeCompare(a.file.timeString);
      });
  }, [evaluatedRaces, isConsumed, strategy]);

  // Top candidates matching user's available stock
  const topRecommendations = useMemo(() => {
    if (manualStock <= 0) return [];
    return unconsumedCandidates.slice(0, manualStock);
  }, [unconsumedCandidates, manualStock]);

  // Total protected stats currently active
  const { totalProtectedRR, totalProtectedSR } = useMemo(() => {
    let rr = 0;
    let sr = 0;
    for (const r of evaluatedRaces) {
      const key = getRaceKey(r.file.fileName, r.session.sessionIndex, r.driver.name);
      if (isConsumed(key)) {
        if (r.rrDelta < 0) rr += Math.abs(r.rrDelta);
        if (r.srImpact < 0) sr += Math.abs(r.srImpact);
      }
    }
    return { totalProtectedRR: Math.round(rr), totalProtectedSR: Number(sr.toFixed(2)) };
  }, [evaluatedRaces, isConsumed]);

  // Filtered rows for the table
  const filteredRows = useMemo(() => {
    if (filter === 'candidates') {
      return evaluatedRaces.filter(r => (r.jokerImpact?.score ?? 0) >= 35);
    }
    if (filter === 'consumed') {
      return evaluatedRaces.filter(r => isConsumed(getRaceKey(r.file.fileName, r.session.sessionIndex, r.driver.name)));
    }
    return evaluatedRaces;
  }, [evaluatedRaces, filter, isConsumed]);

  // Columns for the Joker Table
  const columns: Column<RaceCollisionDetail>[] = useMemo(() => [
    {
      key: 'consumed',
      label: 'Joker Used',
      align: 'center',
      width: '120px',
      sortValue: r => (isConsumed(getRaceKey(r.file.fileName, r.session.sessionIndex, r.driver.name)) ? 1 : 0),
      render: r => {
        const raceKey = getRaceKey(r.file.fileName, r.session.sessionIndex, r.driver.name);
        const consumed = isConsumed(raceKey);
        return (
          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={consumed}
              onChange={() => toggleJoker(raceKey)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-racing-dark peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-racing-purple border border-racing-border relative"></div>
            <span className={`text-[11px] font-mono font-bold ${consumed ? 'text-racing-purple' : 'text-racing-muted/40'}`}>
              {consumed ? 'USED' : 'OFF'}
            </span>
          </label>
        );
      },
    },
    {
      key: 'score',
      label: 'Joker Priority',
      align: 'center',
      width: '130px',
      sortValue: r => r.jokerImpact?.score ?? 0,
      render: r => {
        const score = r.jokerImpact?.score ?? 0;
        const color = score >= 75
          ? 'bg-racing-red/20 text-racing-red border-racing-red/40'
          : score >= 50
          ? 'bg-racing-orange/20 text-racing-orange border-racing-orange/40'
          : score >= 25
          ? 'bg-racing-yellow/20 text-racing-yellow border-racing-yellow/40'
          : 'bg-racing-dark text-racing-muted border-racing-border/40';

        const reasons = r.jokerImpact?.reasons ?? [];
        return (
          <div className="flex flex-col items-center">
            <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold border ${color}`}>
              {score}/100
            </span>
            {reasons.length > 0 && (
              <span className="text-[10px] text-racing-muted mt-0.5 font-medium truncate max-w-[120px]" title={reasons.join(', ')}>
                {reasons[0]}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: 'date',
      label: 'Date',
      width: '12%',
      sortValue: r => r.file.timeString,
      render: r => (
        <span className="text-racing-muted font-mono text-xs whitespace-nowrap">
          {r.file.timeString.slice(0, 16).replace('T', ' ')}
        </span>
      ),
    },
    {
      key: 'track',
      label: 'Circuit & Car',
      width: '20%',
      sortValue: r => r.file.trackCourse,
      render: r => (
        <div>
          <span className="text-white font-medium text-xs sm:text-sm">{trackLabel(r.file.trackCourse)}</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] text-racing-muted">{r.driver.carType}</span>
            <ClassBadge carClass={r.driver.carClass as CarClass} />
          </div>
        </div>
      ),
    },
    {
      key: 'finish',
      label: 'Finish',
      align: 'center',
      width: '80px',
      sortValue: r => r.classPosition,
      render: r => (
        <PositionBadge
          position={r.classPosition}
          total={r.classDrivers}
          isProvisional={isIncompleteRace(r.session)}
        />
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: '110px',
      sortValue: r => r.finishStatus,
      render: r => (
        <span className={`text-xs font-semibold ${!r.isDnf ? 'text-racing-green' : 'text-racing-red'}`}>
          {r.finishStatus || 'Finished'}
        </span>
      ),
    },
    {
      key: 'rrDelta',
      label: 'Rating (RR)',
      align: 'center',
      width: '110px',
      sortValue: r => {
        const raceKey = getRaceKey(r.file.fileName, r.session.sessionIndex, r.driver.name);
        return isConsumed(raceKey) && r.rrDelta < 0 ? 0 : r.rrDelta;
      },
      render: r => {
        const raceKey = getRaceKey(r.file.fileName, r.session.sessionIndex, r.driver.name);
        const consumed = isConsumed(raceKey);
        if (consumed && r.rrDelta < 0) {
          return (
            <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-racing-muted/70" title={`Joker Protected: ${r.rrDelta} RR negated`}>
              <span>🃏</span>
              <span className="line-through">{r.rrDelta} RR</span>
            </span>
          );
        }
        return (
          <span
            className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${
              r.rrDelta > 0
                ? 'bg-racing-green/10 text-racing-green'
                : r.rrDelta < 0
                ? 'bg-racing-red/10 text-racing-red'
                : 'bg-racing-dark text-racing-muted'
            }`}
          >
            {r.rrDelta > 0 ? `+${r.rrDelta}` : r.rrDelta} RR
          </span>
        );
      },
    },
    {
      key: 'srImpact',
      label: 'Safety (SR)',
      align: 'center',
      width: '110px',
      sortValue: r => {
        const raceKey = getRaceKey(r.file.fileName, r.session.sessionIndex, r.driver.name);
        return isConsumed(raceKey) && r.srImpact < 0 ? 0 : r.srImpact;
      },
      render: r => {
        const raceKey = getRaceKey(r.file.fileName, r.session.sessionIndex, r.driver.name);
        const consumed = isConsumed(raceKey);
        if (consumed && r.srImpact < 0) {
          return (
            <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-racing-muted/70" title={`Joker Protected: ${r.srImpact.toFixed(2)} SR negated`}>
              <span>🃏</span>
              <span className="line-through">{r.srImpact.toFixed(2)} SR</span>
            </span>
          );
        }
        return (
          <span
            className={`font-mono text-xs font-bold ${
              r.srImpact > 0 ? 'text-racing-green' : r.srImpact < 0 ? 'text-racing-red' : 'text-racing-muted'
            }`}
          >
            {r.srImpact > 0 ? `+${r.srImpact.toFixed(2)}` : r.srImpact.toFixed(2)}
          </span>
        );
      },
    },
    {
      key: 'action',
      label: 'Session',
      align: 'center',
      width: '70px',
      render: r =>
        onNavigate ? (
          <button
            onClick={() => onNavigate('session', buildSessionContext(r.file.fileName, r.session.sessionIndex, r.driver.name))}
            className="p-1.5 rounded bg-racing-dark hover:bg-racing-highlight/30 text-racing-muted hover:text-white transition-colors cursor-pointer"
            title="Open session details"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        ) : null,
    },
  ], [onNavigate, toggleJoker, isConsumed]);

  return (
    <div className="space-y-6">
      {/* Disclaimer Banner: 100% Transparency & Local Scope */}
      <div className="data-card carbon-fiber p-4 rounded-xl border border-racing-purple/30 bg-racing-purple/5 flex items-start gap-3.5">
        <div className="w-9 h-9 rounded-lg bg-racing-purple/20 border border-racing-purple/40 flex items-center justify-center shrink-0 text-racing-purple mt-0.5">
          <Info className="w-5 h-5" />
        </div>
        <div className="text-xs sm:text-sm text-racing-text space-y-1">
          <p className="font-bold text-white flex items-center gap-2">
            Local Decision & Simulation Tool
          </p>
          <p className="text-racing-muted leading-relaxed">
            This manager is a <strong>purely local decision-support and simulation tool</strong> saved in your browser.
            LMU game log files do not record in-game online menu actions.
            To actually erase a race result from your official online rating, you must <strong>use your Jokers directly inside the Le Mans Ultimate (LMU) game client</strong>.
          </p>
        </div>
      </div>

      {/* Manual Stock Configuration & Status Card */}
      <div className="data-card carbon-fiber p-5 border border-racing-border rounded-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          {/* Left: Interactive Joker Stock Selector */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-racing-purple" />
              <h3 className="font-racing text-sm sm:text-base font-bold text-white tracking-wide">
                YOUR AVAILABLE JOKERS IN LMU
              </h3>
            </div>
            <p className="text-xs text-racing-muted max-w-xl">
              Set how many Jokers you currently hold in the game so the analyzer can highlight the highest-priority races to cancel:
            </p>

            <div className="flex items-center gap-2 pt-1">
              {[0, 1, 2, 3].map(count => (
                <button
                  key={count}
                  onClick={() => setManualStock(count)}
                  className={`px-4 py-2 rounded-lg font-mono text-sm font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    manualStock === count
                      ? 'bg-racing-purple text-white shadow-[0_0_15px_rgba(168,85,247,0.4)] border border-racing-purple'
                      : 'bg-racing-dark text-racing-muted hover:text-white border border-racing-border/60 hover:border-racing-border'
                  }`}
                >
                  <span>🃏</span>
                  <span>{count} {count > 1 ? 'Jokers' : 'Joker'}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Right: Progression & Protected KPI Badges */}
          <div className="flex flex-wrap items-center gap-3 bg-racing-dark/60 p-3 rounded-lg border border-racing-border/40 shrink-0">
            <div>
              <div className="text-[10px] uppercase font-mono text-racing-muted/60 font-semibold">Total Earned (Game)</div>
              <div className="text-sm font-bold text-white font-mono">{progression.jokersEarned} / 3 Jokers</div>
              <div className="text-[10px] text-racing-muted font-mono">{allRaces.length} races completed</div>
            </div>
            <div className="w-px h-8 bg-racing-border/40 mx-1 hidden sm:block" />
            <div>
              <div className="text-[10px] uppercase font-mono text-racing-muted/60 font-semibold">Marked Used (UI)</div>
              <div className="text-sm font-bold text-amber-400 font-mono">{consumedCount} active</div>
            </div>
            <div className="w-px h-8 bg-racing-border/40 mx-1 hidden sm:block" />
            <div>
              <div className="text-[10px] uppercase font-mono text-racing-muted/60 font-semibold">Protected Metrics</div>
              <div className="text-sm font-bold text-emerald-400 font-mono">+{totalProtectedRR} RR · +{totalProtectedSR.toFixed(2)} SR</div>
            </div>
          </div>
        </div>
      </div>

      {/* STRATEGY SELECTOR & TOP Recommendations Section */}
      <div className="data-card carbon-fiber p-5 border border-racing-border rounded-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-racing-border/40 pb-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-racing-gold" />
              <h3 className="font-racing text-sm sm:text-base font-bold text-white tracking-wide">
                STRATEGIC RECOMMENDATIONS {manualStock > 0 ? `(TOP ${manualStock})` : ''}
              </h3>
            </div>
            <p className="text-xs text-racing-muted">
              Choose your target goal to rank disaster races by pure rating impact:
            </p>
          </div>

          {/* Strategy Mode Switcher */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'rr_first', label: 'Rating First (RR → SR)', icon: <Trophy className="w-3.5 h-3.5" />, color: 'bg-racing-red text-white shadow-[0_0_12px_rgba(239,68,68,0.4)] border-racing-red' },
              { id: 'sr_first', label: 'Safety First (SR → RR)', icon: <Shield className="w-3.5 h-3.5" />, color: 'bg-racing-blue text-white shadow-[0_0_12px_rgba(59,130,246,0.4)] border-racing-blue' },
              { id: 'balanced', label: 'Balanced (50/50 Score)', icon: <Scale className="w-3.5 h-3.5" />, color: 'bg-racing-purple text-white shadow-[0_0_12px_rgba(168,85,247,0.4)] border-racing-purple' },
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setStrategy(item.id as JokerStrategy)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all cursor-pointer flex items-center gap-1.5 border ${
                  strategy === item.id
                    ? item.color
                    : 'bg-racing-dark text-racing-muted hover:text-white border-racing-border/60 hover:border-racing-border'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {manualStock === 0 ? (
          <div className="text-center py-6 text-racing-muted space-y-1">
            <p className="text-sm font-medium text-white">Stock: 0 Jokers Available</p>
            <p className="text-xs">
              You indicated having 0 Jokers available in LMU.
              {progression.racesToNextJoker ? ` Complete ${progression.racesToNextJoker} more clean races to earn your next Joker!` : ''}
            </p>
          </div>
        ) : topRecommendations.length === 0 ? (
          <div className="text-center py-6 text-racing-muted space-y-1">
            <p className="text-sm font-medium text-white">All severe candidate races are already marked!</p>
            <p className="text-xs">No additional un-jokerized disaster races found in your log history.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {topRecommendations.map((cand, idx) => {
              const rankLabel = `TOP ${idx + 1}`;
              const badgeColor = idx === 0 ? 'bg-racing-red text-white' : idx === 1 ? 'bg-racing-orange text-white' : 'bg-racing-yellow text-racing-dark';
              const raceKey = getRaceKey(cand.file.fileName, cand.session.sessionIndex, cand.driver.name);
              const consumed = isConsumed(raceKey);
              const reasons = cand.jokerImpact?.reasons ?? [];

              return (
                <div
                  key={raceKey}
                  className="p-4 rounded-xl border transition-all bg-racing-dark/80 border-racing-border/70 hover:border-racing-purple/50 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-racing-border/40">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${badgeColor}`}>
                      {rankLabel}
                    </span>
                    <span className="text-xs font-mono font-bold text-racing-purple">
                      Priority: {cand.jokerImpact?.score ?? 0}/100
                    </span>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-white text-sm">{trackLabel(cand.file.trackCourse)}</div>
                        <div className="text-racing-muted text-[11px] font-mono">{cand.file.timeString.slice(0, 16).replace('T', ' ')}</div>
                      </div>
                      {onNavigate && (
                        <button
                          onClick={() => onNavigate('session', buildSessionContext(cand.file.fileName, cand.session.sessionIndex, cand.driver.name))}
                          className="px-2 py-1 rounded bg-racing-darker hover:bg-racing-purple/20 hover:border-racing-purple/40 border border-racing-border/40 text-racing-muted hover:text-racing-purple transition-all cursor-pointer flex items-center gap-1 text-[11px] font-mono shrink-0"
                          title="Open Session Details"
                        >
                          <span>Details</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 bg-racing-darker p-2 rounded border border-racing-border/30">
                      <div>
                        <div className="text-[10px] text-racing-muted">Rating Loss</div>
                        <div className="font-bold font-mono text-racing-red">
                          {cand.rrDelta} RR
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-racing-muted">Safety Impact</div>
                        <div className={`font-bold font-mono ${cand.srImpact < 0 ? 'text-racing-red' : 'text-racing-muted'}`}>
                          {cand.srImpact < 0 ? cand.srImpact.toFixed(2) : `+${cand.srImpact.toFixed(2)}`} SR
                        </div>
                      </div>
                    </div>

                    {reasons.length > 0 && (
                      <p className="text-[11px] text-racing-muted leading-tight">
                        {reasons.join(' · ')}
                      </p>
                    )}

                    <div className="pt-2">
                      <button
                        onClick={() => toggleJoker(raceKey)}
                        className={`w-full py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          consumed
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                            : 'bg-racing-purple hover:bg-racing-purple/80 text-white'
                        }`}
                      >
                        {consumed ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Joker Marked Active
                          </>
                        ) : (
                          <>
                            <Flame className="w-3.5 h-3.5" />
                            Mark This Joker as Used
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Main Table of All Races with Switch */}
      <div className="data-card carbon-fiber overflow-hidden">
        <DataCardHeader title="ALL RACES & JOKERS AUDIT">
          <div className="flex items-center gap-2">
            <FilterButtonGroup
              options={[
                { value: 'all', label: `All Races (${evaluatedRaces.length})` },
                { value: 'candidates', label: `Target Candidates ≥35 (${evaluatedRaces.filter(r => (r.jokerImpact?.score ?? 0) >= 35).length})` },
                { value: 'consumed', label: `Jokers Active (${consumedCount})` },
              ]}
              value={filter}
              onChange={setFilter}
            />
            <ExportButton columns={columns} data={filteredRows} filename="lmu-jokers-audit" />
          </div>
        </DataCardHeader>

        <SortableTable<RaceCollisionDetail>
          columns={columns}
          data={filteredRows}
          rowKey={r => getRaceKey(r.file.fileName, r.session.sessionIndex, r.driver.name)}
        />
      </div>
    </div>
  );
});
