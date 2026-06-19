// Domain types for GullyScore.

export type Extra = "wd" | "nb" | "b" | "lb" | null;

export interface Ball {
  /** Runs added to the score on this delivery (batsman runs OR extra). */
  runs: number;
  /** Type of extra (null for normal delivery). */
  extra: Extra;
  /** Whether the delivery took a wicket. */
  wicket: boolean;
  /** Striker at moment of delivery. */
  strikerIdx: number;
  /** Non-striker at moment of delivery. */
  nonStrikerIdx: number;
  /** Bowler. */
  bowlerIdx: number;
  /** Counts as a legal delivery (towards 6-balls-per-over). */
  legal: boolean;
}

export interface BatsmanStat {
  playerIdx: number;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  out: boolean;
}

export interface BowlerStat {
  playerIdx: number;
  legalBalls: number;
  runs: number; // includes wd/nb, excludes byes/leg-byes (standard)
  wickets: number;
}

export interface Innings {
  battingTeamIdx: 0 | 1;
  score: number;
  wickets: number;
  legalBalls: number;
  balls: Ball[];
  batsmen: Record<number, BatsmanStat>;
  bowlers: Record<number, BowlerStat>;
  strikerIdx: number;
  nonStrikerIdx: number;
  currentBowlerIdx: number | null;
  previousBowlerIdx: number | null;
  yetToBat: number[]; // queue of player indices yet to bat
  closed: boolean;
  closedReason?: "all_out" | "overs_done" | "target_reached";
}

export interface Team {
  name: string;
  players: string[];
  captainIdx: number;
}

export interface Match {
  id: string;
  createdAt: string; // ISO
  updatedAt: string;
  teams: [Team, Team];
  oversTotal: number;
  playersPerSide: number;
  tossWinnerIdx: 0 | 1;
  tossDecision: "bat" | "bowl";
  firstBattingIdx: 0 | 1;
  innings1: Innings;
  innings2: Innings | null;
  status: "in_progress" | "completed";
  winnerIdx: 0 | 1 | null;
  resultText: string | null;
  target: number | null;
}
