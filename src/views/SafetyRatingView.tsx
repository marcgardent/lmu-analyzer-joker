import { useState, useMemo, memo } from 'react';
import {
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Flame,
  Swords,
  Car,
  AlertTriangle,
  Award,
  Minus,
  Route,
  Zap,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { ClassBadge } from '../components/ClassBadge';
import { PositionBadge } from '../components/PositionBadge';
import { DataCardHeader } from '../components/DataCardHeader';
import { FilterButtonGroup } from '../components/FilterButtonGroup';
import { SortableTable, type Column } from '../components/SortableTable';
import { ExportButton } from '../components/ExportButton';
import { StatCard } from '../components/StatCard';
import {
  getSafetyAndRatingStats,
  isOnline,
  isRatedRace,
  isIncompleteRace,
} from '../lib/analytics';
import type {
  RaceCollisionDetail,
  CollisionOpponent,
  TrackSafetyStat,
  RaceFile,
} from '../lib/types';
import {
  getChartTooltipStyle,
  CHART_AXIS_TICK,
  CHART_GRID_STROKE,
  getSessionDate,
  formatSessionDateTime,
  formatSessionDateShort,
} from '../lib/formatting';
import { buildSessionContext } from '../lib/sessionContext';
import { trackLabel, trackAlias } from '../lib/racepace';
import { getRaceKey } from '../lib/joker';
import { useJokers } from '../lib/JokerContext';

interface SafetyRatingViewProps {
  files: RaceFile[];
  driverNames: string[];
  onNavigate?: (view: string, context?: string) => void;
}

type QuickSortMode = 'all' | 'most_collisions' | 'highest_severity' | 'best_sr' | 'worst_sr' | 'best_rr' | 'worst_rr';

function getGradeColor(grade: RaceCollisionDetail['srGrade']): string {
  switch (grade) {
    case 'A+': return 'text-racing-green bg-racing-green/15 border-racing-green/30';
    case 'A': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/25';
    case 'B': return 'text-racing-blue bg-racing-blue/10 border-racing-blue/25';
    case 'C': return 'text-racing-yellow bg-racing-yellow/10 border-racing-yellow/25';
    case 'D': return 'text-racing-orange bg-racing-orange/10 border-racing-orange/25';
    case 'F': return 'text-racing-red bg-racing-red/15 border-racing-red/30';
    default: return 'text-racing-muted bg-racing-muted/10 border-racing-muted/20';
  }
}

export const SafetyRatingView = memo(function SafetyRatingView({ files, driverNames, onNavigate }: SafetyRatingViewProps) {
  const [filter, setFilter] = useState<'all' | 'online' | 'rated'>('all');
  const [quickSort, setQuickSort] = useState<QuickSortMode>('all');
  const [activeTab, setActiveTab] = useState<'trends' | 'rivalries' | 'tracks'>('trends');
  const { isConsumed } = useJokers();

  // Compute all safety stats
  const fullStats = useMemo(() => getSafetyAndRatingStats(files, driverNames), [files, driverNames]);

  // Filter and sort races
  const filteredRaces = useMemo(() => {
    let list = fullStats.raceDetails;
    if (filter === 'online') list = list.filter(r => isOnline(r.file));
    if (filter === 'rated') list = list.filter(r => isRatedRace(r.file));

    const copy = [...list];
    switch (quickSort) {
      case 'most_collisions':
        return copy.sort((a, b) => b.totalIncidents - a.totalIncidents || b.totalSeverity - a.totalSeverity);
      case 'highest_severity':
        return copy.sort((a, b) => b.totalSeverity - a.totalSeverity || b.totalIncidents - a.totalIncidents);
      case 'best_sr':
        return copy.sort((a, b) => b.srImpact - a.srImpact || b.lapsCompleted - a.lapsCompleted);
      case 'worst_sr':
        return copy.sort((a, b) => a.srImpact - b.srImpact || b.totalIncidents - a.totalIncidents);
      case 'best_rr':
        return copy.sort((a, b) => b.rrDelta - a.rrDelta || a.classPosition - b.classPosition);
      case 'worst_rr':
        return copy.sort((a, b) => a.rrDelta - b.rrDelta);
      case 'all':
      default:
        return copy.sort((a, b) => getSessionDate(b.file, b.session).localeCompare(getSessionDate(a.file, a.session)));
    }
  }, [fullStats.raceDetails, filter, quickSort]);

  // Timeline chart data (chronological order)
  const timelineData = useMemo(() => {
    const sortedChronological = [...(filter === 'all'
      ? fullStats.raceDetails
      : fullStats.raceDetails.filter(r => (filter === 'online' ? isOnline(r.file) : isRatedRace(r.file))))
    ].reverse();

    let cumSR = 0;
    let cumRR = 0;

    return sortedChronological.map((r, idx) => {
      cumSR = Number((cumSR + r.srImpact).toFixed(2));
      cumRR += r.rrDelta;

      const sessionDate = getSessionDate(r.file, r.session);
      const dateShort = formatSessionDateShort(sessionDate);
      const trackName = (trackAlias(r.file.trackCourse) ?? r.file.trackCourse).slice(0, 10);

      return {
        idx: idx + 1,
        raceLabel: `${trackName} (${dateShort})`,
        date: sessionDate,
        track: r.file.trackCourse,
        vehicleContacts: r.vehicleContacts,
        wallContacts: r.wallContacts,
        otherContacts: r.otherContacts,
        totalIncidents: r.totalIncidents,
        severity: r.totalSeverity,
        srImpact: r.srImpact,
        cumulativeSR: cumSR,
        rrDelta: r.rrDelta,
        cumulativeRR: cumRR,
        classPosition: r.classPosition,
        classDrivers: r.classDrivers,
      };
    });
  }, [fullStats.raceDetails, filter]);

  // Aggregated KPIs for currently filtered races
  const currentTotalIncidents = useMemo(() => filteredRaces.reduce((sum, r) => sum + r.totalIncidents, 0), [filteredRaces]);
  const currentVehicleContacts = useMemo(() => filteredRaces.reduce((sum, r) => sum + r.vehicleContacts, 0), [filteredRaces]);
  const currentWallContacts = useMemo(() => filteredRaces.reduce((sum, r) => sum + r.wallContacts, 0), [filteredRaces]);
  const currentTotalSeverity = useMemo(() => filteredRaces.reduce((sum, r) => sum + r.totalSeverity, 0), [filteredRaces]);
  const currentCleanRaces = useMemo(() => filteredRaces.filter(r => r.totalIncidents === 0 && r.penaltiesCount === 0 && !r.isDnf).length, [filteredRaces]);
  const currentCleanPct = filteredRaces.length > 0 ? Math.round((currentCleanRaces / filteredRaces.length) * 100) : 0;
  const currentTotalLaps = useMemo(() => filteredRaces.reduce((sum, r) => sum + r.lapsCompleted, 0), [filteredRaces]);
  const currentAvgIPL = currentTotalLaps > 0 ? Number((currentTotalIncidents / currentTotalLaps).toFixed(2)) : 0;
  const currentNetSR = useMemo(() => Number(filteredRaces.reduce((sum, r) => sum + r.srImpact, 0).toFixed(2)), [filteredRaces]);
  const currentNetRR = useMemo(() => filteredRaces.reduce((sum, r) => sum + r.rrDelta, 0), [filteredRaces]);

  // Columns for Main Race Collision Table
  const raceColumns: Column<RaceCollisionDetail>[] = useMemo(() => [
    {
      key: 'date',
      label: 'Date',
      width: '12%',
      sortValue: r => getSessionDate(r.file, r.session),
      render: r => <span className="text-racing-muted text-xs font-mono">{formatSessionDateTime(getSessionDate(r.file, r.session))}</span>,
    },
    {
      key: 'track',
      label: 'Track',
      width: '16%',
      sortValue: r => r.file.trackCourse,
      render: r => (
        <div>
          <span className="text-white font-medium">{trackLabel(r.file.trackCourse)}</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-racing-muted text-[10px]">{r.driver.carType}</span>
            <ClassBadge carClass={r.driver.carClass} />
          </div>
        </div>
      ),
    },
    {
      key: 'finish',
      label: 'Finish',
      align: 'center',
      width: '75px',
      sortValue: r => r.classPosition,
      render: r => (
        <div className="text-center">
          <div className="flex items-center justify-center gap-1">
            <PositionBadge
              position={r.classPosition}
              total={r.classDrivers}
              isProvisional={isIncompleteRace(r.session)}
            />
          </div>
          {r.positionGain !== null && (
            <span className={`text-[10px] font-bold flex items-center justify-center gap-0.5 ${r.positionGain > 0 ? 'text-racing-green' : r.positionGain < 0 ? 'text-racing-red' : 'text-racing-muted'}`}>
              {r.positionGain > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : r.positionGain < 0 ? <TrendingDown className="w-2.5 h-2.5" /> : <Minus className="w-2.5 h-2.5" />}
              {r.positionGain > 0 ? `+${r.positionGain}` : r.positionGain}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'vehContacts',
      label: 'Car Hit',
      align: 'center',
      width: '70px',
      sortValue: r => r.vehicleContacts,
      render: r => (
        r.vehicleContacts > 0 ? (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-racing-red/15 border border-racing-red/30 text-racing-red font-mono text-xs font-bold" title={`${r.vehicleContacts} vehicle contacts`}>
            <Car className="w-3 h-3" />
            {r.vehicleContacts}
          </span>
        ) : (
          <span className="text-racing-muted/30 font-mono text-xs">0</span>
        )
      ),
    },
    {
      key: 'wallContacts',
      label: 'Wall Hit',
      align: 'center',
      width: '70px',
      sortValue: r => r.wallContacts,
      render: r => (
        r.wallContacts > 0 ? (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-racing-yellow/15 border border-racing-yellow/30 text-racing-yellow font-mono text-xs font-bold" title={`${r.wallContacts} wall/barrier contacts`}>
            {r.wallContacts}
          </span>
        ) : (
          <span className="text-racing-muted/30 font-mono text-xs">0</span>
        )
      ),
    },
    {
      key: 'totalInc',
      label: 'Total Inc',
      align: 'center',
      width: '75px',
      sortValue: r => r.totalIncidents,
      render: r => (
        r.totalIncidents === 0 ? (
          <span className="inline-flex items-center gap-0.5 text-racing-green font-bold text-xs">
            <ShieldCheck className="w-3.5 h-3.5" /> Clean
          </span>
        ) : (
          <span className={`font-mono text-xs font-bold ${r.totalIncidents >= 10 ? 'text-racing-red' : r.totalIncidents >= 4 ? 'text-racing-orange' : 'text-racing-yellow'}`}>
            {r.totalIncidents}
          </span>
        )
      ),
    },
    {
      key: 'severity',
      label: 'Force',
      align: 'right',
      mono: true,
      width: '80px',
      sortValue: r => r.totalSeverity,
      render: r => (
        r.totalSeverity > 0 ? (
          <span className={`font-mono text-xs ${r.totalSeverity > 20000 ? 'text-racing-red font-bold' : r.totalSeverity > 5000 ? 'text-racing-orange' : 'text-racing-muted'}`}>
            {r.totalSeverity.toLocaleString()}
          </span>
        ) : (
          <span className="text-racing-muted/30">0</span>
        )
      ),
    },
    {
      key: 'penalties',
      label: 'Pen',
      align: 'center',
      width: '50px',
      sortValue: r => r.penaltiesCount,
      render: r => (
        r.penaltiesCount > 0 ? (
          <span className="text-racing-red font-mono font-bold text-xs" title={`${r.penaltiesCount} penalties`}>
            {r.penaltiesCount}
          </span>
        ) : (
          <span className="text-racing-muted/30 font-mono text-xs">0</span>
        )
      ),
    },
    {
      key: 'srImpact',
      label: 'SR Impact',
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
          <div className="flex items-center justify-center gap-1.5">
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${getGradeColor(r.srGrade)}`}>
              {r.srGrade}
            </span>
            <span className={`font-mono text-xs font-bold ${r.srImpact > 0 ? 'text-racing-green' : r.srImpact < 0 ? 'text-racing-red' : 'text-racing-muted'}`}>
              {r.srImpact > 0 ? `+${r.srImpact.toFixed(2)}` : r.srImpact.toFixed(2)}
            </span>
          </div>
        );
      },
    },
    {
      key: 'rrDelta',
      label: 'RR Points',
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
          <span className={`inline-flex items-center gap-0.5 font-mono text-xs font-bold px-2 py-0.5 rounded ${r.rrDelta > 0 ? 'bg-racing-green/10 text-racing-green' : r.rrDelta < 0 ? 'bg-racing-red/10 text-racing-red' : 'bg-racing-dark text-racing-muted'}`}>
            {r.rrDelta > 0 ? <TrendingUp className="w-3 h-3" /> : r.rrDelta < 0 ? <TrendingDown className="w-3 h-3" /> : null}
            {r.rrDelta > 0 ? `+${r.rrDelta}` : r.rrDelta}
          </span>
        );
      },
    },
    {
      key: 'laps',
      label: 'Laps',
      align: 'right',
      width: '50px',
      sortValue: r => r.lapsCompleted,
      render: r => <span className="text-racing-muted font-mono text-xs">{r.lapsCompleted}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      width: '110px',
      sortValue: r => r.finishStatus,
      render: r => (
        <span className={`text-xs font-medium ${!r.isDnf ? 'text-racing-green' : 'text-racing-red'}`}>
          {r.finishStatus || 'Finished'}
        </span>
      ),
    },
  ], [isConsumed]);

  // Columns for Rivalries Table
  const rivalriesColumns: Column<CollisionOpponent>[] = useMemo(() => [
    {
      key: 'opponent',
      label: 'Driver Name',
      width: '40%',
      sortValue: o => o.opponent,
      render: o => (
        <div className="flex items-center gap-2">
          <Swords className="w-3.5 h-3.5 text-racing-red shrink-0" />
          <span className="text-white font-medium truncate">{o.opponent}</span>
        </div>
      ),
    },
    {
      key: 'count',
      label: 'Collisions',
      align: 'center',
      width: '20%',
      sortValue: o => o.count,
      render: o => (
        <span className="px-2 py-0.5 rounded bg-racing-red/15 border border-racing-red/30 text-racing-red font-mono font-bold text-xs">
          {o.count}
        </span>
      ),
    },
    {
      key: 'races',
      label: 'Races Involved',
      align: 'center',
      width: '20%',
      sortValue: o => o.racesCount,
      render: o => <span className="text-racing-muted font-mono text-xs">{o.racesCount}</span>,
    },
    {
      key: 'severity',
      label: 'Cumulative Force',
      align: 'right',
      mono: true,
      width: '20%',
      sortValue: o => o.severity,
      render: o => <span className="text-racing-orange font-mono text-xs">{o.severity.toLocaleString()}</span>,
    },
  ], []);

  // Columns for Track Safety Table
  const trackSafetyColumns: Column<TrackSafetyStat>[] = useMemo(() => [
    {
      key: 'track',
      label: 'Circuit',
      width: '35%',
      sortValue: t => t.trackCourse,
      render: t => <span className="text-white font-medium">{trackLabel(t.trackCourse)}</span>,
    },
    {
      key: 'races',
      label: 'Races',
      align: 'center',
      width: '12%',
      sortValue: t => t.racesCount,
      render: t => <span className="text-racing-muted font-mono text-xs">{t.racesCount}</span>,
    },
    {
      key: 'avgInc',
      label: 'Avg Inc/Race',
      align: 'center',
      width: '18%',
      sortValue: t => t.avgIncidentsPerRace,
      render: t => (
        <span className={`font-mono text-xs font-bold ${t.avgIncidentsPerRace >= 8 ? 'text-racing-red' : t.avgIncidentsPerRace >= 3 ? 'text-racing-orange' : 'text-racing-green'}`}>
          {t.avgIncidentsPerRace}
        </span>
      ),
    },
    {
      key: 'veh',
      label: 'Car Hits',
      align: 'center',
      width: '12%',
      sortValue: t => t.vehicleContacts,
      render: t => <span className="text-racing-red font-mono text-xs font-bold">{t.vehicleContacts}</span>,
    },
    {
      key: 'wall',
      label: 'Wall Hits',
      align: 'center',
      width: '12%',
      sortValue: t => t.wallContacts,
      render: t => <span className="text-racing-yellow font-mono text-xs">{t.wallContacts}</span>,
    },
    {
      key: 'severity',
      label: 'Impact Force',
      align: 'right',
      mono: true,
      width: '15%',
      sortValue: t => t.totalSeverity,
      render: t => <span className="text-racing-muted font-mono text-xs">{t.totalSeverity.toLocaleString()}</span>,
    },
  ], []);

  return (
    <div className="space-y-6">
      {/* Filters and Quick Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <FilterButtonGroup
          options={[
            { value: 'all', label: 'All Races' },
            { value: 'online', label: 'Online' },
            { value: 'rated', label: 'Rated' },
          ]}
          value={filter}
          onChange={setFilter}
        />

        {/* Quick Focus Pills */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-racing-muted/60 text-[11px] uppercase tracking-wider font-semibold mr-1">Sort by:</span>
          {[
            { id: 'all', label: 'Latest' },
            { id: 'most_collisions', label: '💥 Max Collisions' },
            { id: 'highest_severity', label: '⚡ Max Impact' },
            { id: 'best_sr', label: '🛡️ Cleanest (SR+)' },
            { id: 'worst_sr', label: '⚠️ Worst SR' },
            { id: 'best_rr', label: '📈 Top RR Gain' },
            { id: 'worst_rr', label: '📉 Worst RR Drop' },
          ].map(opt => (
            <button
              key={opt.id}
              onClick={() => setQuickSort(opt.id as QuickSortMode)}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer text-xs font-medium ${quickSort === opt.id ? 'bg-racing-red text-white font-bold' : 'bg-racing-card border border-racing-border/60 text-racing-muted hover:text-white'}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main KPI Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <StatCard
          variant="tile"
          label="Total Collisions"
          value={currentTotalIncidents}
          sub={`${currentVehicleContacts} cars / ${currentWallContacts} walls`}
          icon={<Flame className="w-4 h-4" />}
          accent={currentTotalIncidents > 0 ? 'text-racing-orange' : 'text-racing-green'}
        />
        <StatCard
          variant="tile"
          label="Incidents / Lap"
          value={currentAvgIPL.toFixed(2)}
          sub={`avg ${(currentTotalIncidents / (filteredRaces.length || 1)).toFixed(1)} / race`}
          icon={<Route className="w-4 h-4" />}
        />
        <StatCard
          variant="tile"
          label="Clean Races"
          value={`${currentCleanPct}%`}
          sub={`${currentCleanRaces} of ${filteredRaces.length} races`}
          icon={<ShieldCheck className="w-4 h-4" />}
          accent="text-racing-green"
        />
        <StatCard
          variant="tile"
          label="Impact Force"
          value={currentTotalSeverity > 10000 ? `${Math.round(currentTotalSeverity / 1000)}k` : currentTotalSeverity}
          sub="cumulative energy"
          icon={<Zap className="w-4 h-4" />}
          accent="text-racing-yellow"
        />
        <StatCard
          variant="tile"
          label="Estimated Net SR"
          value={currentNetSR > 0 ? `+${currentNetSR.toFixed(2)}` : currentNetSR.toFixed(2)}
          sub="safety rating trajectory"
          icon={<Award className="w-4 h-4" />}
          accent={currentNetSR >= 0 ? 'text-racing-green' : 'text-racing-red'}
        />
        <StatCard
          variant="tile"
          label="Estimated Net RR"
          value={currentNetRR > 0 ? `+${currentNetRR}` : currentNetRR}
          sub="rank points delta"
          icon={currentNetRR >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          accent={currentNetRR >= 0 ? 'text-racing-gold' : 'text-racing-red'}
        />
      </div>

      {/* Deep Dive Navigation Subtabs */}
      <div className="data-card carbon-fiber p-4 space-y-4">
        <div className="flex items-center justify-between border-b border-racing-border/50 pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('trends')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${activeTab === 'trends' ? 'bg-racing-red text-white' : 'text-racing-muted hover:text-white'}`}
            >
              Collisions & Ratings Trajectory
            </button>
            <button
              onClick={() => setActiveTab('rivalries')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${activeTab === 'rivalries' ? 'bg-racing-red text-white' : 'text-racing-muted hover:text-white'}`}
            >
              Top Crash Rivals ({fullStats.rivalries.length})
            </button>
            <button
              onClick={() => setActiveTab('tracks')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${activeTab === 'tracks' ? 'bg-racing-red text-white' : 'text-racing-muted hover:text-white'}`}
            >
              Circuit Danger Ranking ({fullStats.trackSafetyStats.length})
            </button>
          </div>
        </div>

        {/* Tab 1: Charts (Collision History + SR/RR Progression) */}
        {activeTab === 'trends' && (
          <div className="space-y-6">
            <div>
              <h4 className="font-racing text-xs font-bold text-white tracking-wider mb-3">
                INCIDENTS & CONTACTS PER RACE (CHRONOLOGICAL)
              </h4>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
                  <XAxis dataKey="raceLabel" tick={{ fill: CHART_AXIS_TICK, fontSize: 9 }} angle={-35} textAnchor="end" height={60} />
                  <YAxis tick={{ fill: CHART_AXIS_TICK, fontSize: 11 }} domain={[0, 'auto']} />
                  <Tooltip
                    contentStyle={getChartTooltipStyle()}
                    formatter={(v: unknown, name: unknown) => [String(v), name === 'vehicleContacts' ? '🚗 Car Contacts' : '🧱 Wall Contacts']}
                  />
                  <Legend />
                  <Bar dataKey="vehicleContacts" name="Vehicle Contacts" fill="#ef4444" stackId="a" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="wallContacts" name="Wall Contacts" fill="#eab308" stackId="a" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="border-t border-racing-border/40 pt-4">
              <h4 className="font-racing text-xs font-bold text-white tracking-wider mb-3">
                CUMULATIVE SAFETY RATING (SR) & RANK RATING (RR) PROGRESSION
              </h4>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={timelineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
                  <XAxis dataKey="raceLabel" tick={{ fill: CHART_AXIS_TICK, fontSize: 9 }} angle={-35} textAnchor="end" height={60} />
                  <YAxis yAxisId="rr" orientation="left" tick={{ fill: CHART_AXIS_TICK, fontSize: 11 }} label={{ value: 'RR Points', angle: -90, position: 'insideLeft', fill: CHART_AXIS_TICK, fontSize: 10 }} />
                  <YAxis yAxisId="sr" orientation="right" tick={{ fill: CHART_AXIS_TICK, fontSize: 11 }} label={{ value: 'SR Delta', angle: 90, position: 'insideRight', fill: CHART_AXIS_TICK, fontSize: 10 }} />
                  <Tooltip
                    contentStyle={getChartTooltipStyle()}
                    formatter={(v: unknown, name: unknown) => [String(v), name === 'cumulativeRR' ? 'Est. Cumulative RR Points' : 'Est. Cumulative SR Impact']}
                  />
                  <Legend />
                  <Line yAxisId="rr" type="monotone" dataKey="cumulativeRR" name="Cumulative RR (Points)" stroke="#d4a843" strokeWidth={2} dot={false} />
                  <Line yAxisId="sr" type="monotone" dataKey="cumulativeSR" name="Cumulative SR Impact" stroke="#22c55e" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Tab 2: Crash Rivals */}
        {activeTab === 'rivalries' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-racing-muted text-xs">
                Opponent drivers involved in collisions with your vehicle across all parsed race sessions.
              </p>
              <ExportButton columns={rivalriesColumns} data={fullStats.rivalries} filename="lmu-collision-rivalries" />
            </div>
            {fullStats.rivalries.length > 0 ? (
              <SortableTable<CollisionOpponent>
                columns={rivalriesColumns}
                data={fullStats.rivalries}
                rowKey={r => r.opponent}
              />
            ) : (
              <div className="text-center py-8 text-racing-muted">
                <ShieldCheck className="w-10 h-10 mx-auto mb-2 opacity-30 text-racing-green" />
                <p>No collision opponents recorded!</p>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Circuit Danger Ranking */}
        {activeTab === 'tracks' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-racing-muted text-xs">
                Risk breakdown per circuit ordered by average incidents per race.
              </p>
              <ExportButton columns={trackSafetyColumns} data={fullStats.trackSafetyStats} filename="lmu-circuit-danger-ranking" />
            </div>
            <SortableTable<TrackSafetyStat>
              columns={trackSafetyColumns}
              data={fullStats.trackSafetyStats}
              rowKey={t => t.trackCourse}
            />
          </div>
        )}
      </div>

      {/* Main Sortable Race History Table */}
      <div className="data-card carbon-fiber overflow-hidden">
        <DataCardHeader title="RACE COLLISIONS & RATING AUDIT">
          <span className="ml-auto text-[10px] font-mono text-racing-muted/50">{filteredRaces.length} races</span>
          <ExportButton columns={raceColumns} data={filteredRaces} filename="lmu-race-collisions-ratings" />
        </DataCardHeader>
        <SortableTable<RaceCollisionDetail>
          columns={raceColumns}
          data={filteredRaces}
          rowKey={(r, i) => `${r.file.fileName}-${i}`}
          onRowClick={onNavigate ? (row) => onNavigate('session', buildSessionContext(row.file.fileName, row.session.sessionIndex, row.driver.name)) : undefined}
        />
      </div>

      {filteredRaces.length === 0 && (
        <div className="text-center py-12 text-racing-muted">
          <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>No race sessions found matching the selected filters.</p>
        </div>
      )}
    </div>
  );
});
