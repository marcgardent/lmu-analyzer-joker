import { useState, useMemo, memo } from 'react';
import { Trophy, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { ClassBadge } from '../components/ClassBadge';
import { PositionBadge } from '../components/PositionBadge';
import { DataCardHeader } from '../components/DataCardHeader';
import { FilterButtonGroup } from '../components/FilterButtonGroup';
import { SortableTable, type Column } from '../components/SortableTable';
import { ExportButton } from '../components/ExportButton';
import { StatCard } from '../components/StatCard';
import { JokerImpactBadge } from '../components/JokerImpactBadge';
import {
  getRaceResults,
  isDnf,
  isIncompleteRace,
  isOnline,
  isRatedRace,
  isDriverIncident,
  computeRRDelta,
  computeSRImpact,
  type RaceResult,
} from '../lib/analytics';
import { computeRaceJokerImpact, getRaceKey } from '../lib/joker';
import { useJokers } from '../lib/JokerContext';
import { formatLapTime, getChartTooltipStyle, CHART_AXIS_TICK, CHART_GRID_STROKE } from '../lib/formatting';
import { buildSessionContext } from '../lib/sessionContext';
import { trackLabel, trackAlias } from '../lib/racepace';
import type { RaceFile, RaceJokerEvaluation } from '../lib/types';

type RaceRow = RaceResult & {
  raceKey: string;
  incidentCount: number;
  driverPenalties: RaceResult['session']['penalties'];
  jokerImpact: RaceJokerEvaluation;
  rrDelta: number;
  srImpact: number;
  isConsumed: boolean;
};

interface RaceResultsViewProps {
  files: RaceFile[];
  driverNames: string[];
  onNavigate?: (view: string, context?: string) => void;
}

export const RaceResultsView = memo(function RaceResultsView({ files, driverNames, onNavigate }: RaceResultsViewProps) {
  const [filter, setFilter] = useState<'all' | 'online' | 'rated' | 'joker_targets' | 'joker_active'>('all');
  const { isConsumed, toggleJoker, consumedCount, strategy } = useJokers();

  const allResults = useMemo(() => getRaceResults(files, driverNames), [files, driverNames]);

  const allRows = useMemo(() => {
    return allResults.map((r): RaceRow => {
      const raceKey = getRaceKey(r.file.fileName, r.session.sessionIndex, r.driver.name);
      const consumed = isConsumed(raceKey);
      const driverIncidents = r.session.incidents.filter(i => isDriverIncident(i, r.driver.name));
      const driverPenalties = r.session.penalties.filter(p => p.driver === r.driver.name);
      const totalSeverity = driverIncidents.reduce((sum, i) => sum + i.severity, 0);
      const vehicleContacts = driverIncidents.filter(i => (i.description || '').toLowerCase().includes('with another vehicle')).length;
      const wallContacts = driverIncidents.filter(i => {
        const text = (i.description || '').toLowerCase();
        return text.includes('immovable') || text.includes('wall') || text.includes('post') || text.includes('barrier');
      }).length;

      const dnf = isDnf(r.driver.finishStatus);
      const classDrivers = r.session.drivers.filter(d => d.carClass === r.driver.carClass).length;

      const { srImpact } = computeSRImpact(
        driverIncidents.length,
        vehicleContacts,
        wallContacts,
        driverPenalties.length,
        r.driver.totalLaps,
        dnf,
        totalSeverity
      );

      const rrDelta = computeRRDelta(
        r.classPosition,
        classDrivers,
        r.driver.classGridPosition,
        dnf
      );

      const jokerImpact = computeRaceJokerImpact({
        rrDelta,
        srImpact,
        isDnf: dnf,
        lapsCompleted: r.driver.totalLaps,
        position: r.position,
        classPosition: r.classPosition,
        gridPosition: r.driver.gridPosition,
        classGridPosition: r.driver.classGridPosition,
        penaltiesCount: driverPenalties.length,
        totalSeverity,
        vehicleContacts,
        isOnline: isOnline(r.file),
        isRated: isRatedRace(r.file),
      }, strategy);

      return {
        ...r,
        raceKey,
        incidentCount: driverIncidents.length,
        driverPenalties,
        jokerImpact,
        rrDelta,
        srImpact,
        isConsumed: consumed,
      };
    });
  }, [allResults, isConsumed, strategy]);

  const results = useMemo(() => {
    let filtered = allRows;
    if (filter === 'online') filtered = allRows.filter(r => isOnline(r.file));
    if (filter === 'rated') filtered = allRows.filter(r => isRatedRace(r.file));
    if (filter === 'joker_targets') filtered = allRows.filter(r => r.jokerImpact.score >= 50);
    if (filter === 'joker_active') filtered = allRows.filter(r => r.isConsumed);
    return filtered;
  }, [allRows, filter]);

  const positionData = useMemo(() => results.map((r, i) => ({
    race: `${(trackAlias(r.file.trackCourse) ?? r.file.trackCourse).slice(0, 12)} ${r.file.timeString.slice(5, 10)}`,
    position: r.classPosition,
    total: r.classDrivers,
    idx: i,
  })).reverse(), [results]);

  // Progression & Stats
  const totalRaces = results.length;
  const wins = results.filter(r => r.classPosition === 1).length;
  const podiums = results.filter(r => r.classPosition <= 3).length;
  const top5 = results.filter(r => r.classPosition <= 5).length;
  const avgPosition = totalRaces > 0
    ? (results.reduce((sum, r) => sum + r.classPosition, 0) / totalRaces).toFixed(1)
    : '--';
  const dnfs = results.filter(r => isDnf(r.driver.finishStatus)).length;

  const raceColumns: Column<RaceRow>[] = useMemo(() => [
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
      label: 'Track',
      width: '20%',
      sortValue: r => r.file.trackCourse,
      render: r => (
        <div className="flex flex-col">
          <span className="text-white font-medium">{trackLabel(r.file.trackCourse)}</span>
          <span className="text-[10px] text-racing-muted">{r.driver.carType}</span>
        </div>
      ),
    },
    {
      key: 'class',
      label: 'Class',
      align: 'center',
      width: '8%',
      sortValue: r => r.driver.carClass,
      render: r => <ClassBadge carClass={r.driver.carClass} />,
    },
    {
      key: 'grid',
      label: 'Grid',
      align: 'center',
      width: '55px',
      sortValue: r => r.driver.classGridPosition ?? 999,
      render: r => <span className="text-racing-muted font-mono">{r.driver.classGridPosition ? `P${r.driver.classGridPosition}` : '--'}</span>,
    },
    {
      key: 'finish',
      label: 'Finish',
      align: 'center',
      width: '70px',
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
      key: 'gain',
      label: 'Gain',
      align: 'center',
      width: '55px',
      sortValue: r => r.driver.classGridPosition ? r.driver.classGridPosition - r.classPosition : null,
      render: r => {
        const gain = r.driver.classGridPosition ? r.driver.classGridPosition - r.classPosition : null;
        if (gain === null) return null;
        if (gain === 0) return <Minus className="w-3 h-3 text-racing-muted mx-auto" />;
        return (
          <span className={`flex items-center justify-center gap-0.5 text-xs font-bold ${gain > 0 ? 'text-racing-green' : 'text-racing-red'}`}>
            {gain > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(gain)}
          </span>
        );
      },
    },
    {
      key: 'rrImpact',
      label: 'Rating (RR)',
      align: 'center',
      width: '110px',
      sortValue: r => (r.isConsumed && r.rrDelta < 0 ? 0 : r.rrDelta),
      render: r => {
        if (r.isConsumed && r.rrDelta < 0) {
          return (
            <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-racing-muted/70" title={`Joker Protected: ${r.rrDelta} RR negated`}>
              <span>🃏</span>
              <span className="line-through">{r.rrDelta} RR</span>
            </span>
          );
        }
        return (
          <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded ${r.rrDelta > 0 ? 'bg-racing-green/10 text-racing-green' : r.rrDelta < 0 ? 'bg-racing-red/10 text-racing-red' : 'bg-racing-dark text-racing-muted'}`}>
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
      sortValue: r => (r.isConsumed && r.srImpact < 0 ? 0 : r.srImpact),
      render: r => {
        if (r.isConsumed && r.srImpact < 0) {
          return (
            <span className="inline-flex items-center gap-1 font-mono text-xs font-bold text-racing-muted/70" title={`Joker Protected: ${r.srImpact.toFixed(2)} SR negated`}>
              <span>🃏</span>
              <span className="line-through">{r.srImpact.toFixed(2)} SR</span>
            </span>
          );
        }
        return (
          <span className={`font-mono text-xs font-bold ${r.srImpact > 0 ? 'text-racing-green' : r.srImpact < 0 ? 'text-racing-red' : 'text-racing-muted'}`}>
            {r.srImpact > 0 ? `+${r.srImpact.toFixed(2)}` : r.srImpact.toFixed(2)}
          </span>
        );
      },
    },
    {
      key: 'jokerImpact',
      label: 'Joker Action',
      align: 'center',
      width: '130px',
      sortValue: r => (r.isConsumed ? 999 : r.jokerImpact.score),
      render: r => (
        <div className="flex items-center justify-center">
          <JokerImpactBadge
            evaluation={r.jokerImpact}
            isConsumed={r.isConsumed}
            onToggleJoker={() => toggleJoker(r.raceKey)}
            variant="compact"
          />
        </div>
      ),
    },
    {
      key: 'bestLap',
      label: 'Best Lap',
      align: 'right',
      mono: true,
      width: '10%',
      sortValue: r => r.driver.bestLapTime,
      render: r => <span className="text-white font-mono">{formatLapTime(r.driver.bestLapTime)}</span>,
    },
    {
      key: 'laps',
      label: 'Laps',
      align: 'right',
      width: '50px',
      sortValue: r => r.driver.totalLaps,
      render: r => <span className="text-racing-muted font-mono">{r.driver.totalLaps}</span>,
    },
    {
      key: 'incidents',
      label: 'Inc',
      align: 'center',
      width: '45px',
      sortValue: r => r.incidentCount,
      render: r => r.incidentCount > 0 ? <span className="text-racing-orange font-mono font-bold">{r.incidentCount}</span> : <span className="text-racing-muted/30 font-mono">0</span>,
    },
    {
      key: 'penalties',
      label: 'Pen',
      align: 'center',
      width: '45px',
      sortValue: r => r.driverPenalties.length,
      render: r => {
        if (r.driverPenalties.length === 0) return <span className="text-racing-muted/30 font-mono">0</span>;
        const types = r.driverPenalties.map(p => p.type).join(', ');
        return <span className="text-racing-red font-mono font-bold" title={types}>{r.driverPenalties.length}</span>;
      },
    },
    {
      key: 'status',
      label: 'Status',
      width: '10%',
      sortValue: r => r.driver.finishStatus,
      render: r => <span className={`text-xs ${!isDnf(r.driver.finishStatus) ? 'text-racing-green' : 'text-racing-red'}`}>{r.driver.finishStatus || 'Finished'}</span>,
    },
  ], [toggleJoker]);

  return (
    <div className="space-y-6">
      {/* Filter & Options */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterButtonGroup
          options={[
            { value: 'all', label: 'All Races' },
            { value: 'online', label: 'Online' },
            { value: 'rated', label: 'Rated' },
            { value: 'joker_targets', label: '🎯 Joker Targets (Score ≥ 50)' },
            { value: 'joker_active', label: `🔥 Active Jokers (${consumedCount})` },
          ]}
          value={filter}
          onChange={setFilter}
        />
      </div>

      {/* Race Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <StatCard variant="center" label="Races" value={totalRaces} />
        <StatCard variant="center" label="Wins" value={wins} accent="text-racing-gold" />
        <StatCard variant="center" label="Podiums" value={podiums} accent="text-racing-orange" />
        <StatCard variant="center" label="Top 5" value={top5} accent="text-racing-blue" />
        <StatCard variant="center" label="Avg Pos" value={avgPosition} />
        <StatCard variant="center" label="DNFs" value={dnfs} accent={dnfs > 0 ? 'text-racing-red' : 'text-racing-green'} />
      </div>

      {/* Position Chart */}
      {positionData.length > 0 && (
        <div className="data-card carbon-fiber p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-racing text-sm font-bold text-white tracking-wider">CLASS POSITION HISTORY</h3>
            <div className="flex items-center gap-3 text-[11px] text-racing-muted font-mono">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#d4a843]" /> P1</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#ff6d00]" /> Podium</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#2196f3]" /> Top 5</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={positionData}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
              <XAxis dataKey="race" tick={{ fill: CHART_AXIS_TICK, fontSize: 9 }} angle={-45} textAnchor="end" height={80} />
              <YAxis reversed tick={{ fill: CHART_AXIS_TICK, fontSize: 11 }} domain={[1, 'auto']} allowDecimals={false} />
              <Tooltip
                contentStyle={getChartTooltipStyle()}
                formatter={(v: unknown, _: unknown, entry: unknown) => [
                  `P${v} / ${(entry as { payload: { total: number } }).payload.total}`,
                  'Position',
                ]}
              />
              <Bar dataKey="position" radius={[4, 4, 0, 0]}>
                {positionData.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={entry.position === 1 ? '#d4a843' : entry.position <= 3 ? '#ff6d00' : entry.position <= 5 ? '#2196f3' : '#6b7280'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Race List Table */}
      <div className="data-card carbon-fiber overflow-hidden">
        <DataCardHeader title="RACE HISTORY & JOKER IMPACT">
          <span className="ml-auto text-[10px] font-mono text-racing-muted/50">{results.length} races</span>
          <ExportButton columns={raceColumns} data={results} filename="lmu-race-results" />
        </DataCardHeader>
        <SortableTable<RaceRow>
          columns={raceColumns}
          data={results}
          rowKey={(r, i) => `${r.file.fileName}-${i}`}
          onRowClick={onNavigate ? (row) => onNavigate('session', buildSessionContext(row.file.fileName, row.session.sessionIndex, row.driver.name)) : undefined}
        />
      </div>

      {results.length === 0 && (
        <div className="text-center py-12 text-racing-muted">
          <Trophy className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>No race results found matching current filters.</p>
        </div>
      )}
    </div>
  );
});
