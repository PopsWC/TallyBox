# TallyBox — Progress vs Original Plan

## Your original plan

1. **Mobile app with Expo** to tally trees planted during a tree-planting season  
2. **Use expo-sqlite** for storage  
3. **Each season = its own table**  
4. **Send each day’s tally to the crew boss** in an easy-to-read format that can be imported into a **companion app** for tracking the crew’s trees  

---

## Where things stand

### ✅ Done and working

| Goal | Status | Where it lives |
|------|--------|----------------|
| Expo mobile app | Done | `app/` (Expo Router), runs with `npx expo start` |
| expo-sqlite | Done | `lib/database.ts` — one DB file, WAL mode |
| One table per season | Done | `lib/database.ts`: `createSeason()` creates a **registry** table `seasons` and a **per-season table** `season_<name>_<year>` with columns: date, planter_name, species, plot, price_per_tree, bundle_count, trees_per_bundle, total_trees, total_value, notes |
| Tally entries per day | Done | Add/edit/delete entries in `app/tally/[date].tsx`, `new-entry`, `edit-entry`; data in the season table |
| Day summary (trees $ by species/plot) | Done | `getDailySummary()` in `lib/database.ts`; UI in `app/summary/[date].tsx` |
| **Send day to crew boss** — format + share | Designed and wired | `lib/functions/export.ts`: **CSV** (spreadsheet) and **JSON** (for companion app); “Send to Boss” in Daily Tally screen opens share sheet |

So: app structure, SQLite, one-table-per-season, daily tally, and the **design** of “send to crew boss” (two formats, share sheet) are all in place.

---

## Problems you’re running into

### 1. **“Send to Crew Boss” can fail at runtime**

**Cause:** The export code uses **expo-file-system** and **expo-sharing**, but they are **not** in your `package.json`. So when you tap “Send to Boss”, the app can throw “Cannot find module 'expo-file-system'” or “expo-sharing”.

**Fix:** Install the packages Expo-style:

```bash
npx expo install expo-file-system expo-sharing
```

If you get peer dependency errors (e.g. with `@legendapp/state`), try:

```bash
npm install expo-file-system expo-sharing --legacy-peer-deps
```

---

### 2. **TypeScript / editor errors for expo-sqlite or expo-sharing**

**Cause:** Same as above — if the modules aren’t installed or aren’t resolved, you’ll see “Cannot find module 'expo-sqlite'” or “expo-sharing” in the editor or when running `npx tsc --noEmit`.

**Fix:** Same as (1). After a successful install, restart the TypeScript server (in VS Code/Cursor: “TypeScript: Restart TS Server”) so it picks up the new modules.

---

### 3. **Companion app doesn’t exist yet**

**Status:** The **plan** is implemented: daily (and season) data is exported in a **structured JSON format** that a companion app can import.

- **Daily export** (from Daily Tally → “Send to Boss” → “JSON (companion app)”):  
  `ExportPayload` in `lib/functions/export.ts` — `export_version`, `export_type: "daily"`, `date`, `season`, `summary` (totals + by_species + by_plot), and full `entries` list.
- **Season export** (from Season screen → Export → JSON):  
  Same shape with `export_type: "season"` and no `date`; one payload for the whole season.

A **companion app** would:

- Use the same `ExportPayload` type (or a copy of it).
- Accept shared JSON files (or CSV and parse them).
- Merge or display daily/season data for the crew.

So: “easy to read and import into a similar companion app” is **designed and implemented** on the TallyBox side; the companion app itself is still to be built.

---

## Summary

| Item | Status |
|------|--------|
| Expo app + SQLite + one table per season | ✅ Implemented |
| Daily tally (entries, summary by species/plot) | ✅ Implemented |
| Send day’s tally to crew boss (CSV + JSON, share sheet) | ✅ Implemented (needs `expo-file-system` + `expo-sharing` installed) |
| JSON format for companion app import | ✅ Designed and used in export |
| Companion app for crew boss | ❌ Not built yet |

**Next step:** Run `npx expo install expo-file-system expo-sharing` (or install with `--legacy-peer-deps` if needed), then test “Send to Boss” on a device or simulator. After that, the only missing piece from your original plan is the companion app that **imports** those JSON (or CSV) files.
