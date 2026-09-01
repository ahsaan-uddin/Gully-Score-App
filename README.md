# 🏏 Gully Score

A modern cricket scoring app built with **React Native** and **Expo**.

Gully Score is designed to make cricket match scoring simple, fast, and easy to manage. It supports live scoring, innings management, player and team management, match history, scorecards, and match results.

---

## 📱 About

Gully Score provides a simple interface for scoring cricket matches while keeping important match information organized.

The application follows an **offline-first** approach, with match and player data stored locally on the device.

---

## ✨ Features

### 🏏 Live Scoring

- Record runs
- Record extras
- Record wickets
- Track legal deliveries
- Track overs
- Track batsmen
- Track bowlers
- Undo recent scoring actions

### 🔄 Innings Management

- First innings scoring
- Automatic innings completion
- Second innings setup
- Automatic target calculation
- Chase tracking
- Match completion detection

### 📊 Scorecards & Statistics

- Batting statistics
- Bowling statistics
- Runs
- Balls faced
- Boundaries
- Strike rate
- Overs
- Runs conceded
- Wickets
- Economy rate
- Recent deliveries

### 👥 Players & Teams

- Manage players
- Manage teams
- Select batsmen
- Select bowlers
- Manage players available to bat

### 📜 Match Management

- Match history
- Match persistence
- Match results
- Series support
- Resume saved matches

### 🎨 User Interface

- Dark theme
- Light theme
- Responsive React Native interface
- Cricket-focused scoring controls
- Android support

### 💾 Offline-First Storage

Match and player information is persisted locally so the application can continue to work without requiring a constant internet connection.

---

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| React Native | Mobile application |
| Expo | React Native development platform |
| Expo Router | File-based navigation |
| TypeScript | Type-safe application development |
| AsyncStorage / Local Storage | Local data persistence |
| Expo EAS | Android application builds |

---

## 📂 Project Structure

```text
Gully-Score-App/
│
├── backend/
│   └── Backend-related code
│
├── frontend/
│   ├── app/
│   │   ├── index.tsx
│   │   ├── setup.tsx
│   │   ├── live.tsx
│   │   ├── result.tsx
│   │   ├── scorecard.tsx
│   │   ├── history.tsx
│   │   ├── teams.tsx
│   │   ├── players.tsx
│   │   └── ...
│   │
│   ├── assets/
│   │   ├── images/
│   │   └── fonts/
│   │
│   ├── src/
│   │   ├── logic/
│   │   │   ├── cricket.ts
│   │   │   └── stats.ts
│   │   │
│   │   ├── storage/
│   │   │   ├── matches.ts
│   │   │   ├── players_pool.ts
│   │   │   ├── series.ts
│   │   │   └── teams.ts
│   │   │
│   │   ├── theme/
│   │   │   ├── ThemeContext.tsx
│   │   │   └── tokens.ts
│   │   │
│   │   ├── types/
│   │   │   └── cricket.ts
│   │   │
│   │   └── utils/
│   │       └── storage/
│   │
│   ├── app.json
│   ├── eas.json
│   ├── package.json
│   └── package-lock.json
│
├── tests/
├── test_reports/
├── memory/
├── design_guidelines.json
├── test_result.md
├── .gitignore
└── README.md

🚀 Getting Started
Requirements

Make sure the following are installed:

Node.js
npm
Git
An Android device or Android emulator for Android testing
📥 Installation

Clone the repository:

git clone git@github.com:ahsaan-uddin/Gully-Score-App.git

Enter the project:

cd Gully-Score-App/frontend

Install dependencies:

npm install
▶️ Run the Application

Start the Expo development server:

npx expo start

You can then open the application using an available development target such as an Android device or emulator.

🧹 Start With a Clean Metro Cache

If the application behaves unexpectedly during development, start Expo with a cleared Metro cache:

npx expo start --clear

You can also remove local Expo and Metro caches manually:

rm -rf .expo .metro-cache

These are temporary development files and should not be committed to Git.

🩺 Check the Expo Project

Before creating an Android build, run:

npx expo-doctor

The project should pass the Expo configuration and dependency checks.

You can also check the Git working tree:

git status --short

A clean working tree produces no output.

🤖 Android APK

Gully Score uses Expo Application Services (EAS) for Android builds.

The preview EAS profile is configured to create an installable APK.

From the frontend directory:

npx eas build --platform android --profile preview

The generated APK can be installed directly on an Android device for testing.

APK Naming Convention
GullyScore-v1.0.0-Android.apk

Future versions can follow the same format:

GullyScore-v1.0.1-Android.apk
GullyScore-v1.1.0-Android.apk
GullyScore-v2.0.0-Android.apk
⚙️ EAS Build Profiles

The project currently contains three EAS build profiles.

Development

Used for development builds:

development
Preview

Used for internal Android testing and APK generation:

preview
Production

Used for production builds:

production
📱 Android Configuration

Current Android application package:

com.ahsaan24.frontend

Current application version:

1.0.0
🧪 Testing

Before committing major changes, test the main scoring flow:

Start Match
    ↓
First Innings
    ↓
Innings Break
    ↓
Second Innings
    ↓
Final Ball
    ↓
Match Over
    ↓
View Result
    ↓
Result Screen

Also verify:

Runs
Extras
Wickets
Overs
Batting statistics
Bowling statistics
Target calculation
Undo
Match result
Match history
Theme switching
Saved match data
🔄 Development Workflow

A recommended workflow for making changes:

Make changes
     ↓
Test locally
     ↓
Run Expo Doctor
     ↓
Review Git changes
     ↓
Commit changes
     ↓
Push to GitHub
     ↓
Build APK when required
     ↓
Test APK on Android
Useful Git Commands

Check the working tree:

git status --short

Review changes:

git diff

Stage changes:

git add -A

Review staged changes:

git diff --cached

Create a commit:

git commit -m "Describe the change"

Push to GitHub:

git push origin main
🔐 Security

Never commit sensitive information to the repository.

Do not commit:

Passwords
API keys
Access tokens
Credentials
Private SSH keys
Environment secrets

Examples of sensitive files that should remain private:

.env
.env.*
credentials.json
token.json
id_ed25519

Always review changes before pushing them to GitHub.

🚫 Files That Should Not Be Committed

Development dependencies, caches, and temporary files should remain outside Git.

Examples:

node_modules/
.expo/
.metro-cache/
dist/
build/

These files are covered by the repository's .gitignore where applicable.

📌 Current Status

Version: 1.0.0

Platform: Android

Expo SDK: 54

Android package: com.ahsaan24.frontend

Build status: Working Android APK successfully built and tested.

🗺️ Roadmap

Potential future improvements include:

Further UI/UX improvements
Additional cricket scoring functionality
Expanded statistics
Improved match and series management
More automated testing
Automated GitHub checks
Automated Android builds
GitHub release automation
Additional platform improvements
📸 Screenshots

Screenshots of the application will be added here.

Planned screenshots:

Home screen
Match setup
Live scoring
Innings break
Second innings
Match result
Scorecard
Match history
Players and teams
📦 Releases

Stable Android builds will be published through GitHub Releases when appropriate.

Example:

GullyScore v1.0.0
└── GullyScore-v1.0.0-Android.apk
📄 License

License information will be added when the project license is finalized.