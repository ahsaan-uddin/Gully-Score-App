// Lifetime player statistics (computed live from all completed matches).
// No separate stats table — matches are the single source of truth.

import { Innings, Match } from "@/src/types/cricket";

export interface BattingTotals {
  innings: number;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  highest: number;
  outs: number;
}

export interface BowlingTotals {
  inningsBowled: number;
  legalBalls: number;
  runs: number;
  wickets: number;
  best: { w: number; r: number } | null;
}

export interface PlayerLifetimeStats {
  key: string;
  displayName: string;
  teams: string[];
  matches: number;
  matchIds: string[];
  batting: BattingTotals;
  bowling: BowlingTotals;
}

export function normalizePlayerKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function battingStrikeRate(b: BattingTotals): number {
  return b.balls === 0 ? 0 : (b.runs / b.balls) * 100;
}

export function battingAverage(b: BattingTotals): number {
  if (b.outs > 0) return b.runs / b.outs;
  if (b.innings > 0) return b.runs;
  return 0;
}

export function bowlingEconomy(b: BowlingTotals): number {
  return b.legalBalls === 0 ? 0 : (b.runs / b.legalBalls) * 6;
}

function emptyStats(key: string, displayName: string): PlayerLifetimeStats {
  return {
    key,
    displayName,
    teams: [],
    matches: 0,
    matchIds: [],
    batting: {
      innings: 0,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      highest: 0,
      outs: 0,
    },
    bowling: {
      inningsBowled: 0,
      legalBalls: 0,
      runs: 0,
      wickets: 0,
      best: null,
    },
  };
}

interface MatchAggCtx {
  perMatchPlayerIds: Set<string>; // playerKeys that already counted for this match
  teamSets: Map<string, Set<string>>; // playerKey -> set of team names
}

function bumpMatchCount(stats: PlayerLifetimeStats, matchId: string, ctx: MatchAggCtx) {
  if (ctx.perMatchPlayerIds.has(stats.key)) return;
  ctx.perMatchPlayerIds.add(stats.key);
  if (!stats.matchIds.includes(matchId)) {
    stats.matchIds.push(matchId);
    stats.matches = stats.matchIds.length;
  }
}

function getOrInit(
  map: Map<string, PlayerLifetimeStats>,
  key: string,
  displayName: string,
): PlayerLifetimeStats {
  let s = map.get(key);
  if (!s) {
    s = emptyStats(key, displayName);
    map.set(key, s);
  }
  return s;
}

function processInnings(
  match: Match,
  innings: Innings,
  map: Map<string, PlayerLifetimeStats>,
  ctx: MatchAggCtx,
) {
  const battingTeamName = match.teams[innings.battingTeamIdx].name;
  const bowlingTeamName = match.teams[(1 - innings.battingTeamIdx) as 0 | 1].name;

  // Batsmen
  Object.values(innings.batsmen).forEach((b) => {
    const playerName =
      match.teams[innings.battingTeamIdx].players[b.playerIdx] ?? "Unknown";
    const key = normalizePlayerKey(playerName);
    if (!key) return;
    const stats = getOrInit(map, key, playerName);
    // Record team membership.
    const teamSet = ctx.teamSets.get(key) ?? new Set<string>();
    teamSet.add(battingTeamName);
    ctx.teamSets.set(key, teamSet);
    // Innings: count if player faced any ball or got out (e.g., run out on 0).
    if (b.balls > 0 || b.runs > 0 || b.out) {
      stats.batting.innings += 1;
      stats.batting.runs += b.runs;
      stats.batting.balls += b.balls;
      stats.batting.fours += b.fours;
      stats.batting.sixes += b.sixes;
      if (b.runs > stats.batting.highest) stats.batting.highest = b.runs;
      if (b.out) stats.batting.outs += 1;
    }
    bumpMatchCount(stats, match.id, ctx);
  });

  // Bowlers
  Object.values(innings.bowlers).forEach((bw) => {
    const playerName =
      match.teams[(1 - innings.battingTeamIdx) as 0 | 1].players[bw.playerIdx] ??
      "Unknown";
    const key = normalizePlayerKey(playerName);
    if (!key) return;
    const stats = getOrInit(map, key, playerName);
    const teamSet = ctx.teamSets.get(key) ?? new Set<string>();
    teamSet.add(bowlingTeamName);
    ctx.teamSets.set(key, teamSet);
    if (bw.legalBalls > 0 || bw.wickets > 0 || bw.runs > 0) {
      stats.bowling.inningsBowled += 1;
      stats.bowling.legalBalls += bw.legalBalls;
      stats.bowling.runs += bw.runs;
      stats.bowling.wickets += bw.wickets;
      const candidate = { w: bw.wickets, r: bw.runs };
      const best = stats.bowling.best;
      if (
        !best ||
        candidate.w > best.w ||
        (candidate.w === best.w && candidate.r < best.r)
      ) {
        stats.bowling.best = candidate;
      }
    }
    bumpMatchCount(stats, match.id, ctx);
  });
}

export function computeLifetimeStats(
  allMatches: Match[],
): PlayerLifetimeStats[] {
  const map = new Map<string, PlayerLifetimeStats>();
  const teamSets = new Map<string, Set<string>>();

  const completed = allMatches.filter((m) => m.status === "completed");
  completed.forEach((m) => {
    const perMatchPlayerIds = new Set<string>();
    const ctx: MatchAggCtx = { perMatchPlayerIds, teamSets };
    processInnings(m, m.innings1, map, ctx);
    if (m.innings2) processInnings(m, m.innings2, map, ctx);
  });

  // Hydrate teams
  map.forEach((s, key) => {
    s.teams = Array.from(teamSets.get(key) ?? []);
  });

  return Array.from(map.values());
}

export function findPlayerStats(
  allMatches: Match[],
  playerKey: string,
): PlayerLifetimeStats | null {
  const list = computeLifetimeStats(allMatches);
  return list.find((p) => p.key === playerKey) ?? null;
}
