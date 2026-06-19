// Global player pool — tap-to-add chips backed by AsyncStorage.
// Records every player name ever used in a match so they can be quick-added next time.

import { storage } from "@/src/utils/storage";

const KEY = "gully.savedPlayers.json";

export interface SavedPlayer {
  name: string;        // display name (original casing of last save)
  key: string;         // normalized
  lastUsed: string;    // ISO
  matches: number;     // # of matches added to
}

export function normalizeKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function loadSavedPlayers(): Promise<SavedPlayer[]> {
  const raw = await storage.getItem<string>(KEY, "");
  if (!raw) return [];
  try {
    return JSON.parse(raw) as SavedPlayer[];
  } catch {
    return [];
  }
}

async function persist(list: SavedPlayer[]): Promise<void> {
  await storage.setItem(KEY, JSON.stringify(list));
}

export async function bumpPlayers(names: string[]): Promise<void> {
  const list = await loadSavedPlayers();
  const byKey = new Map<string, SavedPlayer>(list.map((p) => [p.key, p]));
  const now = new Date().toISOString();
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    const key = normalizeKey(name);
    const existing = byKey.get(key);
    if (existing) {
      existing.name = name;
      existing.lastUsed = now;
      existing.matches = (existing.matches ?? 0) + 1;
    } else {
      byKey.set(key, { name, key, lastUsed: now, matches: 1 });
    }
  }
  await persist(Array.from(byKey.values()));
}

/**
 * Search the saved player pool. Returns players sorted by recency, optionally filtered
 * by case-insensitive substring match on `query`.
 */
export async function suggestPlayers(
  query: string,
  excludeKeys: Set<string>,
  limit = 24,
): Promise<SavedPlayer[]> {
  const all = await loadSavedPlayers();
  const q = query.trim().toLowerCase();
  return all
    .filter((p) => !excludeKeys.has(p.key))
    .filter((p) => (q ? p.key.includes(q) : true))
    .sort((a, b) => {
      // Recent first, then most-used.
      const tA = new Date(a.lastUsed).getTime();
      const tB = new Date(b.lastUsed).getTime();
      if (tA !== tB) return tB - tA;
      return (b.matches ?? 0) - (a.matches ?? 0);
    })
    .slice(0, limit);
}

export async function deleteSavedPlayer(key: string): Promise<void> {
  const list = await loadSavedPlayers();
  await persist(list.filter((p) => p.key !== key));
}

export async function seedDemoPlayersIfNeeded(): Promise<void> {
  const list = await loadSavedPlayers();
  if (list.length > 0) return;
  const demoNames = [
    "Rohit", "Aman", "Karan", "Imran", "Vivek", "Sahil",
    "Ravi", "Sohail", "Dev", "Faraz", "Jay", "Manoj",
    "Neel", "Arjun", "Sanjay",
  ];
  await bumpPlayers(demoNames);
}
