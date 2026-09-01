import type { CarClass } from './types';

export function formatLapTime(seconds: number | null): string {
  if (seconds === null || seconds <= 0) return '--:--.---';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const secsStr = secs.toFixed(3).padStart(6, '0');
  return mins > 0 ? `${mins}:${secsStr}` : secsStr;
}

export function formatDelta(delta: number): string {
  const sign = delta >= 0 ? '+' : '-';
  return `${sign}${Math.abs(delta).toFixed(3)}`;
}

export function formatPosition(pos: number | null | undefined, isProvisional = false): string {
  if (pos === null || pos === undefined || pos <= 0) return '--';
  return `P${pos}${isProvisional ? '?' : ''}`;
}

export function formatEventTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = String(Math.floor((seconds % 1) * 1000)).padStart(3, '0');
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${ms}`;
  return `${m}:${String(s).padStart(2, '0')}.${ms}`;
}

export function formatSector(v: number | null): string {
  if (v === null) return '--';
  return v.toFixed(3);
}

export function formatSpeed(kmh: number): string {
  return `${kmh.toFixed(0)} km/h`;
}

export function formatDistance(km: number): string {
  return `${Math.round(km).toLocaleString()} km`;
}

// Shared Recharts theme values — centralized so all views use the same chart chrome
export const CHART_AXIS_TICK = '#6b7280';
export const CHART_GRID_STROKE = '#2a2a3a';

/** Human-readable message from an unknown thrown value */
export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function getChartTooltipStyle() {
  return {
    background: 'var(--color-racing-card)',
    border: '1px solid var(--color-racing-border)',
    borderRadius: 8,
    fontSize: 12,
    color: 'var(--color-racing-text)',
  };
}

export function getConsistencyColor(c: number): string {
  return c > 98 ? 'text-racing-green' : c > 95 ? 'text-racing-yellow' : 'text-racing-orange';
}

export function getSessionTypeStyle(type: string): string {
  return type === 'Race' ? 'bg-racing-red/20 text-racing-red'
    : type === 'Qualifying' ? 'bg-racing-yellow/20 text-racing-yellow'
    : 'bg-racing-blue/20 text-racing-blue';
}

export function getClassColor(carClass: CarClass): string {
  switch (carClass) {
    case 'Hyper': return 'var(--color-hyper)';
    case 'GT3': return 'var(--color-gt3)';
    case 'GTE': return 'var(--color-gte)';
    case 'LMP3': return 'var(--color-lmp3)';
    case 'LMP2-WEC': return 'var(--color-lmp2wec)';
    case 'LMP2-ELMS': return 'var(--color-lmp2elms)';
    default: return 'var(--color-racing-muted)';
  }
}

/**
 * Resolves the most accurate session date/time string available.
 * Priority: session.dateTime > file.timeString > file.dateTime > fileName extraction
 */
export function getSessionDate(
  file?: { timeString?: string; dateTime?: string; fileName?: string } | null,
  session?: { dateTime?: string } | null
): string {
  if (session?.dateTime && session.dateTime.trim() !== '') {
    return session.dateTime.trim();
  }
  if (file?.timeString && file.timeString.trim() !== '') {
    return file.timeString.trim();
  }
  if (file?.dateTime && file.dateTime.trim() !== '') {
    const ts = parseInt(file.dateTime, 10);
    if (!isNaN(ts) && ts > 0 && file.dateTime.trim().length >= 9 && file.dateTime.trim().length <= 11) {
      const d = new Date(ts * 1000);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }
    return file.dateTime.trim();
  }
  if (file?.fileName) {
    const match = file.fileName.match(/^(\d{4})_(\d{2})_(\d{2})_(\d{2})_(\d{2})_(\d{2})/);
    if (match) {
      return `${match[1]}/${match[2]}/${match[3]} ${match[4]}:${match[5]}:${match[6]}`;
    }
  }
  return '';
}

/**
 * Formats a raw date/time string into a normalized, readable "YYYY-MM-DD HH:mm".
 */
export function formatSessionDateTime(rawDate: string): string {
  if (!rawDate) return '--';
  const clean = rawDate.trim().replace('T', ' ').replace(/_/g, '-');
  const match = clean.match(/^(\d{4})[-/](\d{2})[-/](\d{2})[\s]+(\d{2}):(\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}`;
  }
  return clean.slice(0, 16);
}

/**
 * Formats a raw date string into a short "MM-DD" or "MM-DD HH:mm".
 */
export function formatSessionDateShort(rawDate: string): string {
  if (!rawDate) return '--';
  const clean = rawDate.trim().replace('T', ' ').replace(/_/g, '-');
  const match = clean.match(/^\d{4}[-/](\d{2})[-/](\d{2})/);
  if (match) {
    return `${match[1]}-${match[2]}`;
  }
  return clean.slice(5, 10);
}

