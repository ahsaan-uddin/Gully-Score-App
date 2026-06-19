// Match persistence helpers (offline first via AsyncStorage).

import { Match } from "@/src/types/cricket";
import { storage } from "@/src/utils/storage";

const KEY_MATCHES_JSON = "gully.matches.json";
const KEY_CURRENT_MATCH_ID = "gully.currentMatchId";
const KEY_DEMO_SEEDED = "gully.demoSeeded";

export async function loadAllMatches(): Promise<Match[]> {
  const raw = await storage.getItem<string>(KEY_MATCHES_JSON, "");
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Match[];
  } catch {
    return [];
  }
}

export async function saveAllMatches(matches: Match[]): Promise<void> {
  await storage.setItem(KEY_MATCHES_JSON, JSON.stringify(matches));
}

export async function upsertMatch(match: Match): Promise<void> {
  const list = await loadAllMatches();
  const idx = list.findIndex((m) => m.id === match.id);
  if (idx >= 0) list[idx] = match;
  else list.unshift(match);
  await saveAllMatches(list);
}

export async function getMatch(id: string): Promise<Match | null> {
  const list = await loadAllMatches();
  return list.find((m) => m.id === id) ?? null;
}

export async function deleteMatch(id: string): Promise<void> {
  const list = await loadAllMatches();
  await saveAllMatches(list.filter((m) => m.id !== id));
}

export async function setCurrentMatchId(id: string | null): Promise<void> {
  if (id) await storage.setItem(KEY_CURRENT_MATCH_ID, id);
  else await storage.removeItem(KEY_CURRENT_MATCH_ID);
}

export async function getCurrentMatchId(): Promise<string | null> {
  const v = await storage.getItem<string>(KEY_CURRENT_MATCH_ID, "");
  return v ? v : null;
}

// ---- Demo seed ----

function demoMatch(): Match {
  // A finished demo match: Mohalla XI vs Galli Tigers, 5 overs.
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
  return {
    id: "demo_match_1",
    createdAt: yesterday,
    updatedAt: yesterday,
    teams: [
      {
        name: "Mohalla XI",
        players: ["Rohit", "Aman", "Karan", "Imran", "Vivek", "Sahil"],
        captainIdx: 0,
      },
      {
        name: "Galli Tigers",
        players: ["Ravi", "Sohail", "Dev", "Faraz", "Jay", "Manoj"],
        captainIdx: 0,
      },
    ],
    oversTotal: 5,
    playersPerSide: 6,
    tossWinnerIdx: 0,
    tossDecision: "bat",
    firstBattingIdx: 0,
    innings1: {
      battingTeamIdx: 0,
      score: 48,
      wickets: 3,
      legalBalls: 30,
      balls: [],
      batsmen: {
        0: { playerIdx: 0, runs: 22, balls: 14, fours: 2, sixes: 1, out: true },
        1: { playerIdx: 1, runs: 14, balls: 10, fours: 1, sixes: 0, out: true },
        2: { playerIdx: 2, runs: 8, balls: 4, fours: 0, sixes: 1, out: false },
        3: { playerIdx: 3, runs: 4, balls: 2, fours: 1, sixes: 0, out: false },
      },
      bowlers: {
        0: { playerIdx: 0, legalBalls: 12, runs: 18, wickets: 1 },
        1: { playerIdx: 1, legalBalls: 12, runs: 22, wickets: 2 },
        2: { playerIdx: 2, legalBalls: 6, runs: 8, wickets: 0 },
      },
      strikerIdx: 2,
      nonStrikerIdx: 3,
      currentBowlerIdx: 2,
      previousBowlerIdx: 1,
      yetToBat: [4, 5],
      closed: true,
      closedReason: "overs_done",
    },
    innings2: {
      battingTeamIdx: 1,
      score: 41,
      wickets: 5,
      legalBalls: 30,
      balls: [],
      batsmen: {
        0: { playerIdx: 0, runs: 11, balls: 9, fours: 1, sixes: 0, out: true },
        1: { playerIdx: 1, runs: 6, balls: 5, fours: 0, sixes: 0, out: true },
        2: { playerIdx: 2, runs: 14, balls: 10, fours: 1, sixes: 1, out: true },
        3: { playerIdx: 3, runs: 3, balls: 3, fours: 0, sixes: 0, out: true },
        4: { playerIdx: 4, runs: 5, balls: 2, fours: 0, sixes: 0, out: true },
        5: { playerIdx: 5, runs: 0, balls: 1, fours: 0, sixes: 0, out: false },
      },
      bowlers: {
        0: { playerIdx: 0, legalBalls: 12, runs: 14, wickets: 2 },
        1: { playerIdx: 1, legalBalls: 12, runs: 16, wickets: 2 },
        2: { playerIdx: 2, legalBalls: 6, runs: 8, wickets: 1 },
      },
      strikerIdx: 5,
      nonStrikerIdx: 4,
      currentBowlerIdx: 2,
      previousBowlerIdx: 1,
      yetToBat: [],
      closed: true,
      closedReason: "overs_done",
    },
    status: "completed",
    winnerIdx: 0,
    resultText: "Mohalla XI won by 7 runs",
    target: 49,
  };
}

export async function seedDemoIfNeeded(): Promise<void> {
  const seeded = await storage.getItem<boolean>(KEY_DEMO_SEEDED, false);
  if (seeded) return;
  const matches = await loadAllMatches();
  if (matches.length === 0) {
    matches.unshift(demoMatch());
    await saveAllMatches(matches);
  }
  await storage.setItem(KEY_DEMO_SEEDED, true);
}
