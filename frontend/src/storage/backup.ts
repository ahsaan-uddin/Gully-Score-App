// Cross-device data export/import for GullyScore.
// Native (Android/iOS): writes JSON file, opens system Share sheet.
// Web preview: triggers Blob download via DOM.

import { Platform } from "react-native";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";

import { Match } from "@/src/types/cricket";
import { loadAllMatches, saveAllMatches } from "@/src/storage/matches";

const SCHEMA_VERSION = 1;
const APP_TAG = "gullyscore.backup";

export interface BackupPayload {
  app: typeof APP_TAG;
  version: number;
  exportedAt: string; // ISO timestamp
  matches: Match[];
}

export type ImportMode = "replace" | "merge";

export async function buildBackupString(): Promise<string> {
  const matches = await loadAllMatches();
  const payload: BackupPayload = {
    app: APP_TAG,
    version: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    matches,
  };
  return JSON.stringify(payload, null, 2);
}

function fileNameForNow(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
  return `gullyscore_${stamp}.json`;
}

export interface ExportResult {
  ok: boolean;
  method: "share" | "download" | "unavailable";
  matchCount: number;
  message?: string;
}

export async function exportAndShare(): Promise<ExportResult> {
  const json = await buildBackupString();
  const matches = (JSON.parse(json) as BackupPayload).matches;
  const filename = fileNameForNow();

  if (Platform.OS === "web") {
    try {
      // RN Web — direct DOM Blob download.
      const w = globalThis as unknown as {
        Blob?: typeof Blob;
        URL?: typeof URL;
        document?: Document;
      };
      if (!w.Blob || !w.URL || !w.document) {
        return { ok: false, method: "unavailable", matchCount: matches.length };
      }
      const blob = new w.Blob([json], { type: "application/json" });
      const url = w.URL.createObjectURL(blob);
      const a = w.document.createElement("a");
      a.href = url;
      a.download = filename;
      w.document.body.appendChild(a);
      a.click();
      w.document.body.removeChild(a);
      setTimeout(() => w.URL!.revokeObjectURL(url), 1000);
      return { ok: true, method: "download", matchCount: matches.length };
    } catch (e) {
      return {
        ok: false,
        method: "unavailable",
        matchCount: matches.length,
        message: (e as Error).message,
      };
    }
  }

  // Native path: write file to cache dir, then share.
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.create();
  file.write(json);

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    return {
      ok: false,
      method: "unavailable",
      matchCount: matches.length,
      message: "Sharing not available on this device.",
    };
  }
  await Sharing.shareAsync(file.uri, {
    mimeType: "application/json",
    dialogTitle: "Share GullyScore data",
    UTI: "public.json",
  });
  return { ok: true, method: "share", matchCount: matches.length };
}

export async function pickAndReadBackup(): Promise<BackupPayload | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["application/json", "text/plain", "*/*"],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled) return null;
  const asset = result.assets?.[0];
  if (!asset?.uri) return null;

  let text: string;
  if (Platform.OS === "web") {
    // On RN Web, asset.uri is typically a blob: URL; fetch it.
    const res = await fetch(asset.uri);
    text = await res.text();
  } else {
    const file = new File(asset.uri);
    text = await file.text();
  }

  const parsed = JSON.parse(text) as BackupPayload;
  if (parsed?.app !== APP_TAG || !Array.isArray(parsed.matches)) {
    throw new Error("Not a valid GullyScore backup file.");
  }
  return parsed;
}

export async function applyBackup(
  payload: BackupPayload,
  mode: ImportMode,
): Promise<{ added: number; updated: number; total: number }> {
  const existing = await loadAllMatches();
  let next: Match[];
  let added = 0;
  let updated = 0;

  if (mode === "replace") {
    next = payload.matches;
    added = payload.matches.length;
  } else {
    // Merge by id; incoming overrides existing where ids collide.
    const byId = new Map<string, Match>();
    existing.forEach((m) => byId.set(m.id, m));
    payload.matches.forEach((m) => {
      if (byId.has(m.id)) {
        updated += 1;
      } else {
        added += 1;
      }
      byId.set(m.id, m);
    });
    next = Array.from(byId.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  await saveAllMatches(next);
  return { added, updated, total: next.length };
}
