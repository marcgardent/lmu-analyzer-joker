export type SessionType = 'Practice' | 'Qualifying' | 'Race' | 'Warmup';
export type CarClass = 'Hyper' | 'LMP2-WEC' | 'LMP2-ELMS' | 'GT3' | 'GTE' | 'LMP3' | 'Unknown';

export interface LapData {
  num: number;
  position: number;
  elapsedTime: number;
  sector1: number | null;
  sector2: number | null;
  sector3: number | null;
  lapTime: number | null;
  topSpeed: number;
  fuel: number;
  fuelUsed: number;
  vehicleEnergy: number;
  vehicleEnergyUsed: number;
  tireWear: { fl: number; fr: number; rl: number; rr: number };
  frontCompound: string;
  rearCompound: string;
  isPit: boolean;
}

export interface DriverResult {
  name: string;
  vehicleFile: string;
  vehicleName: string;
  category: string;
  carType: string;
  carClass: CarClass;
  carNumber: string;
  teamName: string;
  isPlayer: boolean;
  gridPosition: number | null;
  position: number;
  classGridPosition: number | null;
  classPosition: number;
  bestLapTime: number | null;
  finishTime: number | null;
  totalLaps: number;
  pitstops: number;
  finishStatus: string;
  controlAndAids: string;
  laps: LapData[];
}

export interface SessionData {
  type: SessionType;
  sourceTag: string;
  sessionIndex: number;
  dateTime: string;
  lapsLimit: number;
  minutesLimit: number;
  mostLapsCompleted: number;
  drivers: DriverResult[];
  incidents: IncidentData[];
  penalties: PenaltyData[];
  trackLimits: TrackLimitData[];
}

export interface IncidentData {
  time: number;
  description: string;
  driver1: string;
  driver2: string | null;
  severity: number;
}

export interface PenaltyData {
  time: number;
  driver: string;
  type: string;
  reason: string;
  description: string;
}

export interface TrackLimitData {
  time: number;
  driver: string;
  lap: number;
  warningPoints: number;
  currentPoints: number;
  resolution: string;
}

export interface RaceFile {
  fileName: string;
  setting: string;
  serverName: string;
  dateTime: string;
  timeString: string;
  trackVenue: string;
  trackCourse: string;
  trackEvent: string;
  trackLength: number;
  gameVersion: string;
  raceLaps: number;
  raceTime: number;
  mechFailRate: number;
  damageMult: number;
  fuelMult: number;
  tireMult: number;
  freeSettings: number;
  vehiclesAllowed: string[];
  sessions: SessionData[];
}

export interface PersonalBest {
  lapTime: number;
  sector1: number | null;
  sector2: number | null;
  sector3: number | null;
  topSpeed: number;
  trackVenue: string;
  trackCourse: string;
  carType: string;
  carClass: CarClass;
  sessionType: SessionType;
  sessionIndex: number;
  date: string;
  fileName: string;
  lapNumber: number;
  driverName: string;
}

export interface DriverSummary {
  name: string;
  sessionCount: number;
  totalLaps: number;
  isPlayer: boolean;
}

export interface CollisionOpponent {
  opponent: string;
  count: number;
  severity: number;
  racesCount: number;
}

export interface TrackSafetyStat {
  trackCourse: string;
  trackVenue: string;
  racesCount: number;
  totalIncidents: number;
  vehicleContacts: number;
  wallContacts: number;
  avgIncidentsPerRace: number;
  totalSeverity: number;
}

export interface RaceCollisionDetail {
  file: RaceFile;
  session: SessionData;
  driver: DriverResult;
  vehicleContacts: number;
  wallContacts: number;
  otherContacts: number;
  totalIncidents: number;
  totalSeverity: number;
  penaltiesCount: number;
  trackLimitsCount: number;
  opponents: Array<{ name: string; count: number; severity: number }>;
  incidentsPerLap: number;
  srImpact: number;
  srGrade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
  rrDelta: number;
  isOnline: boolean;
  isRated: boolean;
  position: number;
  classPosition: number;
  gridPosition: number | null;
  classGridPosition: number | null;
  positionGain: number | null;
  totalDrivers: number;
  classDrivers: number;
  lapsCompleted: number;
  finishStatus: string;
  isDnf: boolean;
}

export interface SafetySummaryStats {
  totalRaces: number;
  cleanRaces: number;
  cleanRacePct: number;
  totalIncidents: number;
  totalVehicleContacts: number;
  totalWallContacts: number;
  totalSeverity: number;
  totalPenalties: number;
  totalTrackLimits: number;
  avgIncidentsPerRace: number;
  avgIncidentsPerLap: number;
  totalLaps: number;
  estimatedNetSR: number;
  estimatedNetRR: number;
  mostChaoticRace: RaceCollisionDetail | null;
  cleanestRace: RaceCollisionDetail | null;
  highestRRGainRace: RaceCollisionDetail | null;
  rivalries: CollisionOpponent[];
  trackSafetyStats: TrackSafetyStat[];
}

