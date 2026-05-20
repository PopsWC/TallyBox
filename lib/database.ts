import * as SQLite from "expo-sqlite";

let _db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!_db) {
    _db = await SQLite.openDatabaseAsync("treetally.db");
    await _db.execAsync("PRAGMA journal_mode = WAL;");
  }
  return _db;
}

// ─── Season management ───────────────────────────────────────────────────────

export async function createSeason(
  name: string,
  year: number,
  crewBoss: string,
  dailyGoal?: number,
  seasonGoal?: number
): Promise<number> {
  const db = await getDb();

  // Sanitize table name: letters, numbers, underscores only
  const tableName = `season_${name.replace(/[^a-zA-Z0-9]/g, "_")}_${year}`;

  // Seasons registry table
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS seasons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      year INTEGER NOT NULL,
      table_name TEXT NOT NULL UNIQUE,
      daily_goal REAL,
      season_goal REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migration: add goal columns if they don't exist
  try {
    await db.execAsync(`ALTER TABLE seasons ADD COLUMN daily_goal REAL;`);
  } catch {}
  try {
    await db.execAsync(`ALTER TABLE seasons ADD COLUMN season_goal REAL;`);
  } catch {}
  try {
    await db.execAsync(`ALTER TABLE seasons ADD COLUMN crew_boss TEXT NOT NULL DEFAULT '';`);
  } catch {}

  // Per-season extras table (for custom earnings like driving, cleaning, etc.)
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS ${tableName}_extras (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS ${tableName} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      planter_name TEXT NOT NULL,
      species TEXT NOT NULL,
      plot TEXT NOT NULL,
      cache TEXT NOT NULL DEFAULT '',
      price_per_tree REAL NOT NULL,
      bundle_count INTEGER NOT NULL,
      trees_per_bundle INTEGER NOT NULL,
      total_trees INTEGER NOT NULL,
      total_value REAL NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const result = await db.runAsync(
    `INSERT OR IGNORE INTO seasons (name, year, crew_boss, table_name, daily_goal, season_goal) VALUES (?, ?, ?, ?, ?, ?)`,
    [name, year, crewBoss || '', tableName, dailyGoal ?? null, seasonGoal ?? null]
  );

  // If already exists, fetch existing id
  if (result.changes === 0) {
    const row = await db.getFirstAsync<{ id: number }>(
      `SELECT id FROM seasons WHERE table_name = ?`,
      [tableName]
    );
    return row!.id;
  }

  return result.lastInsertRowId;
}

export async function updateSeason(
  seasonId: number,
  name: string,
  year: number,
  crewBoss: string,
  dailyGoal?: number,
  seasonGoal?: number
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE seasons SET name = ?, year = ?, crew_boss = ?, daily_goal = ?, season_goal = ? WHERE id = ?`,
    [name, year, crewBoss || '', dailyGoal ?? null, seasonGoal ?? null, seasonId]
  );
}

export async function updateSeasonGoals(
  seasonId: number,
  dailyGoal?: number,
  seasonGoal?: number
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE seasons SET daily_goal = ?, season_goal = ? WHERE id = ?`,
    [dailyGoal ?? null, seasonGoal ?? null, seasonId]
  );
}

export async function getSeasons(): Promise<Season[]> {
  const db = await getDb();
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS seasons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      year INTEGER NOT NULL,
      table_name TEXT NOT NULL UNIQUE,
      daily_goal REAL,
      season_goal REAL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migration: add goal columns if they don't exist
  try {
    await db.execAsync(`ALTER TABLE seasons ADD COLUMN daily_goal REAL;`);
  } catch {}
  try {
    await db.execAsync(`ALTER TABLE seasons ADD COLUMN season_goal REAL;`);
  } catch {}

  return await db.getAllAsync<Season>(`SELECT * FROM seasons ORDER BY year DESC, name ASC`);
}

export async function deleteSeason(seasonId: number, tableName: string): Promise<void> {
  const db = await getDb();
  await db.execAsync(`PRAGMA foreign_keys = ON;`);
  await db.execAsync(`DROP TABLE IF EXISTS ${tableName}_extras;`);
  await db.execAsync(`DROP TABLE IF EXISTS ${tableName};`);
  await db.runAsync(`DELETE FROM seasons WHERE id = ?`, [seasonId]);
  // Force close and reopen to clear any cached table references
  _db = null;
}

// ─── Tally entries ────────────────────────────────────────────────────────────

export async function addEntry(tableName: string, entry: NewEntry): Promise<number> {
  const db = await getDb();
  const totalTrees = entry.bundleCount * entry.treesPerBundle;
  const totalValue = totalTrees * entry.pricePerTree;
  
  let createdAt: string;
  if (entry.time) {
    createdAt = `${entry.date} ${entry.time}`;
  } else {
    createdAt = new Date().toISOString().replace("T", " ").substring(0, 19);
  }
  
  const result = await db.runAsync(
    `INSERT INTO ${tableName}
       (date, planter_name, species, plot, cache, price_per_tree, bundle_count, trees_per_bundle, total_trees, total_value, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entry.date,
      entry.planterName,
      entry.species,
      entry.plot,
      entry.cache ?? "",
      entry.pricePerTree,
      entry.bundleCount,
      entry.treesPerBundle,
      totalTrees,
      totalValue,
      entry.notes ?? null,
      createdAt,
    ]
  );
  return result.lastInsertRowId;
}

export async function getEntriesForDay(tableName: string, date: string): Promise<TallyEntry[]> {
  const db = await getDb();
  // Migration: add cache column if it doesn't exist
  try {
    await db.execAsync(`ALTER TABLE ${tableName} ADD COLUMN cache TEXT NOT NULL DEFAULT '';`);
  } catch {}
  return await db.getAllAsync<TallyEntry>(
    `SELECT * FROM ${tableName} WHERE date = ? ORDER BY created_at DESC, id DESC`,
    [date]
  );
}

export async function getEntriesForSeason(tableName: string): Promise<TallyEntry[]> {
  const db = await getDb();
  // Migration: add cache column if it doesn't exist
  try {
    await db.execAsync(`ALTER TABLE ${tableName} ADD COLUMN cache TEXT NOT NULL DEFAULT '';`);
  } catch {}
  return await db.getAllAsync<TallyEntry>(
    `SELECT * FROM ${tableName} ORDER BY date ASC, created_at ASC`
  );
}

export async function getMostRecentEntry(tableName: string): Promise<TallyEntry | null> {
  const db = await getDb();
  // Migration: add cache column if it doesn't exist
  try {
    await db.execAsync(`ALTER TABLE ${tableName} ADD COLUMN cache TEXT NOT NULL DEFAULT '';`);
  } catch {}
  const result = await db.getFirstAsync<TallyEntry>(
    `SELECT * FROM ${tableName} ORDER BY date DESC, created_at DESC LIMIT 1`
  );
  return result ?? null;
}

export async function deleteEntry(tableName: string, entryId: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM ${tableName} WHERE id = ?`, [entryId]);
}

export async function deleteAllEntriesForDay(tableName: string, date: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM ${tableName} WHERE date = ?`, [date]);
  
  // Also delete extras for the day
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS ${tableName}_extras (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  await db.runAsync(`DELETE FROM ${tableName}_extras WHERE date = ?`, [date]);
}

export interface SeasonExtra {
  id: number;
  date: string;
  name: string;
  amount: number;
  created_at: string;
}

export async function addExtra(tableName: string, date: string, name: string, amount: number, timeStr?: string): Promise<number> {
  const db = await getDb();
  
  // Ensure extras table exists
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS ${tableName}_extras (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  
  let createdAt: string;
  if (timeStr) {
    createdAt = `${date} ${timeStr}`;
  } else {
    createdAt = new Date().toISOString().replace("T", " ").substring(0, 19);
  }
  
  const result = await db.runAsync(
    `INSERT INTO ${tableName}_extras (date, name, amount, created_at) VALUES (?, ?, ?, ?)`,
    [date, name, amount, createdAt]
  );
  return result.lastInsertRowId;
}

export async function deleteExtra(tableName: string, extraId: number): Promise<void> {
  const db = await getDb();
  
  // Ensure extras table exists
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS ${tableName}_extras (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  
  await db.runAsync(`DELETE FROM ${tableName}_extras WHERE id = ?`, [extraId]);
}

export async function updateExtra(
  tableName: string,
  extraId: number,
  name: string,
  amount: number,
  timeStr?: string
): Promise<void> {
  const db = await getDb();
  
  // Ensure extras table exists
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS ${tableName}_extras (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  
  if (timeStr) {
    await db.runAsync(
      `UPDATE ${tableName}_extras SET name = ?, amount = ?, created_at = ? WHERE id = ?`,
      [name, amount, timeStr, extraId]
    );
  } else {
    await db.runAsync(
      `UPDATE ${tableName}_extras SET name = ?, amount = ? WHERE id = ?`,
      [name, amount, extraId]
    );
  }
}

export async function getExtrasForDay(tableName: string, date: string): Promise<SeasonExtra[]> {
  const db = await getDb();
  
  // Ensure extras table exists
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS ${tableName}_extras (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  
  return await db.getAllAsync<SeasonExtra>(
    `SELECT * FROM ${tableName}_extras WHERE date = ? ORDER BY created_at DESC, id DESC`,
    [date]
  );
}

export async function getExtrasForSeason(tableName: string): Promise<SeasonExtra[]> {
  const db = await getDb();
  
  // Migration: add cache column if it doesn't exist
  try {
    await db.execAsync(`ALTER TABLE ${tableName} ADD COLUMN cache TEXT NOT NULL DEFAULT '';`);
  } catch {}
  
  // Ensure extras table exists
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS ${tableName}_extras (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  
  return await db.getAllAsync<SeasonExtra>(
    `SELECT * FROM ${tableName}_extras ORDER BY date ASC`
  );
}

export async function getExtraTotalForDay(tableName: string, date: string): Promise<number> {
  const db = await getDb();
  
  // Ensure extras table exists
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS ${tableName}_extras (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  
  const result = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) as total FROM ${tableName}_extras WHERE date = ?`,
    [date]
  );
  return result?.total ?? 0;
}

export async function updateEntry(tableName: string, entry: TallyEntry, timeStr?: string): Promise<void> {
  const db = await getDb();
  const totalTrees = entry.bundle_count * entry.trees_per_bundle;
  const totalValue = totalTrees * entry.price_per_tree;
  
  if (timeStr) {
    await db.runAsync(
      `UPDATE ${tableName} SET
         species = ?, plot = ?, cache = ?, price_per_tree = ?, bundle_count = ?,
         trees_per_bundle = ?, total_trees = ?, total_value = ?, notes = ?, created_at = ?
       WHERE id = ?`,
      [
        entry.species,
        entry.plot,
        entry.cache ?? "",
        entry.price_per_tree,
        entry.bundle_count,
        entry.trees_per_bundle,
        totalTrees,
        totalValue,
        entry.notes ?? null,
        timeStr,
        entry.id,
      ]
    );
  } else {
    await db.runAsync(
      `UPDATE ${tableName} SET
         species = ?, plot = ?, cache = ?, price_per_tree = ?, bundle_count = ?,
         trees_per_bundle = ?, total_trees = ?, total_value = ?, notes = ?
       WHERE id = ?`,
      [
        entry.species,
        entry.plot,
        entry.cache ?? "",
        entry.price_per_tree,
        entry.bundle_count,
        entry.trees_per_bundle,
        totalTrees,
        totalValue,
        entry.notes ?? null,
        entry.id,
      ]
    );
  }
}

// ─── Aggregates ───────────────────────────────────────────────────────────────

export async function getDailySummary(tableName: string, date: string): Promise<DailySummary> {
  const db = await getDb();
  
  // Ensure extras table exists
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS ${tableName}_extras (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  
  const totals = await db.getFirstAsync<{ 
    total_trees: number; 
    total_value: number;
    entry_count: number;
    total_bundles: number;
  }>(
    `SELECT 
       COALESCE(SUM(total_trees), 0) as total_trees, 
       COALESCE(SUM(total_value), 0) as total_value,
       COUNT(*) as entry_count,
       COALESCE(SUM(bundle_count), 0) as total_bundles
     FROM ${tableName} WHERE date = ?`,
    [date]
  );
  const extras = await db.getFirstAsync<{ extra_total: number; extra_count: number }>(
    `SELECT COALESCE(SUM(amount), 0) as extra_total, COUNT(*) as extra_count FROM ${tableName}_extras WHERE date = ?`,
    [date]
  );
  const extraTotal = extras?.extra_total ?? 0;
  const extraCount = extras?.extra_count ?? 0;
  
  // Calculate average bag-up time between entries
  const entryTimes = await db.getAllAsync<{ created_at: string }>(
    `SELECT created_at FROM ${tableName} WHERE date = ? ORDER BY created_at ASC`,
    [date]
  );
  let avgBagUpMinutes = 0;
  if (entryTimes.length > 1) {
    let totalMinutes = 0;
    let count = 0;
    for (let i = 1; i < entryTimes.length; i++) {
      const prevTime = new Date(entryTimes[i - 1].created_at).getTime();
      const currTime = new Date(entryTimes[i].created_at).getTime();
      const diffMinutes = (currTime - prevTime) / (1000 * 60);
      totalMinutes += diffMinutes;
      count++;
    }
    avgBagUpMinutes = count > 0 ? Math.round(totalMinutes / count) : 0;
  }
  
  const bySpecies = await db.getAllAsync<{ species: string; trees: number; value: number }>(
    `SELECT species, SUM(total_trees) as trees, SUM(total_value) as value
     FROM ${tableName} WHERE date = ? GROUP BY species ORDER BY trees DESC`,
    [date]
  );
  const byPlot = await db.getAllAsync<{ plot: string; trees: number; value: number }>(
    `SELECT plot, SUM(total_trees) as trees, SUM(total_value) as value
     FROM ${tableName} WHERE date = ? GROUP BY plot ORDER BY trees DESC`,
    [date]
  );
  const extrasByName = await db.getAllAsync<{ name: string; amount: number }>(
    `SELECT name, SUM(amount) as amount
     FROM ${tableName}_extras WHERE date = ? GROUP BY name ORDER BY amount DESC`,
    [date]
  );
  
  // Get cache data - use dedicated cache column
  const byCache = await db.getAllAsync<{ cache: string; trees: number; value: number }>(
    `SELECT cache, SUM(total_trees) as trees, SUM(total_value) as value
     FROM ${tableName} 
     WHERE date = ? AND cache IS NOT NULL AND cache != ''
     GROUP BY cache
     ORDER BY trees DESC`,
    [date]
  );
  
  const treeValue = totals?.total_value ?? 0;
  const entryCount = totals?.entry_count ?? 0;
  
  return {
    date,
    totalTrees: totals?.total_trees ?? 0,
    totalValue: treeValue + extraTotal,
    totalTreeValue: treeValue,
    totalExtra: extraTotal,
    entryCount,
    extraCount,
    totalBundles: totals?.total_bundles ?? 0,
    avgTreesPerEntry: entryCount > 0 ? (totals?.total_trees ?? 0) / entryCount : 0,
    avgValuePerEntry: entryCount > 0 ? treeValue / entryCount : 0,
    avgBagUpMinutes,
    bySpecies,
    byPlot,
    byCache,
    extrasByName,
  };
}

export async function getSeasonSummary(tableName: string): Promise<SeasonSummary> {
  const db = await getDb();
  
  // Migration: add cache column if it doesn't exist
  try {
    await db.execAsync(`ALTER TABLE ${tableName} ADD COLUMN cache TEXT NOT NULL DEFAULT '';`);
  } catch {}
  
  // Ensure extras table exists
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS ${tableName}_extras (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  
  const totals = await db.getFirstAsync<{ total_trees: number; total_value: number; days: number }>(
    `SELECT SUM(total_trees) as total_trees, SUM(total_value) as total_value,
            COUNT(DISTINCT date) as days
     FROM ${tableName}`
  );
  const extras = await db.getFirstAsync<{ extra_total: number }>(
    `SELECT COALESCE(SUM(amount), 0) as extra_total FROM ${tableName}_extras`
  );
  const extraTotal = extras?.extra_total ?? 0;
  const byDay = await db.getAllAsync<{ date: string; trees: number; value: number; extra: number }>(
    `SELECT 
       COALESCE(t.date, e.date) as date,
       COALESCE(t.trees, 0) as trees,
       COALESCE(t.value, 0) + COALESCE(e.extra, 0) as value,
       COALESCE(e.extra, 0) as extra
     FROM (
       SELECT date, SUM(total_trees) as trees, SUM(total_value) as value
       FROM ${tableName} GROUP BY date
     ) t
     FULL OUTER JOIN (
       SELECT date, SUM(amount) as extra FROM ${tableName}_extras GROUP BY date
     ) e ON t.date = e.date
     ORDER BY date ASC`
  );
  return {
    totalTrees: totals?.total_trees ?? 0,
    totalValue: (totals?.total_value ?? 0) + extraTotal,
    totalExtra: extraTotal,
    totalDays: totals?.days ?? 0,
    byDay,
  };
}

export interface GlobalStats {
  totalTrees: number;
  totalValue: number;
  totalSeasons: number;
  totalDays: number;
}

export async function getGlobalStats(): Promise<GlobalStats> {
  const db = await getDb();
  const seasons = await db.getAllAsync<Season>(`SELECT * FROM seasons`);
  
  let totalTrees = 0;
  let totalValue = 0;
  let totalDays = 0;

  for (const season of seasons) {
    // Ensure extras table exists
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS ${season.table_name}_extras (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        name TEXT NOT NULL,
        amount REAL NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    
    const stats = await db.getFirstAsync<{ trees: number; value: number; days: number }>(
      `SELECT COALESCE(SUM(total_trees), 0) as trees, 
              COALESCE(SUM(total_value), 0) as value,
              COUNT(DISTINCT date) as days
       FROM ${season.table_name}`
    );
    const extras = await db.getFirstAsync<{ extra: number }>(
      `SELECT COALESCE(SUM(amount), 0) as extra FROM ${season.table_name}_extras`
    );
    totalTrees += stats?.trees ?? 0;
    totalValue += (stats?.value ?? 0) + (extras?.extra ?? 0);
    totalDays += stats?.days ?? 0;
  }

  return {
    totalTrees,
    totalValue,
    totalSeasons: seasons.length,
    totalDays,
  };
}

// ─── User Settings ────────────────────────────────────────────────────────────

export async function getUserSettings(): Promise<UserSettings> {
  const db = await getDb();
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS user_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT NOT NULL DEFAULT '',
      default_price_per_tree REAL DEFAULT 0.20,
      default_trees_per_bundle INTEGER DEFAULT 50,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  const settings = await db.getFirstAsync<UserSettings>(`SELECT * FROM user_settings WHERE id = 1`);
  if (!settings) {
    await db.runAsync(`INSERT INTO user_settings (id, name) VALUES (1, '')`);
    return {
      id: 1,
      name: "",
      default_price_per_tree: 0.2,
      default_trees_per_bundle: 50,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
  return settings;
}

export async function updateUserSettings(
  name?: string,
  defaultPricePerTree?: number,
  defaultTreesPerBundle?: number
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE user_settings SET 
      name = COALESCE(?, name),
      default_price_per_tree = COALESCE(?, default_price_per_tree),
      default_trees_per_bundle = COALESCE(?, default_trees_per_bundle),
      updated_at = datetime('now')
    WHERE id = 1`,
    [name ?? null, defaultPricePerTree ?? null, defaultTreesPerBundle ?? null]
  );
}

// ─── Species Catalog ─────────────────────────────────────────────────────────

export async function getSpeciesCatalog(): Promise<Species[]> {
  const db = await getDb();
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS species_catalog (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      request_key TEXT,
      bundle_size INTEGER DEFAULT 15,
      box_total_trees INTEGER DEFAULT 360,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migration: add new columns if they don't exist (for existing databases)
  try {
    await db.execAsync(`ALTER TABLE species_catalog ADD COLUMN request_key TEXT;`);
  } catch {}
  try {
    await db.execAsync(`ALTER TABLE seasons ADD COLUMN season_goal REAL;`);
  } catch {}
  try {
    await db.execAsync(`ALTER TABLE seasons ADD COLUMN crew_boss TEXT NOT NULL DEFAULT '';`);
  } catch {}
  try {
    await db.execAsync(`ALTER TABLE species_catalog ADD COLUMN box_total_trees INTEGER DEFAULT 360;`);
  } catch {}

  // Seed default species if empty
  const count = await db.getFirstAsync<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM species_catalog`);
  if (count && count.cnt === 0) {
    const defaultSpecies = [
      { name: "Black Spruce", request_key: "BLS", bundle_size: 15, box_total_trees: 360 },
      { name: "Jack Pine", request_key: "JP", bundle_size: 15, box_total_trees: 360 },
      { name: "White Spruce", request_key: "WS", bundle_size: 15, box_total_trees: 360 },
      { name: "Balsam Fir", request_key: "BF", bundle_size: 15, box_total_trees: 360 },
      { name: "Tamarack", request_key: "TAM", bundle_size: 15, box_total_trees: 360 },
      { name: "Lodgepole Pine", request_key: "LP", bundle_size: 15, box_total_trees: 360 },
    ];
    for (const s of defaultSpecies) {
      await db.runAsync(
        `INSERT INTO species_catalog (name, request_key, bundle_size, box_total_trees) VALUES (?, ?, ?, ?)`,
        [s.name, s.request_key, s.bundle_size, s.box_total_trees]
      );
    }
  }

  return await db.getAllAsync<Species>(`SELECT * FROM species_catalog ORDER BY name ASC`);
}

export async function addSpeciesToCatalog(
  name: string,
  requestKey?: string,
  bundleSize?: number,
  boxTotalTrees?: number
): Promise<number> {
  const db = await getDb();
  const result = await db.runAsync(
    `INSERT OR IGNORE INTO species_catalog (name, request_key, bundle_size, box_total_trees) VALUES (?, ?, ?, ?)`,
    [name.trim(), requestKey?.trim() ?? null, bundleSize ?? 15, boxTotalTrees ?? 360]
  );
  return result.lastInsertRowId;
}

export async function updateSpeciesInCatalog(
  speciesId: number,
  name: string,
  requestKey?: string,
  bundleSize?: number,
  boxTotalTrees?: number
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE species_catalog SET name = ?, request_key = ?, bundle_size = ?, box_total_trees = ? WHERE id = ?`,
    [name.trim(), requestKey?.trim() ?? null, bundleSize ?? 15, boxTotalTrees ?? 360, speciesId]
  );
}

export async function deleteSpeciesFromCatalog(speciesId: number): Promise<void> {
  const db = await getDb();
  await db.runAsync(`DELETE FROM species_catalog WHERE id = ?`, [speciesId]);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Season {
  id: number;
  name: string;
  year: number;
  crew_boss: string;
  table_name: string;
  daily_goal: number | null;
  season_goal: number | null;
  created_at: string;
}

export interface UserSettings {
  id: number;
  name: string;
  default_price_per_tree: number;
  default_trees_per_bundle: number;
  created_at: string;
  updated_at: string;
}

export interface Species {
  id: number;
  name: string;
  request_key: string | null;
  bundle_size: number;
  box_total_trees: number;
  created_at: string;
}

export interface TallyEntry {
  id: number;
  date: string;
  planter_name: string;
  species: string;
  plot: string;
  cache: string;
  price_per_tree: number;
  bundle_count: number;
  trees_per_bundle: number;
  total_trees: number;
  total_value: number;
  notes: string | null;
  created_at: string;
}

export interface NewEntry {
  date: string;
  planterName: string;
  species: string;
  plot: string;
  cache?: string;
  pricePerTree: number;
  bundleCount: number;
  treesPerBundle: number;
  notes?: string;
  time?: string;
}

export interface DailySummary {
  date: string;
  totalTrees: number;
  totalValue: number;
  totalTreeValue: number;
  totalExtra?: number;
  entryCount: number;
  extraCount: number;
  totalBundles: number;
  avgTreesPerEntry: number;
  avgValuePerEntry: number;
  avgBagUpMinutes: number;
  bySpecies: { species: string; trees: number; value: number }[];
  byPlot: { plot: string; trees: number; value: number }[];
  byCache: { cache: string; trees: number; value: number }[];
  extrasByName: { name: string; amount: number }[];
}

export interface SeasonSummary {
  totalTrees: number;
  totalValue: number;
  totalExtra?: number;
  totalDays: number;
  byDay: { date: string; trees: number; value: number; extra: number }[];
}

// ─── Import/Backup interfaces ──────────────────────────────────────────────────

export interface BackupSeason {
  name: string;
  year: number;
  table_name: string;
  daily_goal: number | null;
  season_goal: number | null;
  created_at: string;
  entries: TallyEntry[];
  extras: SeasonExtra[];
}

export interface BackupFile {
  export_version: string;
  exported_at: string;
  seasons: BackupSeason[];
}

// ─── Import functions ─────────────────────────────────────────────────────────

export async function importSeason(backup: BackupSeason): Promise<number> {
  const db = await getDb();
  
  // Create a unique table name if the one from backup already exists
  let tableName = `season_${backup.name.replace(/[^a-zA-Z0-9]/g, "_")}_${backup.year}`;
  let suffix = 0;
  
  while (true) {
    const existing = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) as count FROM seasons WHERE table_name = ?`,
      [tableName]
    );
    if (!existing || existing.count === 0) break;
    suffix++;
    tableName = `season_${backup.name.replace(/[^a-zA-Z0-9]/g, "_")}_${backup.year}_${suffix}`;
  }

  // Create the season tables
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS ${tableName} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      planter_name TEXT NOT NULL,
      species TEXT NOT NULL,
      plot TEXT NOT NULL,
      cache TEXT,
      price_per_tree REAL NOT NULL,
      bundle_count INTEGER NOT NULL,
      trees_per_bundle INTEGER NOT NULL,
      total_trees INTEGER NOT NULL,
      total_value REAL NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS ${tableName}_extras (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Insert season record
  const result = await db.runAsync(
    `INSERT INTO seasons (name, year, crew_boss, table_name, daily_goal, season_goal, created_at) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [backup.name, backup.year, backup.table_name.includes("imported_") ? "Imported" : "", tableName, backup.daily_goal, backup.season_goal, backup.created_at]
  );

  const seasonId = result.lastInsertRowId;

  // Insert entries
  for (const entry of backup.entries) {
    await db.runAsync(
      `INSERT INTO ${tableName} (date, planter_name, species, plot, cache, price_per_tree, bundle_count, trees_per_bundle, total_trees, total_value, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [entry.date, entry.planter_name, entry.species, entry.plot, entry.cache || null, entry.price_per_tree, entry.bundle_count, entry.trees_per_bundle, entry.total_trees, entry.total_value, entry.notes, entry.created_at]
    );
  }

  // Insert extras
  for (const extra of backup.extras) {
    await db.runAsync(
      `INSERT INTO ${tableName}_extras (date, name, amount, created_at) VALUES (?, ?, ?, ?)`,
      [extra.date, extra.name, extra.amount, extra.created_at]
    );
  }

  return seasonId;
}

export async function checkSeasonExists(tableName: string): Promise<boolean> {
  const db = await getDb();
  const existing = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM seasons WHERE table_name = ?`,
    [tableName]
  );
  return (existing?.count ?? 0) > 0;
}
