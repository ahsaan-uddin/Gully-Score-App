// Saved teams registry (rosters that can be reused across matches).

import { storage } from "@/src/utils/storage";

const KEY = "gully.savedTeams.json";

export interface SavedTeam {
  id: string;
  name: string;
  players: string[];
  captainIdx: number;
  updatedAt: string;
}

export async function loadSavedTeams(): Promise<SavedTeam[]> {
  const raw = await storage.getItem<string>(KEY, "");
  if (!raw) return [];
  try {
    return JSON.parse(raw) as SavedTeam[];
  } catch {
    return [];
  }
}

export async function saveAllTeams(list: SavedTeam[]): Promise<void> {
  await storage.setItem(KEY, JSON.stringify(list));
}

export async function upsertTeam(team: SavedTeam): Promise<void> {
  const list = await loadSavedTeams();
  const idx = list.findIndex((t) => t.id === team.id);
  if (idx >= 0) list[idx] = team;
  else list.unshift(team);
  await saveAllTeams(list);
}

export async function deleteTeam(id: string): Promise<void> {
  const list = await loadSavedTeams();
  await saveAllTeams(list.filter((t) => t.id !== id));
}

export function newTeamId(): string {
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
