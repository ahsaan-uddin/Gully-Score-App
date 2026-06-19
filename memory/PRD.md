# GullyScore — Product Requirements

## Overview
**GullyScore** is a production-grade mobile-first **Android** cricket scoring app built with Expo React Native. Designed for outdoor, one-handed scoring during live gully matches. Fully **offline**, with **lifetime player statistics** and **cross-device data sharing**.

## Screens
1. **Dashboard** (`/`) — brand, theme toggle, resume-card, New Match CTA, quick-action row (Player Stats / Backup & Share), recent matches.
2. **Match Setup** (`/setup`) — Teams (renameable), custom players-per-side (preset 5/7/10/11 + custom 2–22), overs (preset + custom), captain pick, **Toss section** with two modes: **Virtual Toss** (in-app coin flip) / **Pitch Toss** (manual entry). Openers picker modal.
3. **Live Scoring** (`/live`) — sticky header (score/overs/CRR/chase banner), batsmen + bowler cards, recent ball chips, bottom scoring pad (runs / wicket / extras / undo). Modals: new batsman, new bowler, innings break, end-of-match.
4. **Result** (`/result?id=`) — winner banner, scoreline, MVPs.
5. **Match History** (`/history`) — searchable list with per-row delete.
6. **Full Scorecard** (`/scorecard?id=`) — both innings batting/bowling tables.
7. **Player Stats** (`/players`) — searchable list sorted by Runs / Wickets / Matches / A–Z.
8. **Player Profile** (`/player?key=`) — hero (M/Runs/Wickets), batting card (Inn, Runs, Balls, Highest, SR, Avg, 4s, 6s), bowling card (Inn, Overs, Runs, Wickets, Eco, Best), match list.
9. **Backup & Share** (`/backup`) — stored count, **Export** (JSON file, native share / web download), **Import** (file picker → modal: Merge / Replace).

## Lifetime Player Statistics
- Computed **live from all completed matches** — no separate stats table.
- Players identified by normalized name (`trim().toLowerCase()`).
- Batting: Innings, Runs, Balls, Strike Rate, Average, Highest, 4s, 6s, Outs.
- Bowling: Innings Bowled, Overs, Runs, Wickets, Economy, Best Figures.

## Export / Import
- **Format:** JSON with header `{ app: "gullyscore.backup", version: 1, exportedAt, matches: [...] }`.
- **Native:** `expo-file-system` writes to cache → `expo-sharing` shares (WhatsApp / Bluetooth / Drive / etc.).
- **Web:** Blob → `<a download>` triggers browser download.
- **Import:** `expo-document-picker` (or browser file picker on web) → parse + validate → Merge (dedupe by `match.id`, incoming overrides) or Replace.

## Core Scoring Rules (v1)
- 6 legal balls = 1 over (display `O.B`).
- Strike rotates on odd runs (1, 3, 5).
- **Wide / No-Ball:** +1 run, NOT a legal delivery; charged to bowler.
- **Bye / Leg-Bye:** +1 run, legal delivery, ball counted to batsman & bowler; runs NOT credited to either.
- **Wicket:** legal delivery; striker out; prompt new batsman; innings closes at `playersPerSide - 1` wickets.
- **Innings end:** all-out OR overs done OR target reached (innings 2).
- **2nd innings target banner:** "Need X runs in Y balls".
- **Undo:** snapshot stack capped at 60.

## Persistence (offline)
AsyncStorage keys via `@/src/utils/storage`:
- `gully.matches.json` — JSON-stringified array of all matches.
- `gully.currentMatchId` — id of in-progress match.
- `gully.demoSeeded` — boolean.
- `gully.theme` — `dark` | `light`.

## Tech Stack
- Expo SDK 54, React Native 0.81.5, React 19.1, Expo Router 6, Reanimated 4.
- Icons: `@expo/vector-icons` (Ionicons).
- KV storage: `@/src/utils/storage` (AsyncStorage-backed).
- File I/O: `expo-file-system` (modern File/Paths API).
- Share/import: `expo-sharing`, `expo-document-picker`.
- Haptics: `expo-haptics`. Safe area: `react-native-safe-area-context`.

## Build & Distribute
- **APK / AAB:** On Emergent platform, tap **Publish** (top-right) → supply Android signing credentials → platform builds the installable artefact. No EAS CLI setup needed by user.

## How to Share Data Between Phones
1. On the **recorder phone**: `Backup & Share → Export & Share` → choose WhatsApp / Bluetooth / Drive.
2. On the **friend's phone**: open the received `.json` file → "Open with GullyScore" *(after install)*, or open GullyScore → `Backup & Share → Pick Backup File` → choose **Merge** (keeps your matches) or **Replace All**.
