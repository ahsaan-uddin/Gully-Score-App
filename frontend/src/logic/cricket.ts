// Pure cricket scoring logic. No I/O; deterministic on inputs.

import {
  Ball,
  BatsmanStat,
  BowlerStat,
  Extra,
  Innings,
  Match,
  Team,
} from "@/src/types/cricket";

export function emptyBatsmanStat(playerIdx: number): BatsmanStat {
  return { playerIdx, runs: 0, balls: 0, fours: 0, sixes: 0, out: false };
}

export function emptyBowlerStat(playerIdx: number): BowlerStat {
  return { playerIdx, legalBalls: 0, runs: 0, wickets: 0 };
}

export function createInnings(
  battingTeamIdx: 0 | 1,
  playersPerSide: number,
  strikerIdx: number,
  nonStrikerIdx: number,
  bowlerIdx: number | null,
): Innings {
  const yetToBat: number[] = [];
  for (let i = 0; i < playersPerSide; i++) {
    if (i !== strikerIdx && i !== nonStrikerIdx) yetToBat.push(i);
  }
  const batsmen: Record<number, BatsmanStat> = {
    [strikerIdx]: emptyBatsmanStat(strikerIdx),
    [nonStrikerIdx]: emptyBatsmanStat(nonStrikerIdx),
  };
  const bowlers: Record<number, BowlerStat> = {};
  if (bowlerIdx !== null) bowlers[bowlerIdx] = emptyBowlerStat(bowlerIdx);
  return {
    battingTeamIdx,
    score: 0,
    wickets: 0,
    legalBalls: 0,
    balls: [],
    batsmen,
    bowlers,
    strikerIdx,
    nonStrikerIdx,
    currentBowlerIdx: bowlerIdx,
    previousBowlerIdx: null,
    yetToBat,
    closed: false,
  };
}

export interface OversFmt {
  completedOvers: number;
  ballsThisOver: number;
  /** e.g. "3.2" */
  text: string;
}

export function formatOvers(legalBalls: number): OversFmt {
  const completedOvers = Math.floor(legalBalls / 6);
  const ballsThisOver = legalBalls % 6;
  return {
    completedOvers,
    ballsThisOver,
    text: `${completedOvers}.${ballsThisOver}`,
  };
}

export function runRate(score: number, legalBalls: number): number {
  if (legalBalls === 0) return 0;
  return (score / legalBalls) * 6;
}

/** Check if a delivery ends the over (only counts after 6 legal balls). */
export function isOverComplete(innings: Innings): boolean {
  return innings.legalBalls > 0 && innings.legalBalls % 6 === 0;
}

export interface ApplyBallInput {
  runs: number;
  extra: Extra; // 'wd' | 'nb' | 'b' | 'lb' | null
  wicket: boolean;
}

export interface ApplyBallResult {
  innings: Innings;
  /** Caller should prompt for a new batsman (innings still has balls left). */
  needsNewBatsman: boolean;
  /** Over completed and innings not closed; caller should prompt new bowler. */
  needsNewBowler: boolean;
  /** Innings closed at this delivery. */
  inningsClosed: boolean;
}

/**
 * Apply a single delivery to the innings (immutably). Caller passes a deep-cloned
 * innings; this function mutates it and returns flags for UI flow.
 */
export function applyBallMutable(
  innings: Innings,
  input: ApplyBallInput,
  oversTotal: number,
  playersPerSide: number,
  target: number | null,
): ApplyBallResult {
  const { runs, extra, wicket } = input;

  const strikerIdx = innings.strikerIdx;
  const nonStrikerIdx = innings.nonStrikerIdx;
  const bowlerIdx = innings.currentBowlerIdx;
  if (bowlerIdx === null) {
    throw new Error("No bowler selected");
  }

  const legal = extra !== "wd" && extra !== "nb";

  // Score
  innings.score += runs;

  // Batsman: credit runs only on normal deliveries (no extra). Bye/LegBye = no batsman runs.
  const striker = innings.batsmen[strikerIdx];
  if (!striker) throw new Error("Striker stat missing");
  if (extra === null) {
    striker.runs += runs;
    if (runs === 4) striker.fours += 1;
    if (runs === 6) striker.sixes += 1;
  }
  // Batsman ball count: counts on legal deliveries (any legal delivery, including byes/leg byes).
  if (legal) {
    striker.balls += 1;
  }

  // Bowler: legal balls counted on legal deliveries. Runs charged: actual runs on wd/nb deliveries
  // and normal runs on legitimate deliveries. Byes / leg-byes NOT charged to bowler.
  let bowler = innings.bowlers[bowlerIdx];
  if (!bowler) {
    bowler = emptyBowlerStat(bowlerIdx);
    innings.bowlers[bowlerIdx] = bowler;
  }
  if (legal) bowler.legalBalls += 1;
  if (extra === "wd" || extra === "nb") {
    bowler.runs += runs; // 1 (penalty) for now; we only allow 1 per tap
  } else if (extra === null) {
    bowler.runs += runs;
  }
  // byes/leg-byes: nothing to bowler.

  if (wicket) {
    innings.wickets += 1;
    striker.out = true;
    bowler.wickets += 1;
  }

  // Strike rotation: rotate on odd runs (1, 3, 5). On 5? cricket: yes. We'll support 0..6.
  if (runs % 2 === 1) {
    innings.strikerIdx = nonStrikerIdx;
    innings.nonStrikerIdx = strikerIdx;
  }

  // Record ball history (snapshot of who was on strike at the moment)
  const ball: Ball = {
    runs,
    extra,
    wicket,
    strikerIdx,
    nonStrikerIdx,
    bowlerIdx,
    legal,
  };
  innings.balls.push(ball);

  // Mirror legal-ball count on the innings (single source of truth for over math).
  if (legal) innings.legalBalls += 1;

  // End-of-innings checks
  const maxWickets = playersPerSide - 1;
  let inningsClosed = false;
  if (innings.wickets >= maxWickets) {
    innings.closed = true;
    innings.closedReason = "all_out";
    inningsClosed = true;
  } else if (innings.legalBalls >= oversTotal * 6) {
    innings.closed = true;
    innings.closedReason = "overs_done";
    inningsClosed = true;
  } else if (target !== null && innings.score >= target) {
    innings.closed = true;
    innings.closedReason = "target_reached";
    inningsClosed = true;
  }

  let needsNewBatsman = false;
  if (wicket && !inningsClosed) {
    needsNewBatsman = true;
  }

  let needsNewBowler = false;
  if (
    !inningsClosed &&
    !needsNewBatsman &&
    innings.legalBalls > 0 &&
    innings.legalBalls % 6 === 0
  ) {
    // Over completed -> swap strike, ask for next bowler
    innings.previousBowlerIdx = bowlerIdx;
    innings.currentBowlerIdx = null;
    const tmp = innings.strikerIdx;
    innings.strikerIdx = innings.nonStrikerIdx;
    innings.nonStrikerIdx = tmp;
    needsNewBowler = true;
  }

  return { innings, needsNewBatsman, needsNewBowler, inningsClosed };
}

/** Set the new batsman (after a wicket). Removes from yetToBat. */
export function setNewBatsman(innings: Innings, playerIdx: number): Innings {
  if (innings.batsmen[playerIdx] && !innings.batsmen[playerIdx].out) return innings;
  innings.batsmen[playerIdx] = emptyBatsmanStat(playerIdx);
  innings.yetToBat = innings.yetToBat.filter((i) => i !== playerIdx);
  // New batsman comes in on strike (replaces out striker) — striker is always the one out.
  innings.strikerIdx = playerIdx;
  return innings;
}

/** Set new bowler at start of new over. */
export function setNewBowler(innings: Innings, playerIdx: number): Innings {
  innings.currentBowlerIdx = playerIdx;
  if (!innings.bowlers[playerIdx]) {
    innings.bowlers[playerIdx] = emptyBowlerStat(playerIdx);
  }
  return innings;
}

export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/** Reset the entire innings's ball history by re-applying from a snapshot. */
export interface InningsSnapshot {
  data: Innings;
}

export function snapshotInnings(innings: Innings): InningsSnapshot {
  return { data: deepClone(innings) };
}

export function restoreInnings(snap: InningsSnapshot): Innings {
  return deepClone(snap.data);
}

// ---- Match-level helpers ----

export function createMatch(input: {
  teams: [Team, Team];
  oversTotal: number;
  playersPerSide: number;
  tossWinnerIdx: 0 | 1;
  tossDecision: "bat" | "bowl";
  strikerIdx: number;
  nonStrikerIdx: number;
  bowlerIdx: number;
}): Match {
  const firstBattingIdx: 0 | 1 =
    input.tossDecision === "bat"
      ? input.tossWinnerIdx
      : ((1 - input.tossWinnerIdx) as 0 | 1);
  const now = new Date().toISOString();
  return {
    id: `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: now,
    updatedAt: now,
    teams: input.teams,
    oversTotal: input.oversTotal,
    playersPerSide: input.playersPerSide,
    tossWinnerIdx: input.tossWinnerIdx,
    tossDecision: input.tossDecision,
    firstBattingIdx,
    innings1: createInnings(
      firstBattingIdx,
      input.playersPerSide,
      input.strikerIdx,
      input.nonStrikerIdx,
      input.bowlerIdx,
    ),
    innings2: null,
    status: "in_progress",
    winnerIdx: null,
    resultText: null,
    target: null,
  };
}

export function startSecondInnings(
  match: Match,
  strikerIdx: number,
  nonStrikerIdx: number,
  bowlerIdx: number,
): Match {
  const secondBattingIdx: 0 | 1 = (1 - match.firstBattingIdx) as 0 | 1;
  match.target = match.innings1.score + 1;
  match.innings2 = createInnings(
    secondBattingIdx,
    match.playersPerSide,
    strikerIdx,
    nonStrikerIdx,
    bowlerIdx,
  );
  match.updatedAt = new Date().toISOString();
  return match;
}

/** Finalize match result after innings2 is closed (or innings1 if a single-innings result). */
export function finalizeResult(match: Match): Match {
  if (!match.innings2) return match;
  const i1 = match.innings1.score;
  const i2 = match.innings2.score;
  const firstTeam = match.firstBattingIdx;
  const secondTeam: 0 | 1 = (1 - firstTeam) as 0 | 1;
  const playersPerSide = match.playersPerSide;
  const wicketsLeft = playersPerSide - 1 - match.innings2.wickets;

  if (i2 > i1) {
    match.winnerIdx = secondTeam;
    match.resultText = `${match.teams[secondTeam].name} won by ${wicketsLeft} wicket${wicketsLeft === 1 ? "" : "s"}`;
  } else if (i1 > i2) {
    match.winnerIdx = firstTeam;
    const diff = i1 - i2;
    match.resultText = `${match.teams[firstTeam].name} won by ${diff} run${diff === 1 ? "" : "s"}`;
  } else {
    match.winnerIdx = null;
    match.resultText = "Match Tied";
  }
  match.status = "completed";
  match.updatedAt = new Date().toISOString();
  return match;
}

export function activeInnings(match: Match): Innings {
  if (match.innings2 && !match.innings2.closed) return match.innings2;
  if (match.innings2 && match.innings2.closed) return match.innings2;
  return match.innings1;
}

export interface MvpInfo {
  topScorer: { teamIdx: number; playerName: string; runs: number; balls: number } | null;
  bestBowler: { teamIdx: number; playerName: string; wickets: number; runs: number; legalBalls: number } | null;
}

export function computeMvp(match: Match): MvpInfo {
  const innings = [match.innings1, match.innings2].filter(
    (x): x is Innings => x !== null,
  );

  let topScorer: MvpInfo["topScorer"] = null;
  let bestBowler: MvpInfo["bestBowler"] = null;

  for (const inn of innings) {
    const batTeamIdx = inn.battingTeamIdx;
    const bowlTeamIdx = (1 - batTeamIdx) as 0 | 1;
    Object.values(inn.batsmen).forEach((b) => {
      if (!topScorer || b.runs > topScorer.runs) {
        topScorer = {
          teamIdx: batTeamIdx,
          playerName: match.teams[batTeamIdx].players[b.playerIdx] ?? "—",
          runs: b.runs,
          balls: b.balls,
        };
      }
    });
    Object.values(inn.bowlers).forEach((b) => {
      const candidate = {
        teamIdx: bowlTeamIdx,
        playerName: match.teams[bowlTeamIdx].players[b.playerIdx] ?? "—",
        wickets: b.wickets,
        runs: b.runs,
        legalBalls: b.legalBalls,
      };
      if (
        !bestBowler ||
        candidate.wickets > bestBowler.wickets ||
        (candidate.wickets === bestBowler.wickets && candidate.runs < bestBowler.runs)
      ) {
        bestBowler = candidate;
      }
    });
  }
  return { topScorer, bestBowler };
}

export function describeBall(b: Ball): string {
  if (b.extra === "wd") return "Wd";
  if (b.extra === "nb") return "Nb";
  if (b.extra === "b") return `B${b.runs > 1 ? b.runs : ""}`;
  if (b.extra === "lb") return `Lb${b.runs > 1 ? b.runs : ""}`;
  if (b.wicket) return "W";
  return String(b.runs);
}
