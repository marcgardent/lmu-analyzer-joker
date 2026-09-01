import type {
  RaceJokerTier,
  RaceJokerEvaluation,
  JokerProgression,
  JokerStrategy,
} from './types';
import { loadConsumedJokers, saveConsumedJokers } from './storage';

export { loadConsumedJokers, saveConsumedJokers };

/**
 * Builds a consistent unique identifier key for a race session row
 */
export function getRaceKey(fileName: string, sessionIndex: number, driverName: string): string {
  return `${fileName}::${sessionIndex}::${driverName}`;
}

export interface JokerImpactParams {
  rrDelta: number;
  srImpact: number;
  isDnf: boolean;
  lapsCompleted: number;
  position: number;
  classPosition: number;
  gridPosition?: number | null;
  classGridPosition?: number | null;
  penaltiesCount?: number;
  totalSeverity?: number;
  vehicleContacts?: number;
  isOnline?: boolean;
  isRated?: boolean;
}

/**
 * Computes the "Race Joker Impact" (0-100 score & evaluation) based on
 * normalized Rank Rating (RR) and Safety Rating (SR) losses under a chosen strategy:
 * - 'rr_first': 85% RR Loss + 15% SR Loss (protects Elo rating & leaderboard standing)
 * - 'sr_first': 85% SR Loss + 15% RR Loss (protects safety license & prevents demotion)
 * - 'balanced': 50% RR Loss + 50% SR Loss (balanced protection across both metrics)
 */
export function computeRaceJokerImpact(
  params: JokerImpactParams,
  strategy: JokerStrategy = 'rr_first'
): RaceJokerEvaluation {
  const {
    rrDelta,
    srImpact,
    isDnf,
    lapsCompleted,
    classPosition,
    classGridPosition,
  } = params;

  const rrLoss = rrDelta < 0 ? Math.abs(rrDelta) : 0;
  const srLoss = srImpact < 0 ? Math.abs(srImpact) : 0;

  // Normalized component scores (0 to 100):
  // -100 RR is severe rating loss -> 100 pts (linear scaling up to 100 RR)
  // -0.50 SR is severe safety loss -> 100 pts (linear scaling up to 0.50 SR)
  const rrScore = Math.min(100, Math.round((rrLoss / 100) * 100));
  const srScore = Math.min(100, Math.round((srLoss / 0.50) * 100));

  let rawScore = 0;
  if (strategy === 'rr_first') {
    // Pure RR prioritization score
    rawScore = rrScore;
  } else if (strategy === 'sr_first') {
    // Pure SR prioritization score
    rawScore = srScore;
  } else {
    // Balanced 50/50 composite score
    rawScore = 0.50 * rrScore + 0.50 * srScore;
  }

  const score = Math.min(100, Math.max(0, Math.round(rawScore)));

  // Tier classification
  let tier: RaceJokerTier = 'none';
  let tierLabel = 'No Impact';
  let recommendation = '';

  if (score >= 80) {
    tier = 'critical';
    tierLabel = 'Prime Target';
    recommendation = `🚨 TOP PRIORITY: Burning a Joker here recovers ${rrLoss} RR and ${srLoss.toFixed(2)} SR.`;
  } else if (score >= 50) {
    tier = 'high';
    tierLabel = 'High Impact';
    recommendation = `⚡ RECOMMENDED: High-value Joker candidate recovering ${rrLoss} RR and ${srLoss.toFixed(2)} SR.`;
  } else if (score >= 25) {
    tier = 'moderate';
    tierLabel = 'Moderate';
    recommendation = '⚠️ SITUATIONAL: Worth considering if you have surplus Jokers.';
  } else if (score >= 10) {
    tier = 'low';
    tierLabel = 'Low Impact';
    recommendation = 'ℹ️ LOW VALUE: Minor rating loss; save your Jokers for worse disaster races.';
  } else {
    tier = 'none';
    tierLabel = 'No Impact';
    recommendation = '⛔ DO NOT USE: Race was positive or neutral; burning a Joker would be wasted.';
  }

  const reasons: string[] = [];
  if (strategy === 'rr_first') {
    if (rrLoss > 0) reasons.push(`-${rrLoss} RR points lost`);
    if (srLoss > 0) reasons.push(`-${srLoss.toFixed(2)} SR penalty`);
  } else if (strategy === 'sr_first') {
    if (srLoss > 0) reasons.push(`-${srLoss.toFixed(2)} SR penalty`);
    if (rrLoss > 0) reasons.push(`-${rrLoss} RR points lost`);
  } else {
    if (rrLoss > 0) reasons.push(`-${rrLoss} RR`);
    if (srLoss > 0) reasons.push(`-${srLoss.toFixed(2)} SR`);
  }

  if (isDnf) {
    reasons.push(lapsCompleted <= 2 ? 'Early DNF' : 'DNF');
  }

  let positionDrop = 0;
  if (typeof classGridPosition === 'number' && classGridPosition > 0) {
    positionDrop = Math.max(0, classPosition - classGridPosition);
  }

  return {
    score,
    tier,
    tierLabel,
    recommendation,
    rrPointsProtected: rrLoss,
    srProtected: Number(srLoss.toFixed(2)),
    dnfProtected: isDnf,
    positionDrop,
    reasons,
    rrScore,
    srScore,
    strategy,
  };
}

/**
 * Calculates Joker earning progression based on official LMU V1.4 Community Update rules:
 * - 1st Joker: Earned at 10 races
 * - 2nd Joker: Earned at 30 races (+20 races)
 * - 3rd Joker: Earned at 60 races (+30 races)
 * - Maximum capacity: 3 Jokers
 */
export function getJokerProgression(totalRaces: number, consumedCount: number = 0): JokerProgression {
  const maxJokers = 3;
  let jokersEarned = 0;
  let racesToNextJoker = 0;
  let nextThreshold = 10;
  let progressPct = 0;

  if (totalRaces < 10) {
    jokersEarned = 0;
    nextThreshold = 10;
    racesToNextJoker = 10 - totalRaces;
    progressPct = Math.round((totalRaces / 10) * 100);
  } else if (totalRaces < 30) {
    jokersEarned = 1;
    nextThreshold = 30;
    racesToNextJoker = 30 - totalRaces;
    progressPct = Math.round(((totalRaces - 10) / 20) * 100);
  } else if (totalRaces < 60) {
    jokersEarned = 2;
    nextThreshold = 60;
    racesToNextJoker = 60 - totalRaces;
    progressPct = Math.round(((totalRaces - 30) / 30) * 100);
  } else {
    jokersEarned = 3;
    nextThreshold = 60;
    racesToNextJoker = 0;
    progressPct = 100;
  }

  const jokersConsumed = Math.max(0, consumedCount);
  const jokersAvailable = Math.max(0, jokersEarned - jokersConsumed);

  return {
    totalRaces,
    jokersEarned,
    jokersConsumed,
    jokersAvailable,
    maxJokers,
    racesToNextJoker,
    nextThreshold,
    progressPct: Math.min(100, Math.max(0, progressPct)),
  };
}

/**
 * Returns candidate race keys sorted by highest recovery value (Score >= 50)
 */
export function getOptimalJokerCandidates<T extends { raceKey: string; jokerImpact?: RaceJokerEvaluation }>(
  races: T[],
  limit: number = 3
): T[] {
  return [...races]
    .filter(r => (r.jokerImpact?.score ?? 0) >= 40)
    .sort((a, b) => (b.jokerImpact?.score ?? 0) - (a.jokerImpact?.score ?? 0))
    .slice(0, limit);
}

/**
 * Returns styling classes for each Joker tier badge
 */
export function getJokerTierClasses(tier: RaceJokerTier): {
  badge: string;
  glow: string;
  accent: string;
  pill: string;
} {
  switch (tier) {
    case 'critical':
      return {
        badge: 'bg-red-500/20 text-red-400 border-red-500/40 shadow-red-500/20',
        glow: 'shadow-[0_0_12px_rgba(239,68,68,0.35)]',
        accent: 'text-red-400',
        pill: 'bg-red-500 text-white',
      };
    case 'high':
      return {
        badge: 'bg-racing-orange/20 text-racing-orange border-racing-orange/40 shadow-racing-orange/20',
        glow: 'shadow-[0_0_10px_rgba(255,109,0,0.25)]',
        accent: 'text-racing-orange',
        pill: 'bg-racing-orange text-white',
      };
    case 'moderate':
      return {
        badge: 'bg-racing-yellow/20 text-racing-yellow border-racing-yellow/40',
        glow: '',
        accent: 'text-racing-yellow',
        pill: 'bg-racing-yellow text-racing-black',
      };
    case 'low':
      return {
        badge: 'bg-racing-blue/15 text-racing-blue border-racing-blue/30',
        glow: '',
        accent: 'text-racing-blue',
        pill: 'bg-racing-blue text-white',
      };
    case 'none':
    default:
      return {
        badge: 'bg-racing-muted/10 text-racing-muted/60 border-racing-muted/20',
        glow: '',
        accent: 'text-racing-muted',
        pill: 'bg-racing-muted/30 text-racing-muted',
      };
  }
}

