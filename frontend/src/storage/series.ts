// Series storage — best-of-N format. A Series groups multiple matches between
// two teams and computes wins / winner.

import { storage } from "@/src/utils/storage";
import { Match } from "@/src/types/cricket";

const KEY = "gully.series.json";

export interface Series {
  id: string;
  name: string;
  teamA: string;
  teamB: string;
  bestOf: number; // 3, 5, 7
  matchIds: string[];
  status: "in_progress" | "completed";
  winnerName: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function loadAllSeries(): Promise<Series[]> {
  const raw = await storage.getItem<string>(KEY, "");
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Series[];
  } catch {
    return [];
  }
}

export async function saveAllSeries(list: Series[]): Promise<void> {
  await storage.setItem(KEY, JSON.stringify(list));
}

export async function getSeries(id: string): Promise<Series | null> {
  const list = await loadAllSeries();
  return list.find((s) => s.id === id) ?? null;
}

export async function upsertSeries(series: Series): Promise<void> {
  const list = await loadAllSeries();
  const idx = list.findIndex((s) => s.id === series.id);
  if (idx >= 0) list[idx] = series;
  else list.unshift(series);
  await saveAllSeries(list);
}

export async function deleteSeries(id: string): Promise<void> {
  const list = await loadAllSeries();
  await saveAllSeries(list.filter((s) => s.id !== id));
}

export function newSeriesId(): string {
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function makeSeries(input: {
  name: string;
  teamA: string;
  teamB: string;
  bestOf: number;
}): Series {
  const now = new Date().toISOString();
  return {
    id: newSeriesId(),
    name: input.name,
    teamA: input.teamA,
    teamB: input.teamB,
    bestOf: input.bestOf,
    matchIds: [],
    status: "in_progress",
    winnerName: null,
    createdAt: now,
    updatedAt: now,
  };
}

export interface SeriesStandings {
  winsA: number;
  winsB: number;
  ties: number;
  played: number;
  needed: number; // wins needed to clinch
  clinchedBy: string | null;
}

export function computeStandings(series: Series, matches: Match[]): SeriesStandings {
  const matchMap = new Map(matches.map((m) => [m.id, m]));
  let winsA = 0;
  let winsB = 0;
  let ties = 0;
  let played = 0;
  for (const id of series.matchIds) {
    const m = matchMap.get(id);
    if (!m || m.status !== "completed") continue;
    played += 1;
    if (m.winnerIdx === null) {
      ties += 1;
      continue;
    }
    const winnerName = m.teams[m.winnerIdx].name;
    if (winnerName === series.teamA) winsA += 1;
    else if (winnerName === series.teamB) winsB += 1;
  }
  const needed = Math.floor(series.bestOf / 2) + 1;
  let clinchedBy: string | null = null;
  if (winsA >= needed) clinchedBy = series.teamA;
  else if (winsB >= needed) clinchedBy = series.teamB;
  return { winsA, winsB, ties, played, needed, clinchedBy };
}

/** Add a completed match to a series and recompute status/winner. */
export async function attachMatchToSeries(
  seriesId: string,
  match: Match,
  allMatches: Match[],
): Promise<Series | null> {
  const series = await getSeries(seriesId);
  if (!series) return null;
  if (!series.matchIds.includes(match.id)) {
    series.matchIds.push(match.id);
  }
  series.updatedAt = new Date().toISOString();
  const standings = computeStandings(series, allMatches);
  if (standings.clinchedBy) {
    series.status = "completed";
    series.winnerName = standings.clinchedBy;
  } else if (standings.played >= series.bestOf) {
    // played all matches without majority -> declare series tied or by-most-wins
    series.status = "completed";
    if (standings.winsA > standings.winsB) series.winnerName = series.teamA;
    else if (standings.winsB > standings.winsA) series.winnerName = series.teamB;
    else series.winnerName = null;
  }
  await upsertSeries(series);
  return series;
}
