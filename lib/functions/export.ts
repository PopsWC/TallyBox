import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { TallyEntry, DailySummary, Season } from "../database";

// ─── JSON export (importable by companion crew-boss app) ──────────────────────

export interface ExportPayload {
  export_version: "1.0";
  export_type: "daily" | "season";
  exported_at: string;
  season: { name: string; year: number; table_name: string };
  date?: string; // daily only
  summary: {
    total_trees: number;
    total_value: number;
    by_species: { species: string; trees: number; value: number }[];
    by_plot: { plot: string; trees: number; value: number }[];
  };
  entries: {
    id: number;
    date: string;
    planter_name: string;
    species: string;
    plot: string;
    cache: string | null;
    price_per_tree: number;
    bundle_count: number;
    trees_per_bundle: number;
    total_trees: number;
    total_value: number;
    notes: string | null;
    created_at: string;
  }[];
}

export function buildDailyExportPayload(
  season: Season,
  summary: DailySummary,
  entries: TallyEntry[]
): ExportPayload {
  return {
    export_version: "1.0",
    export_type: "daily",
    exported_at: new Date().toISOString(),
    season: { name: season.name, year: season.year, table_name: season.table_name },
    date: summary.date,
    summary: {
      total_trees: summary.totalTrees,
      total_value: summary.totalValue,
      by_species: summary.bySpecies,
      by_plot: summary.byPlot,
    },
    entries: entries.map((e) => ({
      id: e.id,
      date: e.date,
      planter_name: e.planter_name,
      species: e.species,
      plot: e.plot,
      cache: e.cache || null,
      price_per_tree: e.price_per_tree,
      bundle_count: e.bundle_count,
      trees_per_bundle: e.trees_per_bundle,
      total_trees: e.total_trees,
      total_value: e.total_value,
      notes: e.notes,
      created_at: e.created_at,
    })),
  };
}

export function buildSeasonExportPayload(
  season: Season,
  entries: TallyEntry[]
): ExportPayload {
  const totalTrees = entries.reduce((s, e) => s + e.total_trees, 0);
  const totalValue = entries.reduce((s, e) => s + e.total_value, 0);

  const speciesMap: Record<string, { trees: number; value: number }> = {};
  const plotMap: Record<string, { trees: number; value: number }> = {};

  for (const e of entries) {
    if (!speciesMap[e.species]) speciesMap[e.species] = { trees: 0, value: 0 };
    speciesMap[e.species].trees += e.total_trees;
    speciesMap[e.species].value += e.total_value;

    if (!plotMap[e.plot]) plotMap[e.plot] = { trees: 0, value: 0 };
    plotMap[e.plot].trees += e.total_trees;
    plotMap[e.plot].value += e.total_value;
  }

  return {
    export_version: "1.0",
    export_type: "season",
    exported_at: new Date().toISOString(),
    season: { name: season.name, year: season.year, table_name: season.table_name },
    summary: {
      total_trees: totalTrees,
      total_value: totalValue,
      by_species: Object.entries(speciesMap)
        .map(([species, v]) => ({ species, ...v }))
        .sort((a, b) => b.trees - a.trees),
      by_plot: Object.entries(plotMap)
        .map(([plot, v]) => ({ plot, ...v }))
        .sort((a, b) => b.trees - a.trees),
    },
    entries: entries.map((e) => ({
      id: e.id,
      date: e.date,
      planter_name: e.planter_name,
      species: e.species,
      plot: e.plot,
      cache: e.cache || null,
      price_per_tree: e.price_per_tree,
      bundle_count: e.bundle_count,
      trees_per_bundle: e.trees_per_bundle,
      total_trees: e.total_trees,
      total_value: e.total_value,
      notes: e.notes,
      created_at: e.created_at,
    })),
  };
}

// ─── CSV generation ───────────────────────────────────────────────────────────

function escapeCsv(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return "";
  const s = String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function buildCsv(entries: TallyEntry[], includeHeader = true): string {
  const header = [
    "date",
    "time",
    "planter_name",
    "species",
    "plot",
    "cache",
    "bundle_count",
    "trees_per_bundle",
    "total_trees",
    "price_per_tree",
    "total_value",
    "notes",
  ];

  const rows = entries.map((e) => {
    const timePart = e.created_at ? e.created_at.split(" ")[1]?.substring(0, 5) || "" : "";
    return [
      e.date,
      timePart,
      e.planter_name,
      e.species,
      e.plot,
      e.cache || "",
      e.bundle_count,
      e.trees_per_bundle,
      e.total_trees,
      e.price_per_tree.toFixed(2),
      e.total_value.toFixed(2),
      e.notes ?? "",
    ]
      .map(escapeCsv)
      .join(",");
  });

  return includeHeader ? [header.join(","), ...rows].join("\n") : rows.join("\n");
}

// ─── Share helpers ─────────────────────────────────────────────────────────────

async function shareFile(content: string, filename: string, mimeType: string) {
  const file = new File(Paths.cache, filename);
  await file.write(content);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: `Share ${filename}` });
  } else {
    throw new Error("Sharing is not available on this device.");
  }
}

export async function shareDailyJson(
  season: Season,
  summary: DailySummary,
  entries: TallyEntry[]
) {
  const payload = buildDailyExportPayload(season, summary, entries);
  const filename = `treetally_${season.table_name}_${summary.date}.json`;
  await shareFile(JSON.stringify(payload, null, 2), filename, "application/json");
}

export async function shareDailyCsv(entries: TallyEntry[], season: Season, date: string) {
  const csv = buildCsv(entries);
  const filename = `treetally_${season.table_name}_${date}.csv`;
  await shareFile(csv, filename, "text/csv");
}

export async function shareSeasonJson(season: Season, entries: TallyEntry[]) {
  const payload = buildSeasonExportPayload(season, entries);
  const filename = `treetally_season_${season.table_name}.json`;
  await shareFile(JSON.stringify(payload, null, 2), filename, "application/json");
}

export async function shareSeasonCsv(season: Season, entries: TallyEntry[]) {
  const csv = buildCsv(entries);
  const filename = `treetally_season_${season.table_name}.csv`;
  await shareFile(csv, filename, "text/csv");
}
