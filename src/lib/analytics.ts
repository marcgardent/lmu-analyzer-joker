import type {
  RaceFile, PersonalBest, DriverSummary, DriverResult, LapData, SessionData, CarClass,
  RaceCollisionDetail, SafetySummaryStats, CollisionOpponent, TrackSafetyStat,
} from './types';
import { computeRaceJokerImpact } from './joker';

/** Car classes ordered by speed (fastest first) */
export const CLASS_SPEED_ORDER: CarClass[] = ['Hyper', 'LMP2-WEC', 'LMP2-ELMS', 'LMP3', 'GTE', 'GT3'];

/** True when a finish status indicates the driver did not finish normally */
export function isDnf(finishStatus: string): boolean {
  return finishStatus !== '' && finishStatus !== 'Finished Normally' && finishStatus !== 'None';
}

/** True when a Race session XML was saved before the race ended (early exit / in-progress snapshot) */
export function isIncompleteRace(session: SessionData): boolean {
  if (session.type !== 'Race') return false;
  return !session.drivers.some(d => d.finishStatus === 'Finished Normally' || (d.finishTime !== null && d.finishTime > 0));
}

/** True when a lap has a usable lap time (matches the `lapTime && lapTime > 0` convention) */
export function isValidLap(lap: LapData): lap is LapData & { lapTime: number } {
  return lap.lapTime !== null && lap.lapTime > 0;
}

// ---------------------------------------------------------------------------
// Session deduplication / merging
// ---------------------------------------------------------------------------

function mergeDriverResult(entries: DriverResult[]): DriverResult {
  // Pick the entry with the best finish as the base for metadata
  const sorted = [...entries].sort((a, b) => {
    const aOk = !isDnf(a.finishStatus);
    const bOk = !isDnf(b.finishStatus);
    if (aOk !== bOk) return aOk ? -1 : 1;
    return b.totalLaps - a.totalLaps;
  });
  const base = { ...sorted[0] };

  // Merge laps across rejoin fragments. Lap numbers can reset on rejoin,
  // so we append each fragment's laps with renumbered offsets when overlaps
  // are detected rather than deduplicating by lap number.
  const allLaps: LapData[] = [];
  let nextNum = 0;
  for (const entry of entries) {
    for (const lap of entry.laps) {
      const num = lap.num <= nextNum ? nextNum + 1 : lap.num;
      allLaps.push(num === lap.num ? lap : { ...lap, num });
      nextNum = num;
    }
  }
  base.laps = allLaps;
  base.totalLaps = entries.reduce((sum, e) => sum + e.totalLaps, 0);

  // Recalculate best lap from merged data
  let best: number | null = null;
  for (const lap of base.laps) {
    if (isValidLap(lap) && (best === null || lap.lapTime < best)) {
      best = lap.lapTime;
    }
  }
  base.bestLapTime = best;
  return base;
}

function mergeSessions(sessions: SessionData[]): SessionData {
  // Use the most complete session as the base
  const sorted = [...sessions].sort((a, b) => b.mostLapsCompleted - a.mostLapsCompleted);
  const base = { ...sorted[0] };

  // Merge all drivers across session duplicates
  const driverMap = new Map<string, DriverResult[]>();
  for (const s of sessions) {
    for (const d of s.drivers) {
      const list = driverMap.get(d.name);
      if (list) list.push(d);
      else driverMap.set(d.name, [d]);
    }
  }
  base.drivers = Array.from(driverMap.values()).map(list =>
    list.length === 1 ? list[0] : mergeDriverResult(list),
  );

  // Merge stream events — deduplicate by time + description
  const incidentKeys = new Set<string>();
  base.incidents = [];
  for (const s of sessions) {
    for (const inc of s.incidents) {
      const key = `${inc.time.toFixed(1)}|${inc.description}`;
      if (!incidentKeys.has(key)) { incidentKeys.add(key); base.incidents.push(inc); }
    }
  }
  const penaltyKeys = new Set<string>();
  base.penalties = [];
  for (const s of sessions) {
    for (const pen of s.penalties) {
      const key = `${pen.time.toFixed(1)}|${pen.driver}|${pen.type}`;
      if (!penaltyKeys.has(key)) { penaltyKeys.add(key); base.penalties.push(pen); }
    }
  }
  const tlKeys = new Set<string>();
  base.trackLimits = [];
  for (const s of sessions) {
    for (const tl of s.trackLimits) {
      const key = `${tl.time.toFixed(1)}|${tl.driver}|${tl.lap}`;
      if (!tlKeys.has(key)) { tlKeys.add(key); base.trackLimits.push(tl); }
    }
  }

  return base;
}

/**
 * Merges rejoin fragments: when LMU writes multiple XML files for the same
 * server session (same event + source session tag), combine them
 * into a single session with merged laps, drivers, and stream events.
 */
export function deduplicateSessions(files: RaceFile[]): RaceFile[] {
  interface SessionRef { fileIdx: number; sessionIdx: number }

  // Group sessions by server identity. Use the original XML tag so
  // Practice1/Practice2 or Race1/Race2 are never merged together.
  const groups = new Map<string, SessionRef[]>();

  for (let fi = 0; fi < files.length; fi++) {
    const file = files[fi];
    for (let si = 0; si < file.sessions.length; si++) {
      const sess = file.sessions[si];
      const key = file.timeString
        ? `${file.timeString}|${file.trackCourse}|${sess.sourceTag ?? sess.type}`
        : `__ungrouped_${fi}_${si}`;
      const group = groups.get(key);
      if (group) group.push({ fileIdx: fi, sessionIdx: si });
      else groups.set(key, [{ fileIdx: fi, sessionIdx: si }]);
    }
  }

  // Nothing to merge — early exit without allocating an array
  let hasDuplicates = false;
  for (const g of groups.values()) {
    if (g.length > 1) { hasDuplicates = true; break; }
  }
  if (!hasDuplicates) return files;

  // Track which sessions to remove after merging
  const removeSet = new Set<string>();

  const cloned: RaceFile[] = files.map(f => ({ ...f, sessions: [...f.sessions] }));

  for (const group of groups.values()) {
    if (group.length === 1) continue;
    const sessions = group.map(r => cloned[r.fileIdx].sessions[r.sessionIdx]);
    cloned[group[0].fileIdx].sessions[group[0].sessionIdx] = mergeSessions(sessions);
    for (let k = 1; k < group.length; k++) {
      removeSet.add(`${group[k].fileIdx}_${group[k].sessionIdx}`);
    }
  }

  return cloned
    .map((f, fi) => ({
      ...f,
      sessions: f.sessions.filter((_, si) => !removeSet.has(`${fi}_${si}`)),
    }))
    .filter(f => f.sessions.length > 0);
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Convert driver name(s) to a Set for O(1) lookups */
function toNameSet(driverNames: string | string[]): Set<string> {
  return new Set(Array.isArray(driverNames) ? driverNames : [driverNames]);
}

/** Iterate over each (file, session, driver) tuple matching the given names */
function* forEachDriverSession(files: RaceFile[], nameSet: Set<string>) {
  for (const file of files) {
    for (const session of file.sessions) {
      for (const driver of session.drivers) {
        if (nameSet.has(driver.name)) yield { file, session, driver };
      }
    }
  }
}

/** Build a PersonalBest record from file/session/driver/lap context */
function toLapRecord(file: RaceFile, session: SessionData, driver: DriverResult, lap: LapData): PersonalBest {
  return {
    lapTime: lap.lapTime!,
    sector1: lap.sector1,
    sector2: lap.sector2,
    sector3: lap.sector3,
    topSpeed: lap.topSpeed,
    trackVenue: file.trackVenue,
    trackCourse: file.trackCourse,
    carType: driver.carType,
    carClass: driver.carClass,
    sessionType: session.type,
    sessionIndex: session.sessionIndex,
    date: file.timeString,
    fileName: file.fileName,
    lapNumber: lap.num,
    driverName: driver.name,
  };
}


/** Average, standard deviation, and consistency score (0-100%) of lap times */
export function lapTimeStats(times: number[]): { avg: number; stdDev: number; consistency: number } {
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const stdDev = Math.sqrt(times.reduce((s, t) => s + (t - avg) ** 2, 0) / times.length);
  return { avg, stdDev, consistency: 100 - (stdDev / avg) * 100 };
}

/** Consistency score (0-100%) based on coefficient of variation of valid lap times */
export function calculateConsistency(laps: LapData[]): number | null {
  const times = laps.filter(isValidLap).map(l => l.lapTime);
  if (times.length < 2) return null;
  return lapTimeStats(times).consistency;
}

/** Highest top speed from a set of laps, or null if none recorded */
export function getTopSpeed(laps: LapData[]): number | null {
  const speeds = laps.map(l => l.topSpeed).filter(s => s > 0);
  return speeds.length ? Math.max(...speeds) : null;
}

/**
 * Average tire wear per lap in %-points (mean of the four corners).
 * Skips laps without tire data and tire changes (remaining wear going up).
 */
export function getTireWearPerLap(laps: LapData[]): number | null {
  const deltas: number[] = [];
  let prev: number | null = null;
  for (const lap of laps) {
    const { fl, fr, rl, rr } = lap.tireWear;
    if (fl <= 0) { prev = null; continue; }
    const avg = (fl + fr + rl + rr) / 4;
    if (prev !== null && prev > avg) deltas.push((prev - avg) * 100);
    prev = lap.isPit ? null : avg;
  }
  if (deltas.length === 0) return null;
  return deltas.reduce((a, b) => a + b, 0) / deltas.length;
}

export function isDriverIncident(incident: { driver1: string; description: string }, driverName: string): boolean {
  return incident.driver1 === driverName || incident.description.includes(driverName);
}


/** Max-int32 value the game writes when a numeric setting is unset/unlimited */
export const MAX_INT32_SENTINEL = 2147483647;

/** True when a session file was recorded in online multiplayer */
export function isOnline(file: RaceFile): boolean {
  return file.setting === 'Multiplayer';
}

export function isRatedRace(file: RaceFile): boolean {
  // freeSettings may be missing on files from legacy caches — treat unknown as unrated
  return isOnline(file) && file.freeSettings != null && file.freeSettings !== MAX_INT32_SENTINEL;
}

export function filterFilesByClasses(files: RaceFile[], classes: CarClass[]): RaceFile[] {
  if (classes.length === 0) return files;
  const classSet = new Set(classes);
  return files.map(file => ({
    ...file,
    sessions: file.sessions.map(session => ({
      ...session,
      drivers: session.drivers.filter(d => classSet.has(d.carClass)),
    })).filter(s => s.drivers.length > 0),
  })).filter(f => f.sessions.length > 0);
}

export function getAllDrivers(files: RaceFile[]): DriverSummary[] {
  const map = new Map<string, DriverSummary>();

  for (const file of files) {
    for (const session of file.sessions) {
      for (const driver of session.drivers) {
        const existing = map.get(driver.name);
        if (existing) {
          existing.sessionCount++;
          existing.totalLaps += driver.totalLaps;
          if (driver.isPlayer) existing.isPlayer = true;
        } else {
          map.set(driver.name, {
            name: driver.name,
            sessionCount: 1,
            totalLaps: driver.totalLaps,
            isPlayer: driver.isPlayer,
          });
        }
      }
    }
  }

  const drivers = Array.from(map.values());
  drivers.sort((a, b) => {
    if (a.isPlayer !== b.isPlayer) return a.isPlayer ? -1 : 1;
    return b.sessionCount - a.sessionCount;
  });
  return drivers;
}

export function detectPlayerDrivers(files: RaceFile[]): string[] {
  // In single-player / AI sessions, exactly 1 driver has isPlayer=1 — that's the local user.
  const localNames = new Set<string>();
  for (const file of files) {
    for (const session of file.sessions) {
      const players = session.drivers.filter(d => d.isPlayer);
      if (players.length === 1) {
        localNames.add(players[0].name);
      }
    }
  }
  if (localNames.size > 0) return Array.from(localNames);

  // Fallback: no single-player sessions found — pick the player with the most sessions
  const sessionCounts = new Map<string, number>();
  for (const file of files) {
    for (const session of file.sessions) {
      for (const d of session.drivers) {
        if (d.isPlayer) {
          sessionCounts.set(d.name, (sessionCounts.get(d.name) ?? 0) + 1);
        }
      }
    }
  }
  if (sessionCounts.size === 0) return [];
  const sorted = Array.from(sessionCounts.entries()).sort((a, b) => b[1] - a[1]);
  return [sorted[0][0]];
}

export function getDriverSessions(
  files: RaceFile[],
  driverNames: string | string[]
): Array<{ file: RaceFile; session: SessionData; driver: DriverResult }> {
  const nameSet = toNameSet(driverNames);
  const results: Array<{ file: RaceFile; session: SessionData; driver: DriverResult }> = [];
  for (const entry of forEachDriverSession(files, nameSet)) {
    results.push(entry);
  }
  return results;
}

export function getPersonalBests(files: RaceFile[], driverNames: string | string[]): PersonalBest[] {
  const nameSet = toNameSet(driverNames);
  const bests = new Map<string, PersonalBest>();

  for (const { file, session, driver } of forEachDriverSession(files, nameSet)) {
    for (const lap of driver.laps) {
      if (!isValidLap(lap)) continue;

      const key = `${file.trackCourse}|${driver.carType}`;
      const existing = bests.get(key);

      if (!existing || lap.lapTime < existing.lapTime) {
        bests.set(key, toLapRecord(file, session, driver, lap));
      }
    }
  }

  const result = Array.from(bests.values());
  result.sort((a, b) => a.trackCourse.localeCompare(b.trackCourse) || a.lapTime - b.lapTime);
  return result;
}

export function getAllSessionBests(files: RaceFile[], driverNames: string | string[]): PersonalBest[] {
  const nameSet = toNameSet(driverNames);
  const results: PersonalBest[] = [];

  for (const { file, session, driver } of forEachDriverSession(files, nameSet)) {
    let bestLap: LapData | null = null;
    for (const lap of driver.laps) {
      if (!isValidLap(lap)) continue;
      if (!bestLap || lap.lapTime < bestLap.lapTime!) bestLap = lap;
    }
    if (bestLap) {
      results.push(toLapRecord(file, session, driver, bestLap));
    }
  }

  results.sort((a, b) => a.trackCourse.localeCompare(b.trackCourse) || a.lapTime - b.lapTime);
  return results;
}

export function getAllLaps(files: RaceFile[], driverNames: string | string[]): PersonalBest[] {
  const nameSet = toNameSet(driverNames);
  const results: PersonalBest[] = [];

  for (const { file, session, driver } of forEachDriverSession(files, nameSet)) {
    for (const lap of driver.laps) {
      if (!isValidLap(lap)) continue;
      results.push(toLapRecord(file, session, driver, lap));
    }
  }

  results.sort((a, b) => a.trackCourse.localeCompare(b.trackCourse) || a.lapTime - b.lapTime);
  return results;
}

/** Minimum sector times for one track+car combination */
export interface SectorMins {
  s1: number | null;
  s2: number | null;
  s3: number | null;
}

function updateSectorMins(entry: SectorMins, lap: LapData) {
  if (lap.sector1 !== null && (entry.s1 === null || lap.sector1 < entry.s1)) entry.s1 = lap.sector1;
  if (lap.sector2 !== null && (entry.s2 === null || lap.sector2 < entry.s2)) entry.s2 = lap.sector2;
  if (lap.sector3 !== null && (entry.s3 === null || lap.sector3 < entry.s3)) entry.s3 = lap.sector3;
}

/**
 * Best sector times per track+car in one pass over all laps.
 * Keyed by `${trackCourse}|${carType}` — matches how getTheoreticalBest is called.
 */
export function buildSectorMins(files: RaceFile[], driverNames: string | string[]): Map<string, SectorMins> {
  const nameSet = toNameSet(driverNames);
  const map = new Map<string, SectorMins>();
  for (const { file, driver } of forEachDriverSession(files, nameSet)) {
    const key = `${file.trackCourse}|${driver.carType}`;
    let entry = map.get(key);
    if (!entry) { entry = { s1: null, s2: null, s3: null }; map.set(key, entry); }
    for (const lap of driver.laps) updateSectorMins(entry, lap);
  }
  return map;
}

export function getTheoreticalBest(
  files: RaceFile[],
  driverNames: string | string[],
  trackCourse: string,
  carType: string,
  // Optional precomputed entry (from buildSectorMins / DataIndex.sectorMins) — skips the full scan
  precomputed?: SectorMins,
): SectorMins & { total: number | null } {
  let mins = precomputed;
  if (!mins) {
    const nameSet = toNameSet(driverNames);
    const entry: SectorMins = { s1: null, s2: null, s3: null };
    for (const file of files) {
      if (file.trackCourse !== trackCourse) continue;
      for (const session of file.sessions) {
        for (const driver of session.drivers) {
          if (!nameSet.has(driver.name) || driver.carType !== carType) continue;
          for (const lap of driver.laps) updateSectorMins(entry, lap);
        }
      }
    }
    mins = entry;
  }

  const total = mins.s1 !== null && mins.s2 !== null && mins.s3 !== null
    ? mins.s1 + mins.s2 + mins.s3 : null;

  return { s1: mins.s1, s2: mins.s2, s3: mins.s3, total };
}

export interface TrackStats {
  trackVenue: string;
  trackCourse: string;
  sessionCount: number;
  totalLaps: number;
  bestLapTime: number | null;
  bestS1: number | null;
  bestS2: number | null;
  bestS3: number | null;
  bestCar: string;
  bestCarClass: CarClass;
  classes: Set<CarClass>;
}

export function getTrackStats(files: RaceFile[], driverNames: string | string[]): TrackStats[] {
  const nameSet = toNameSet(driverNames);
  const map = new Map<string, TrackStats>();
  const seenSessions = new Set<string>();

  for (const { file, session, driver } of forEachDriverSession(files, nameSet)) {
    let existing = map.get(file.trackCourse);
    if (!existing) {
      existing = {
        trackVenue: file.trackVenue,
        trackCourse: file.trackCourse,
        sessionCount: 0,
        totalLaps: 0,
        bestLapTime: null,
        bestS1: null,
        bestS2: null,
        bestS3: null,
        bestCar: '',
        bestCarClass: driver.carClass,
        classes: new Set(),
      };
      map.set(file.trackCourse, existing);
    }

    const sessionKey = `${file.fileName}|${session.sessionIndex}`;
    if (!seenSessions.has(sessionKey)) {
      seenSessions.add(sessionKey);
      existing.sessionCount++;
    }
    existing.totalLaps += driver.totalLaps;
    existing.classes.add(driver.carClass);

    for (const lap of driver.laps) {
      if (!isValidLap(lap)) continue;
      if (!existing.bestLapTime || lap.lapTime < existing.bestLapTime) {
        existing.bestLapTime = lap.lapTime;
        existing.bestS1 = lap.sector1;
        existing.bestS2 = lap.sector2;
        existing.bestS3 = lap.sector3;
        existing.bestCar = driver.carType;
        existing.bestCarClass = driver.carClass;
      }
    }
  }

  return Array.from(map.values()).sort((a, b) => b.sessionCount - a.sessionCount);
}

export interface CarStats {
  carType: string;
  carClass: CarClass;
  sessionCount: number;
  totalLaps: number;
  totalDistanceKm: number;
  tracks: Set<string>;
}

export function getCarStats(files: RaceFile[], driverNames: string | string[]): CarStats[] {
  const nameSet = toNameSet(driverNames);
  const map = new Map<string, CarStats>();
  const seenSessions = new Map<string, Set<string>>();

  for (const { file, session, driver } of forEachDriverSession(files, nameSet)) {
    const sessionKey = `${file.fileName}|${session.sessionIndex}`;
    const existing = map.get(driver.carType);
    if (existing) {
      const seen = seenSessions.get(driver.carType)!;
      if (!seen.has(sessionKey)) {
        seen.add(sessionKey);
        existing.sessionCount++;
      }
      existing.totalLaps += driver.totalLaps;
      existing.totalDistanceKm += (driver.totalLaps * file.trackLength) / 1000;
      existing.tracks.add(file.trackCourse);
    } else {
      seenSessions.set(driver.carType, new Set([sessionKey]));
      map.set(driver.carType, {
        carType: driver.carType,
        carClass: driver.carClass,
        sessionCount: 1,
        totalLaps: driver.totalLaps,
        totalDistanceKm: (driver.totalLaps * file.trackLength) / 1000,
        tracks: new Set([file.trackCourse]),
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.sessionCount - a.sessionCount);
}

export interface OverviewStats {
  totalSessions: number;
  totalLaps: number;
  totalRaces: number;
  totalRaceLaps: number;
  totalPractice: number;
  totalQualifying: number;
  tracksVisited: number;
  carsUsed: number;
  bestOverallLap: PersonalBest | null;
  totalIncidents: number;
  totalPenalties: number;
  totalTrackLimits: number;
  penaltyTypes: Map<string, number>;
  avgLapTime: number | null;
  totalDistanceKm: number;
}

export function getOverviewStats(files: RaceFile[], driverNames: string | string[]): OverviewStats {
  const nameSet = toNameSet(driverNames);
  const names = [...nameSet]; // hoisted — avoids re-spreading the set per incident
  let totalSessions = 0;
  let totalLaps = 0;
  let totalRaces = 0;
  let totalRaceLaps = 0;
  let totalPractice = 0;
  let totalQualifying = 0;
  let totalIncidents = 0;
  let totalPenalties = 0;
  let totalTrackLimits = 0;
  const penaltyTypes = new Map<string, number>();
  let totalDistanceKm = 0;
  let lapTimeSum = 0;
  let lapTimeCount = 0;
  const tracks = new Set<string>();
  const cars = new Set<string>();
  let bestLap: PersonalBest | null = null;

  const seenSessions = new Set<string>();

  for (const { file, session, driver } of forEachDriverSession(files, nameSet)) {
    const sessionKey = `${file.fileName}|${session.sessionIndex}`;
    const isNewSession = !seenSessions.has(sessionKey);
    if (isNewSession) seenSessions.add(sessionKey);

    if (isNewSession) totalSessions++;
    totalLaps += driver.totalLaps;
    totalDistanceKm += (driver.totalLaps * file.trackLength) / 1000;
    tracks.add(file.trackCourse);
    cars.add(driver.carType);

    if (session.type === 'Race') {
      if (isNewSession) totalRaces++;
      totalRaceLaps += driver.totalLaps;
    } else if (isNewSession && session.type === 'Practice') totalPractice++;
    else if (isNewSession && session.type === 'Qualifying') totalQualifying++;

    totalIncidents += session.incidents.filter(
      i => nameSet.has(i.driver1) || names.some(n => i.description.includes(n))
    ).length;
    const driverPenalties = session.penalties.filter(p => nameSet.has(p.driver));
    totalPenalties += driverPenalties.length;
    for (const pen of driverPenalties) {
      const t = pen.type || 'Unknown';
      penaltyTypes.set(t, (penaltyTypes.get(t) ?? 0) + 1);
    }
    totalTrackLimits += session.trackLimits.filter(tl => nameSet.has(tl.driver)).length;

    for (const lap of driver.laps) {
      if (isValidLap(lap)) {
        lapTimeSum += lap.lapTime;
        lapTimeCount++;
        if (!bestLap || lap.lapTime < bestLap.lapTime) {
          bestLap = toLapRecord(file, session, driver, lap);
        }
      }
    }
  }

  return {
    totalSessions,
    totalLaps,
    totalRaces,
    totalRaceLaps,
    totalPractice,
    totalQualifying,
    tracksVisited: tracks.size,
    carsUsed: cars.size,
    bestOverallLap: bestLap,
    totalIncidents,
    totalPenalties,
    totalTrackLimits,
    penaltyTypes,
    avgLapTime: lapTimeCount > 0 ? lapTimeSum / lapTimeCount : null,
    totalDistanceKm,
  };
}

export interface RaceResult {
  file: RaceFile;
  session: SessionData;
  driver: DriverResult;
  position: number;
  classPosition: number;
  totalDrivers: number;
  classDrivers: number;
}

export function getRaceResults(files: RaceFile[], driverNames: string | string[]): RaceResult[] {
  const nameSet = toNameSet(driverNames);
  const results: RaceResult[] = [];

  for (const { file, session, driver } of forEachDriverSession(files, nameSet)) {
    if (session.type !== 'Race') continue;

    const classDrivers = session.drivers.filter(d => d.carClass === driver.carClass);

    results.push({
      file,
      session,
      driver,
      position: driver.position,
      classPosition: driver.classPosition,
      totalDrivers: session.drivers.length,
      classDrivers: classDrivers.length,
    });
  }

  return results.sort((a, b) => b.file.timeString.localeCompare(a.file.timeString));
}

export interface TrackBest {
  trackVenue: string;
  trackCourse: string;
  totalLaps: number;
  bestLapTime: number;
  bestS1: number | null;
  bestS2: number | null;
  bestS3: number | null;
  bestCar: string;
  bestCarClass: CarClass;
  theoreticalBest: number | null;
  theoS1: number | null;
  theoS2: number | null;
  theoS3: number | null;
}

interface RaceStats {
  races: number;
  wins: number;
  podiums: number;
  classWins: number;
  classPodiums: number;
  dnfs: number;
  fastestLaps: number;
  poles: number;
}

function emptyRaceStats(): RaceStats {
  return { races: 0, wins: 0, podiums: 0, classWins: 0, classPodiums: 0, dnfs: 0, fastestLaps: 0, poles: 0 };
}

function accumulateRaceStats(stats: RaceStats, driver: DriverResult, dnf: boolean, hasFastestLap: boolean, hasPole: boolean) {
  stats.races++;
  if (driver.position === 1) stats.wins++;
  if (driver.position <= 3) stats.podiums++;
  if (driver.classPosition === 1) stats.classWins++;
  if (driver.classPosition <= 3) stats.classPodiums++;
  if (dnf) stats.dnfs++;
  if (hasFastestLap) stats.fastestLaps++;
  if (hasPole) stats.poles++;
}

export interface DriverProfileStats {
  driverName: string;
  total: RaceStats;
  online: RaceStats;
  rated: RaceStats;
  totalLaps: number;
  totalDistanceKm: number;
  totalSessions: number;
  tracksVisited: number;
  carsUsed: number;
  trackBests: TrackBest[];
}

export function getDriverProfileStats(files: RaceFile[], driverNames: string | string[]): DriverProfileStats {
  const nameSet = toNameSet(driverNames);

  const total = emptyRaceStats();
  const online = emptyRaceStats();
  const rated = emptyRaceStats();
  let totalLaps = 0;
  let totalDistanceKm = 0;
  let totalSessions = 0;
  const tracks = new Set<string>();
  const cars = new Set<string>();

  const trackBestMap = new Map<string, { lapTime: number; s1: number | null; s2: number | null; s3: number | null; car: string; carClass: CarClass }>();
  const trackLapsMap = new Map<string, number>();
  const trackVenueMap = new Map<string, string>();
  // Best sector times per `${trackCourse}|${carType}` — only the minimums are ever consumed
  const trackCarSectorMins = new Map<string, SectorMins>();

  for (const file of files) {
    if (!trackVenueMap.has(file.trackCourse)) {
      trackVenueMap.set(file.trackCourse, file.trackVenue);
    }
    for (const session of file.sessions) {
      let sessionCounted = false;
      for (const driver of session.drivers) {
        if (!nameSet.has(driver.name)) continue;

        if (!sessionCounted) {
          sessionCounted = true;
          totalSessions++;
        }
        totalLaps += driver.totalLaps;
        totalDistanceKm += (driver.totalLaps * file.trackLength) / 1000;
        tracks.add(file.trackCourse);
        cars.add(driver.carType);
        trackLapsMap.set(file.trackCourse, (trackLapsMap.get(file.trackCourse) ?? 0) + driver.totalLaps);

        if (session.type === 'Race') {
          const onlineRace = isOnline(file);
          const dnf = isDnf(driver.finishStatus);

          // Fastest lap: check if this driver had the best lap in their class
          const classDrivers = session.drivers.filter(d => d.carClass === driver.carClass);
          let classBestLap = Infinity;
          for (const d of classDrivers) {
            if (d.bestLapTime !== null && d.bestLapTime > 0 && d.bestLapTime < classBestLap) {
              classBestLap = d.bestLapTime;
            }
          }
          const hasFastestLap = driver.bestLapTime !== null && driver.bestLapTime > 0
            && Math.abs(driver.bestLapTime - classBestLap) < 0.001;

          const hasPole = driver.classGridPosition === 1;

          accumulateRaceStats(total, driver, dnf, hasFastestLap, hasPole);
          if (onlineRace) accumulateRaceStats(online, driver, dnf, hasFastestLap, hasPole);
          if (isRatedRace(file)) accumulateRaceStats(rated, driver, dnf, hasFastestLap, hasPole);
        }

        // Collect sector minimums for theoretical best (grouped by track+car)
        const sectorKey = `${file.trackCourse}|${driver.carType}`;
        let sectorEntry = trackCarSectorMins.get(sectorKey);
        if (!sectorEntry) { sectorEntry = { s1: null, s2: null, s3: null }; trackCarSectorMins.set(sectorKey, sectorEntry); }
        for (const lap of driver.laps) updateSectorMins(sectorEntry, lap);

        for (const lap of driver.laps) {
          if (!isValidLap(lap)) continue;
          const existing = trackBestMap.get(file.trackCourse);
          if (!existing || lap.lapTime < existing.lapTime) {
            trackBestMap.set(file.trackCourse, {
              lapTime: lap.lapTime,
              s1: lap.sector1,
              s2: lap.sector2,
              s3: lap.sector3,
              car: driver.carType,
              carClass: driver.carClass,
            });
          }
        }
      }
    }
  }

  // Build theoretical bests from collected sector data
  const trackBests = buildTrackBests(trackBestMap, trackCarSectorMins, trackLapsMap, trackVenueMap);

  return {
    driverName: [...nameSet].join(', '),
    total,
    online,
    rated,
    totalLaps,
    totalDistanceKm,
    totalSessions,
    tracksVisited: tracks.size,
    carsUsed: cars.size,
    trackBests,
  };
}

function buildTrackBests(
  trackBestMap: Map<string, { lapTime: number; s1: number | null; s2: number | null; s3: number | null; car: string; carClass: CarClass }>,
  trackCarSectorMins: Map<string, SectorMins>,
  trackLapsMap: Map<string, number>,
  trackVenueMap: Map<string, string>,
): TrackBest[] {
  const trackBests: TrackBest[] = [];
  for (const [trackCourse, best] of trackBestMap) {
    // Theoretical best uses the sector minimums of the car that set the fastest lap
    const theo = trackCarSectorMins.get(`${trackCourse}|${best.car}`);
    const theoTotal = theo?.s1 != null && theo?.s2 != null && theo?.s3 != null
      ? theo.s1 + theo.s2 + theo.s3 : null;
    trackBests.push({
      trackVenue: trackVenueMap.get(trackCourse) ?? trackCourse,
      trackCourse,
      totalLaps: trackLapsMap.get(trackCourse) ?? 0,
      bestLapTime: best.lapTime,
      bestS1: best.s1,
      bestS2: best.s2,
      bestS3: best.s3,
      bestCar: best.car,
      bestCarClass: best.carClass,
      theoreticalBest: theoTotal,
      theoS1: theo?.s1 ?? null,
      theoS2: theo?.s2 ?? null,
      theoS3: theo?.s3 ?? null,
    });
  }
  trackBests.sort((a, b) => a.trackCourse.localeCompare(b.trackCourse));
  return trackBests;
}

// ---------------------------------------------------------------------------
// Safety, Collision & Rating Analytics (SR & RR)
// ---------------------------------------------------------------------------

export function extractOpponentName(incident: { driver1: string; description: string }, nameSet: Set<string>): string | null {
  const text = incident.description || '';
  if (!text.includes('with another vehicle')) return null;

  const d1 = incident.driver1 || text.split('(')[0].trim();
  if (nameSet.has(d1) || [...nameSet].some(n => text.startsWith(n))) {
    const oppPart = text.split('with another vehicle')[1]?.trim();
    return oppPart?.replace(/\(\d+\)$/, '').trim() || null;
  }

  const firstPart = text.split('reported contact')[0]?.trim();
  return firstPart?.replace(/\(\d+\)$/, '').trim() || null;
}

export function computeSRImpact(
  totalIncidents: number,
  vehicleContacts: number,
  wallContacts: number,
  penaltiesCount: number,
  lapsCompleted: number,
  isDnf: boolean,
  totalSeverity: number
): { srImpact: number; srGrade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F' } {
  if (lapsCompleted === 0 && !isDnf) {
    return { srImpact: 0, srGrade: 'C' };
  }

  // Base gain for clean laps completed
  const cleanLapBonus = Math.min(0.22, lapsCompleted * 0.015);

  // Incident deductions
  const vehiclePenalty = vehicleContacts * 0.035;
  const wallPenalty = wallContacts * 0.02;
  const otherPenalty = Math.max(0, totalIncidents - vehicleContacts - wallContacts) * 0.015;
  const penaltyDeduction = penaltiesCount * 0.06;
  const severityDeduction = Math.min(0.15, (totalSeverity / 10000) * 0.03);
  const dnfDeduction = isDnf ? 0.12 : 0;

  const rawDelta = cleanLapBonus - (vehiclePenalty + wallPenalty + otherPenalty + penaltyDeduction + severityDeduction + dnfDeduction);
  const srImpact = Number(Math.max(-0.50, Math.min(0.30, rawDelta)).toFixed(2));

  let srGrade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  if (totalIncidents === 0 && penaltiesCount === 0 && !isDnf && lapsCompleted > 0) {
    srGrade = 'A+';
  } else if (srImpact >= 0.08) {
    srGrade = 'A';
  } else if (srImpact >= 0.00) {
    srGrade = 'B';
  } else if (srImpact >= -0.15) {
    srGrade = 'C';
  } else if (srImpact >= -0.30) {
    srGrade = 'D';
  } else {
    srGrade = 'F';
  }

  return { srImpact, srGrade };
}

export function computeRRDelta(
  classPosition: number,
  classDrivers: number,
  classGridPosition: number | null,
  isDnf: boolean
): number {
  if (classDrivers <= 1) return isDnf ? -20 : 15;

  const percentile = (classDrivers - classPosition) / (classDrivers - 1);
  let delta = (percentile - 0.5) * 70;

  if (classPosition === 1) delta += 25;
  else if (classPosition === 2) delta += 15;
  else if (classPosition === 3) delta += 10;
  else if (classPosition <= 5 && classDrivers >= 8) delta += 5;

  if (classGridPosition !== null && classGridPosition > 0) {
    const gain = classGridPosition - classPosition;
    delta += Math.max(-15, Math.min(15, gain * 2.5));
  }

  if (isDnf) delta -= 30;

  const fieldScale = Math.min(1.25, Math.max(0.75, classDrivers / 10));
  return Math.round(delta * fieldScale);
}

export function getSafetyAndRatingStats(
  files: RaceFile[],
  driverNames: string | string[]
): SafetySummaryStats & { raceDetails: RaceCollisionDetail[] } {
  const nameSet = toNameSet(driverNames);
  const raceDetails: RaceCollisionDetail[] = [];

  let totalRaces = 0;
  let cleanRaces = 0;
  let totalIncidentsSum = 0;
  let totalVehiclesSum = 0;
  let totalWallsSum = 0;
  let totalSeveritySum = 0;
  let totalPenaltiesSum = 0;
  let totalTrackLimitsSum = 0;
  let totalLapsSum = 0;

  const opponentMap = new Map<string, { count: number; severity: number; raceSet: Set<string> }>();
  const trackMap = new Map<string, { trackVenue: string; racesCount: number; incidents: number; vehicle: number; wall: number; severity: number }>();

  for (const { file, session, driver } of forEachDriverSession(files, nameSet)) {
    if (session.type !== 'Race') continue;

    totalRaces++;
    totalLapsSum += driver.totalLaps;

    // Filter incidents for this driver
    const driverIncidents = session.incidents.filter(i => isDriverIncident(i, driver.name));
    const driverPenalties = session.penalties.filter(p => p.driver === driver.name);
    const driverTL = session.trackLimits.filter(tl => tl.driver === driver.name);

    let vehicleContacts = 0;
    let wallContacts = 0;
    let otherContacts = 0;
    let raceSeverity = 0;
    const raceOpponentsMap = new Map<string, { count: number; severity: number }>();

    for (const inc of driverIncidents) {
      raceSeverity += inc.severity;
      const text = inc.description.toLowerCase();

      if (text.includes('with another vehicle')) {
        vehicleContacts++;
        const oppName = extractOpponentName(inc, nameSet);
        if (oppName) {
          const prevOpp = raceOpponentsMap.get(oppName) ?? { count: 0, severity: 0 };
          prevOpp.count++;
          prevOpp.severity += inc.severity;
          raceOpponentsMap.set(oppName, prevOpp);

          const globalOpp = opponentMap.get(oppName) ?? { count: 0, severity: 0, raceSet: new Set<string>() };
          globalOpp.count++;
          globalOpp.severity += inc.severity;
          globalOpp.raceSet.add(file.fileName);
          opponentMap.set(oppName, globalOpp);
        }
      } else if (text.includes('immovable') || text.includes('wall') || text.includes('post') || text.includes('guardrail') || text.includes('fence') || text.includes('tire') || text.includes('barrier')) {
        wallContacts++;
      } else {
        otherContacts++;
      }
    }

    const dnf = isDnf(driver.finishStatus);
    const classDrivers = session.drivers.filter(d => d.carClass === driver.carClass).length;
    const { srImpact, srGrade } = computeSRImpact(
      driverIncidents.length,
      vehicleContacts,
      wallContacts,
      driverPenalties.length,
      driver.totalLaps,
      dnf,
      raceSeverity
    );

    const rrDelta = computeRRDelta(
      driver.classPosition,
      classDrivers,
      driver.classGridPosition,
      dnf
    );

    const positionGain = driver.classGridPosition !== null ? driver.classGridPosition - driver.classPosition : null;

    if (driverIncidents.length === 0 && driverPenalties.length === 0 && !dnf && driver.totalLaps > 0) {
      cleanRaces++;
    }

    totalIncidentsSum += driverIncidents.length;
    totalVehiclesSum += vehicleContacts;
    totalWallsSum += wallContacts;
    totalSeveritySum += raceSeverity;
    totalPenaltiesSum += driverPenalties.length;
    totalTrackLimitsSum += driverTL.length;

    // Track safety aggregation
    const trackEntry = trackMap.get(file.trackCourse) ?? {
      trackVenue: file.trackVenue,
      racesCount: 0,
      incidents: 0,
      vehicle: 0,
      wall: 0,
      severity: 0,
    };
    trackEntry.racesCount++;
    trackEntry.incidents += driverIncidents.length;
    trackEntry.vehicle += vehicleContacts;
    trackEntry.wall += wallContacts;
    trackEntry.severity += raceSeverity;
    trackMap.set(file.trackCourse, trackEntry);

    const raceOpponentsList = Array.from(raceOpponentsMap.entries()).map(([name, val]) => ({
      name,
      count: val.count,
      severity: Math.round(val.severity),
    }));

    raceDetails.push({
      file,
      session,
      driver,
      vehicleContacts,
      wallContacts,
      otherContacts,
      totalIncidents: driverIncidents.length,
      totalSeverity: Math.round(raceSeverity),
      penaltiesCount: driverPenalties.length,
      trackLimitsCount: driverTL.length,
      opponents: raceOpponentsList,
      incidentsPerLap: driver.totalLaps > 0 ? Number((driverIncidents.length / driver.totalLaps).toFixed(2)) : driverIncidents.length,
      srImpact,
      srGrade,
      rrDelta,
      isOnline: isOnline(file),
      isRated: isRatedRace(file),
      position: driver.position,
      classPosition: driver.classPosition,
      gridPosition: driver.gridPosition,
      classGridPosition: driver.classGridPosition,
      positionGain,
      totalDrivers: session.drivers.length,
      classDrivers,
      lapsCompleted: driver.totalLaps,
      finishStatus: driver.finishStatus,
      isDnf: dnf,
      jokerImpact: computeRaceJokerImpact({
        rrDelta,
        srImpact,
        isDnf: dnf,
        lapsCompleted: driver.totalLaps,
        position: driver.position,
        classPosition: driver.classPosition,
        gridPosition: driver.gridPosition,
        classGridPosition: driver.classGridPosition,
        penaltiesCount: driverPenalties.length,
        totalSeverity: raceSeverity,
        vehicleContacts,
        isOnline: isOnline(file),
        isRated: isRatedRace(file),
      }),
    });
  }

  // Sort races by date descending
  raceDetails.sort((a, b) => b.file.timeString.localeCompare(a.file.timeString));

  // Find extremes
  const mostChaoticRace = raceDetails.length > 0
    ? [...raceDetails].sort((a, b) => b.totalIncidents - a.totalIncidents || b.totalSeverity - a.totalSeverity)[0]
    : null;

  const cleanestRace = raceDetails.length > 0
    ? [...raceDetails].sort((a, b) => a.totalIncidents - b.totalIncidents || b.lapsCompleted - a.lapsCompleted)[0]
    : null;

  const highestRRGainRace = raceDetails.length > 0
    ? [...raceDetails].sort((a, b) => b.rrDelta - a.rrDelta)[0]
    : null;

  // Rivalries list
  const rivalries: CollisionOpponent[] = Array.from(opponentMap.entries())
    .map(([opponent, val]) => ({
      opponent,
      count: val.count,
      severity: Math.round(val.severity),
      racesCount: val.raceSet.size,
    }))
    .sort((a, b) => b.count - a.count || b.severity - a.severity);

  // Track safety list
  const trackSafetyStats: TrackSafetyStat[] = Array.from(trackMap.entries())
    .map(([trackCourse, val]) => ({
      trackCourse,
      trackVenue: val.trackVenue,
      racesCount: val.racesCount,
      totalIncidents: val.incidents,
      vehicleContacts: val.vehicle,
      wallContacts: val.wall,
      avgIncidentsPerRace: Number((val.incidents / val.racesCount).toFixed(1)),
      totalSeverity: Math.round(val.severity),
    }))
    .sort((a, b) => b.avgIncidentsPerRace - a.avgIncidentsPerRace || b.totalIncidents - a.totalIncidents);

  const estimatedNetSR = Number(raceDetails.reduce((sum, r) => sum + r.srImpact, 0).toFixed(2));
  const estimatedNetRR = raceDetails.reduce((sum, r) => sum + r.rrDelta, 0);

  return {
    totalRaces,
    cleanRaces,
    cleanRacePct: totalRaces > 0 ? Math.round((cleanRaces / totalRaces) * 100) : 0,
    totalIncidents: totalIncidentsSum,
    totalVehicleContacts: totalVehiclesSum,
    totalWallContacts: totalWallsSum,
    totalSeverity: Math.round(totalSeveritySum),
    totalPenalties: totalPenaltiesSum,
    totalTrackLimits: totalTrackLimitsSum,
    avgIncidentsPerRace: totalRaces > 0 ? Number((totalIncidentsSum / totalRaces).toFixed(1)) : 0,
    avgIncidentsPerLap: totalLapsSum > 0 ? Number((totalIncidentsSum / totalLapsSum).toFixed(2)) : 0,
    totalLaps: totalLapsSum,
    estimatedNetSR,
    estimatedNetRR,
    mostChaoticRace,
    cleanestRace,
    highestRRGainRace,
    rivalries,
    trackSafetyStats,
    raceDetails,
  };
}

