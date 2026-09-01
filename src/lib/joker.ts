import type {
  RaceJokerTier,
  RaceJokerEvaluation,
  JokerProgression,
} from './types';

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
 * Computes the "Race Joker Impact" (0-100 score & evaluation) indicating
 * how beneficial consuming an Event Joker would be on this specific race.
 *
 * Factors evaluated:
 * 1. Rank Rating (RR) Points loss: Up to 45 pts
 * 2. DNF / Connection / Hardware failure: Up to 25 pts
 * 3. Safety Rating (SR) degradation & collision force: Up to 20 pts
 * 4. Grid-to-finish position collapse: Up to 10 pts
 */
export function computeRaceJokerImpact(params: JokerImpactParams): RaceJokerEvaluation {
  const {
    rrDelta,
    srImpact,
    isDnf,
    lapsCompleted,
    classPosition,
    classGridPosition,
    penaltiesCount = 0,
    totalSeverity = 0,
    vehicleContacts = 0,
  } = params;

  // 1. Rank Rating Loss (0 to 45 pts)
  let rrPointsProtected = 0;
  let rrLossPts = 0;
  if (rrDelta < 0) {
    rrPointsProtected = Math.abs(rrDelta);
    // Scales: -50 RR -> 45 pts; -25 RR -> 22.5 pts
    rrLossPts = Math.min(45, (rrPointsProtected / 50) * 45);
  }

  // 2. DNF / Disconnection / Hardware Failure (0 to 25 pts)
  let dnfPts = 0;
  if (isDnf) {
    dnfPts = 20;
    // Extra penalty protection if crashed/disconnected within first 2 laps
    if (lapsCompleted <= 2) {
      dnfPts += 5;
    }
  }

  // 3. Safety Rating & Incidents (0 to 20 pts)
  let srProtected = 0;
  let srLossPts = 0;
  if (srImpact < 0) {
    srProtected = Math.abs(Number(srImpact.toFixed(2)));
    // Scales: -0.40 SR -> 15 pts; -0.20 SR -> 7.5 pts
    srLossPts = Math.min(15, (srProtected / 0.40) * 15);
  }
  if (penaltiesCount > 0 || totalSeverity > 10000 || vehicleContacts >= 3) {
    srLossPts += 5;
  }
  srLossPts = Math.min(20, srLossPts);

  // 4. Position Drop / Grid Collapse (0 to 10 pts)
  let positionDrop = 0;
  let posPts = 0;
  if (typeof classGridPosition === 'number' && classGridPosition > 0) {
    positionDrop = Math.max(0, classPosition - classGridPosition);
    if (positionDrop > 0) {
      if (classGridPosition <= 3) {
        // Severe drop from podium start
        posPts = Math.min(10, positionDrop * 2.5);
      } else {
        posPts = Math.min(10, positionDrop * 1.5);
      }
    }
  }

  // Combined score (0 - 100)
  const rawScore = rrLossPts + dnfPts + srLossPts + posPts;
  const score = Math.min(100, Math.max(0, Math.round(rawScore)));

  // Tier classification
  let tier: RaceJokerTier = 'none';
  let tierLabel = 'No Impact';
  let recommendation = '';

  if (score >= 85) {
    tier = 'critical';
    tierLabel = 'Prime Target';
    recommendation = '🚨 TOP PRIORITY: Burning a Joker here recovers maximum ranking points and wipes out DNF penalty.';
  } else if (score >= 65) {
    tier = 'high';
    tierLabel = 'High Impact';
    recommendation = '⚡ RECOMMENDED: High-value Joker candidate to protect your ranking & safety trajectory.';
  } else if (score >= 40) {
    tier = 'moderate';
    tierLabel = 'Moderate';
    recommendation = '⚠️ SITUATIONAL: Worth considering if you have surplus Jokers or need to protect a winning streak.';
  } else if (score >= 15) {
    tier = 'low';
    tierLabel = 'Low Impact';
    recommendation = 'ℹ️ LOW VALUE: Minor rating loss; save your rare Jokers for worse disaster races.';
  } else {
    tier = 'none';
    tierLabel = 'No Impact';
    recommendation = '⛔ DO NOT USE: Race was positive or neutral; burning a Joker would be wasted.';
  }

  // Build bullet reasons
  const reasons: string[] = [];
  if (rrDelta < -20) {
    reasons.push(`Heavy Rank Rating drop (${rrDelta} RR points lost)`);
  } else if (rrDelta < 0) {
    reasons.push(`Moderate Rank Rating drop (${rrDelta} RR points)`);
  }

  if (isDnf) {
    reasons.push(lapsCompleted <= 2 ? 'Early DNF / Turn 1 Disconnect' : 'Did Not Finish (DNF)');
  }

  if (srImpact <= -0.15) {
    reasons.push(`Severe Safety Rating penalty (${srImpact.toFixed(2)} SR)`);
  } else if (srImpact < 0) {
    reasons.push(`Negative Safety Rating impact (${srImpact.toFixed(2)} SR)`);
  }

  if (positionDrop >= 5 && classGridPosition) {
    reasons.push(`Lost ${positionDrop} positions (Started P${classGridPosition} → Finished P${classPosition})`);
  }

  if (penaltiesCount > 0) {
    reasons.push(`${penaltiesCount} in-race penalty`);
  }

  if (totalSeverity > 10000) {
    reasons.push(`High collision force (${Math.round(totalSeverity).toLocaleString()} energy)`);
  }

  return {
    score,
    tier,
    tierLabel,
    recommendation,
    rrPointsProtected: Math.round(rrPointsProtected),
    srProtected: Number(srProtected.toFixed(2)),
    dnfProtected: isDnf,
    positionDrop,
    reasons,
  };
}

/**
 * Calculates Joker earning progression based on official LMU V1.4 Community Update rules:
 * - 1st Joker: Earned at 10 races
 * - 2nd Joker: Earned at 30 races (+20 races)
 * - 3rd Joker: Earned at 60 races (+30 races)
 * - Maximum capacity: 3 Jokers
 */
export function getJokerProgression(totalRaces: number): JokerProgression {
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

  return {
    totalRaces,
    jokersEarned,
    maxJokers,
    racesToNextJoker,
    nextThreshold,
    progressPct: Math.min(100, Math.max(0, progressPct)),
  };
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

