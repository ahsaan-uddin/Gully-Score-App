# GullyScore — Product Requirements (v1)

## Overview
**GullyScore** is a production-grade mobile-first **Android** scoring app for **gully cricket**, built with Expo React Native. It is designed for fast, glanceable, one-handed use during live matches outdoors. Works **fully offline**.

## v1 Scope (User confirmed)
- Single match flow + history (no tournament/leaderboard).
- Fully offline / local storage via AsyncStorage.
- Preloaded demo data for first-run wow moment.
- Dark mode default with light toggle.

## Screens
1. **Dashboard** (`/`) — brand, theme toggle, resume-card for in-progress match, New Match CTA, recent matches.
2. **Match Setup** (`/setup`) — Team A/B names, players-per-side (5/7/10/11), overs (2/5/10/20 + custom), per-player names, captain pick, toss winner + decision. Openers selection modal.
3. **Live Scoring** (`/live`) — sticky score header (score/wickets, overs, CRR, chase banner), batsmen card (striker dot indicator + stats), bowler card, recent ball chips, bottom-anchored scoring pad (runs 0/1/2/3/4/6, wicket, extras Wd/Nb/B/Lb, undo). Modals: new batsman, new bowler, innings break, end-of-match, exit-confirm.
4. **Result** (`/result?id=`) — winner banner, scoreline, MVP top scorer + best bowler, scorecard CTA, new-match CTA.
5. **Match History** (`/history`) — list of completed matches with search and per-row delete.
6. **Full Scorecard** (`/scorecard?id=`) — both innings batting + bowling tables.

## Core Scoring Rules (v1)
- 6 legal balls = 1 over (display `O.B` e.g. `3.2`).
- Strike rotates on odd runs (1, 3, 5).
- **Wide / No-Ball:** +1 run, **NOT** a legal delivery; ball not counted to batsman; charged to bowler.
- **Bye / Leg-Bye:** +1 run, **legal** delivery, ball counted to batsman & bowler, runs **NOT** to batsman, **NOT** to bowler.
- **Wicket:** legal delivery; striker out; prompt new batsman; innings closes when wickets == playersPerSide - 1.
- **Innings end:** all-out OR overs done OR target reached (innings 2 only).
- **2nd innings target banner:** "Need X runs in Y balls".
- **Undo:** snapshot stack (capped at 60) of the entire match before each delivery.

## Persistence
- AsyncStorage keys:
  - `gully.matches.json` — JSON-stringified array of all matches.
  - `gully.currentMatchId` — id of in-progress match (for resume).
  - `gully.demoSeeded` — boolean.
  - `gully.theme` — `dark` | `light`.

## Tech
- Expo SDK 54, React Native 0.81.5, React 19.1, Expo Router 6, Reanimated 4.
- Icons: `@expo/vector-icons` (Ionicons).
- Local KV: `@/src/utils/storage` (AsyncStorage-backed).
- Haptics: `expo-haptics`.
- Safe area: `react-native-safe-area-context`.

## Building an APK
On Emergent platform: tap the **Publish** button (top-right) and supply the requested Android signing credentials; the platform builds an installable APK/AAB. No EAS CLI setup required by the user.
