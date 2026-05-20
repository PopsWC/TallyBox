# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Project structure (TallyBox)

- **`app/`** — Routes (expo-router). One file per screen; names match URLs.
  - `index.tsx` — Home: season list, “Today’s Tally” shortcut.
  - `season/new.tsx` — New season (modal). `season/[id].tsx` — Season detail and planting days.
  - `tally/[date].tsx` — Daily tally (entries for a date). `tally/new-entry.tsx`, `tally/edit-entry.tsx` — Entry forms (modals).
  - `summary/[date].tsx` — Day summary (by species / by plot).
- **`contexts/active-season.tsx`** — `ActiveSeasonProvider` and `useActiveSeason()` for the selected season.
- **`components/ui.tsx`** — Shared UI: `Button`, `LabeledInput`, `StatBadge`, `EmptyState`, `SectionHeader`, `Divider`.
- **`lib/`** — Core logic.
  - `theme.ts` — Colors, typography, spacing, `globalStyles` (single source for app styling).
  - `database.ts` — SQLite: seasons, entries, summaries. Types: `Season`, `TallyEntry`, `NewEntry`, `DailySummary`, `SeasonSummary`.
  - `functions/export.ts` — CSV/JSON export and share.

Use `@/` for imports (e.g. `@/lib/theme`, `@/contexts/active-season`).

If export or SQLite fails with "Cannot find module", install:  
`npx expo install expo-file-system expo-sharing expo-sqlite`

## Troubleshooting

### Watchman: "Operation not permitted" on macOS

Metro (the bundler) uses [Watchman](https://facebook.github.io/watchman/) to watch files. If you see:

```text
Error: std::__1::system_error: open: /path/to/TallyBox: Operation not permitted
```

**Fix: grant your terminal app access to your project folder.**

1. **System Settings → Privacy & Security → Full Disk Access**
   - Click **+** and add **Terminal** (or **iTerm**, etc.).
   - If it’s already there, remove it and add it again, then restart the terminal.

2. **System Settings → Privacy & Security → Files and Folders**
   - Select your terminal app and enable access to **Documents** (or wherever TallyBox lives), so it can read that folder.

3. **Restart Watchman** (if installed via Homebrew):
   ```bash
   watchman shutdown-server
   watchman watch-del-all
   ```

4. **Quit and reopen Terminal**, then run `npm run ios` again.

If it still fails, your project may be in a restricted or iCloud-synced folder. Moving the project to a normal folder (e.g. `~/Projects/TallyBox`) and opening it from there often resolves it.

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
