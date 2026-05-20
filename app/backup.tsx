import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Alert,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import * as XLSX from "xlsx";
import {
  getSeasons,
  getEntriesForSeason,
  getExtrasForSeason,
  Season,
  SeasonExtra,
  TallyEntry,
  importSeason,
  BackupFile,
} from "@/lib/database";
import { Button } from "@/components/ui";
import { Colors, Typography, Spacing, Radius, globalStyles } from "@/lib/theme";

interface SelectedSeason {
  season: Season;
  entries: TallyEntry[];
  extras: SeasonExtra[];
}

type ExportFormat = "json" | "csv" | "xlsx";
type ExportStyle = "single" | "multiple";

export default function BackupScreen() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasons, setSelectedSeasons] = useState<Set<number>>(new Set());
  const [selectedData, setSelectedData] = useState<Map<number, SelectedSeason>>(new Map());
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [format, setFormat] = useState<ExportFormat>("xlsx");
  const [exportStyle, setExportStyle] = useState<ExportStyle>("single");

  const loadSeasons = useCallback(async () => {
    const data = await getSeasons();
    setSeasons(data);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSeasons();
    }, [loadSeasons])
  );

  const handleImport = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const file = result.assets[0];
      if (!file.uri) {
        Alert.alert("Error", "Could not read the selected file.");
        return;
      }

      setImporting(true);

      const selectedFile = new File(file.uri);
      const content = await selectedFile.text();
      let backup: BackupFile;

      try {
        backup = JSON.parse(content);
      } catch {
        Alert.alert("Invalid File", "The selected file is not a valid JSON backup.");
        setImporting(false);
        return;
      }

      if (!backup.seasons || !Array.isArray(backup.seasons)) {
        Alert.alert("Invalid File", "The backup file has an invalid structure.");
        setImporting(false);
        return;
      }

      const seasonCount = backup.seasons.length;
      Alert.alert(
        "Import Backup",
        `This backup contains ${seasonCount} season${seasonCount !== 1 ? "s" : ""}. Do you want to import them?`,
        [
          { text: "Cancel", style: "cancel", onPress: () => setImporting(false) },
          {
            text: "Import",
            onPress: async () => {
              let imported = 0;
              let skipped = 0;

              for (const season of backup.seasons) {
                try {
                  await importSeason(season);
                  imported++;
                } catch (e) {
                  console.error("Failed to import season:", season.name, e);
                  skipped++;
                }
              }

              setImporting(false);
              await loadSeasons();

              if (skipped > 0) {
                Alert.alert(
                  "Import Complete",
                  `Imported ${imported} season${imported !== 1 ? "s" : ""}. ${skipped} season${skipped !== 1 ? "s" : ""} could not be imported.`
                );
              } else {
                Alert.alert("Success", `Imported ${imported} season${imported !== 1 ? "s" : ""}.`);
              }
            },
          },
        ]
      );
    } catch (e) {
      setImporting(false);
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to import backup.");
    }
  };

  const handleToggleSeason = async (season: Season) => {
    const newSelected = new Set(selectedSeasons);
    const newData = new Map(selectedData);

    if (newSelected.has(season.id)) {
      newSelected.delete(season.id);
      newData.delete(season.id);
    } else {
      newSelected.add(season.id);
      const [entries, extras] = await Promise.all([
        getEntriesForSeason(season.table_name),
        getExtrasForSeason(season.table_name),
      ]);
      newData.set(season.id, { season, entries, extras });
    }

    setSelectedSeasons(newSelected);
    setSelectedData(newData);
  };

  const handleSelectAll = async () => {
    if (selectedSeasons.size === seasons.length) {
      setSelectedSeasons(new Set());
      setSelectedData(new Map());
    } else {
      const newSelected = new Set<number>();
      const newData = new Map<number, SelectedSeason>();

      for (const season of seasons) {
        newSelected.add(season.id);
        const [entries, extras] = await Promise.all([
          getEntriesForSeason(season.table_name),
          getExtrasForSeason(season.table_name),
        ]);
        newData.set(season.id, { season, entries, extras });
      }

      setSelectedSeasons(newSelected);
      setSelectedData(newData);
    }
  };

  const handleExport = async () => {
    if (selectedSeasons.size === 0) {
      Alert.alert("No Seasons Selected", "Please select at least one season to export.");
      return;
    }

    setExporting(true);
    try {
      const timestamp = new Date().toISOString().split("T")[0];
      const timestampFile = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

      switch (format) {
        case "json":
          await exportAsJson(timestampFile);
          break;
        case "csv":
          await exportAsCsv(timestamp, exportStyle);
          break;
        case "xlsx":
          await exportAsXlsx(timestamp, exportStyle);
          break;
      }
    } catch (e: unknown) {
      Alert.alert("Export Error", e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const exportAsJson = async (timestamp: string) => {
    const backup = {
      export_version: "1.0",
      exported_at: new Date().toISOString(),
      seasons: [] as {
        name: string;
        year: number;
        table_name: string;
        daily_goal: number | null;
        season_goal: number | null;
        created_at: string;
        entries: TallyEntry[];
        extras: SeasonExtra[];
      }[],
    };

    for (const seasonId of selectedSeasons) {
      const data = selectedData.get(seasonId);
      if (data) {
        backup.seasons.push({
          name: data.season.name,
          year: data.season.year,
          table_name: data.season.table_name,
          daily_goal: data.season.daily_goal,
          season_goal: data.season.season_goal,
          created_at: data.season.created_at,
          entries: data.entries,
          extras: data.extras,
        });
      }
    }

    const filename = `treetally_backup_${timestamp}.json`;
    const file = new File(Paths.cache, filename);
    await file.write(JSON.stringify(backup, null, 2));

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(file.uri, {
        mimeType: "application/json",
        dialogTitle: "Share Backup",
      });
    }
  };

  const exportAsCsv = async (timestamp: string, style: ExportStyle) => {
    if (style === "multiple") {
      // Export one file per season
      for (const seasonId of selectedSeasons) {
        const data = selectedData.get(seasonId);
        if (data) {
          const csvContent = generateCleanCsv(data.entries, data.extras, data.season);
          const filename = `treetally_${data.season.table_name}_${timestamp}.csv`;
          const file = new File(Paths.cache, filename);
          await file.write(csvContent);
          await Sharing.shareAsync(file.uri, {
            mimeType: "text/csv",
            dialogTitle: `Share ${data.season.name} CSV`,
          });
        }
      }
    } else {
      // Single combined file
      let csvContent = "";
      const firstData = selectedData.get(Array.from(selectedSeasons)[0]);
      
      if (selectedSeasons.size === 1 && firstData) {
        csvContent = generateCleanCsv(firstData.entries, firstData.extras, firstData.season);
      } else {
        csvContent = generateMultiSeasonCsv();
      }

      const filename = `treetally_export_${timestamp}.csv`;
      const file = new File(Paths.cache, filename);
      await file.write(csvContent);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: "text/csv",
          dialogTitle: "Share CSV",
        });
      }
    }
  };

  const exportAsXlsx = async (timestamp: string, style: ExportStyle) => {
    if (style === "multiple") {
      // Export one file per season
      for (const seasonId of selectedSeasons) {
        const data = selectedData.get(seasonId);
        if (data) {
          const workbook = generateXlsxWorkbook(data.season, data.entries, data.extras);
          const filename = `treetally_${data.season.table_name}_${timestamp}.xlsx`;
          const file = new File(Paths.cache, filename);
          const xlsxData = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
          await file.write(xlsxData);
          await Sharing.shareAsync(file.uri, {
            mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            dialogTitle: `Share ${data.season.name} Spreadsheet`,
          });
        }
      }
    } else {
      // Single file with all seasons
      const workbook = generateMultiSeasonXlsx();
      const filename = `treetally_export_${timestamp}.xlsx`;
      const file = new File(Paths.cache, filename);
      const xlsxData = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
      await file.write(xlsxData);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri, {
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          dialogTitle: "Share Spreadsheet",
        });
      }
    }
  };

  const generateCleanCsv = (
    entries: TallyEntry[],
    extras: SeasonExtra[],
    season: Season
  ): string => {
    // Header info (as comments at top)
    let content = `# TallyBox Export - ${season.name} ${season.year}\n`;
    content += `# Exported: ${new Date().toLocaleString()}\n`;
    content += `# Season Goal: ${season.season_goal ? `$${season.season_goal}` : "Not set"}\n`;
    content += `# Daily Goal: ${season.daily_goal ? `$${season.daily_goal}` : "Not set"}\n\n`;

    // Entries section
    const entryHeaders = ["Date", "Time", "Planter", "Species", "Block", "Cache", "Bundles", "Trees/Bundle", "Total Trees", "Price/Tree", "Total Value", "Notes"];
    content += entryHeaders.join(",") + "\n";

    for (const e of entries) {
      const timePart = e.created_at ? e.created_at.split(" ")[1]?.substring(0, 5) || "" : "";
      const row = [
        e.date,
        timePart,
        `"${e.planter_name}"`,
        `"${e.species}"`,
        `"${e.plot}"`,
        `"${e.cache || ""}"`,
        e.bundle_count,
        e.trees_per_bundle,
        e.total_trees,
        e.price_per_tree.toFixed(4),
        e.total_value.toFixed(2),
        `"${e.notes || ""}"`,
      ];
      content += row.join(",") + "\n";
    }

    // Totals row for entries
    const totalTrees = entries.reduce((sum, e) => sum + e.total_trees, 0);
    const totalValue = entries.reduce((sum, e) => sum + e.total_value, 0);
    content += `\n`;
    content += `,,,,,,,${totalTrees},,${totalValue.toFixed(2)}\n`;

    // Extras section
    if (extras.length > 0) {
      content += `\n`;
      content += `EXTRA EARNINGS\n`;
      const extraHeaders = ["Date", "Time", "Name", "Amount"];
      content += extraHeaders.join(",") + "\n";
      for (const ex of extras) {
        const timePart = ex.created_at ? ex.created_at.split(" ")[1]?.substring(0, 5) || "" : "";
        content += `${ex.date},${timePart},"${ex.name}",${ex.amount.toFixed(2)}\n`;
      }
      // Extras total
      const extraTotal = extras.reduce((sum, e) => sum + e.amount, 0);
      content += `,,,,${extraTotal.toFixed(2)}\n`;
    }

    return content;
  };

  const generateMultiSeasonCsv = (): string => {
    let content = `# TallyBox Multi-Season Export\n`;
    content += `# Exported: ${new Date().toLocaleString()}\n\n`;

    for (const seasonId of selectedSeasons) {
      const data = selectedData.get(seasonId);
      if (data) {
        const seasonTotal = data.entries.reduce((sum, e) => sum + e.total_value, 0) + data.extras.reduce((sum, e) => sum + e.amount, 0);
        const seasonTrees = data.entries.reduce((sum, e) => sum + e.total_trees, 0);
        
        content += `SEASON: ${data.season.name} ${data.season.year}\n`;
        content += `Dates: ${data.entries.length > 0 ? data.entries[0].date : "N/A"} to ${data.entries.length > 0 ? data.entries[data.entries.length - 1].date : "N/A"}\n`;
        content += `Total Trees: ${seasonTrees}\n`;
        content += `Total Value: $${seasonTotal.toFixed(2)}\n`;
        content += `Entries: ${data.entries.length} | Extras: ${data.extras.length}\n`;
        content += `\n`;

        const entryHeaders = ["Date", "Species", "Block", "Cache", "Total Trees", "Total Value"];
        content += entryHeaders.join(",") + "\n";
        for (const e of data.entries) {
          content += `${e.date},${e.species},${e.plot},${e.cache || ""},${e.total_trees},${e.total_value.toFixed(2)}\n`;
        }
        content += `\n`;
      }
    }

    return content;
  };

  const generateXlsxWorkbook = (
    season: Season,
    entries: TallyEntry[],
    extras: SeasonExtra[]
  ): XLSX.WorkBook => {
    const workbook = XLSX.utils.book_new();
    const seasonTotal = entries.reduce((sum, e) => sum + e.total_value, 0) + extras.reduce((sum, e) => sum + e.amount, 0);
    const seasonTrees = entries.reduce((sum, e) => sum + e.total_trees, 0);

    // Summary Sheet
    const summaryData = [
      ["TallyBox Season Summary"],
      [],
      ["Season", `${season.name} ${season.year}`],
      ["Crew Boss", season.crew_boss || "N/A"],
      ["Year", season.year],
      ["Created", new Date(season.created_at).toLocaleDateString()],
      [],
      ["Goals"],
      ["Daily Goal", season.daily_goal ? `$${season.daily_goal.toFixed(2)}` : "Not set"],
      ["Season Goal", season.season_goal ? `$${season.season_goal.toFixed(2)}` : "Not set"],
      [],
      ["Totals"],
      ["Total Trees", seasonTrees],
      ["Total Entries", entries.length],
      ["Total Extra Earnings", `$${extras.reduce((sum, e) => sum + e.amount, 0).toFixed(2)}`],
      ["Total Tree Value", `$${entries.reduce((sum, e) => sum + e.total_value, 0).toFixed(2)}`],
      ["Total Earnings", `$${seasonTotal.toFixed(2)}`],
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    summarySheet["!cols"] = [{ wch: 20 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

    // Daily Summary Sheet
    const dailyData: (string | number)[][] = [["Date", "Trees", "Value", "Extras", "Total"]];
    const byDay = new Map<string, { trees: number; value: number; extras: number }>();
    
    for (const e of entries) {
      const existing = byDay.get(e.date) || { trees: 0, value: 0, extras: 0 };
      existing.trees += e.total_trees;
      existing.value += e.total_value;
      byDay.set(e.date, existing);
    }
    for (const ex of extras) {
      const existing = byDay.get(ex.date) || { trees: 0, value: 0, extras: 0 };
      existing.extras += ex.amount;
      byDay.set(ex.date, existing);
    }
    
    const sortedDays = Array.from(byDay.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    for (const [date, data] of sortedDays) {
      dailyData.push([date, data.trees, data.value, data.extras, data.value + data.extras]);
    }
    
    const dailySheet = XLSX.utils.aoa_to_sheet(dailyData);
    dailySheet["!cols"] = [{ wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 10 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(workbook, dailySheet, "Daily Summary");

    // Entries Sheet
    const entriesData: (string | number)[][] = [["Date", "Time", "Planter", "Species", "Block", "Cache", "Bundles", "Trees/Bundle", "Total Trees", "Price/Tree", "Total Value", "Notes"]];
    for (const e of entries) {
      const timePart = e.created_at ? e.created_at.split(" ")[1]?.substring(0, 5) || "" : "";
      entriesData.push([
        e.date,
        timePart,
        e.planter_name,
        e.species,
        e.plot,
        e.cache || "",
        e.bundle_count,
        e.trees_per_bundle,
        e.total_trees,
        e.price_per_tree,
        e.total_value,
        e.notes || "",
      ]);
    }
    const entriesSheet = XLSX.utils.aoa_to_sheet(entriesData);
    entriesSheet["!cols"] = [{ wch: 12 }, { wch: 8 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(workbook, entriesSheet, "Entries");

    // Extras Sheet
    if (extras.length > 0) {
      const extrasData: (string | number)[][] = [["Date", "Time", "Name", "Amount"]];
      for (const ex of extras) {
        const timePart = ex.created_at ? ex.created_at.split(" ")[1]?.substring(0, 5) || "" : "";
        extrasData.push([ex.date, timePart, ex.name, ex.amount]);
      }
      const extrasSheet = XLSX.utils.aoa_to_sheet(extrasData);
      extrasSheet["!cols"] = [{ wch: 12 }, { wch: 8 }, { wch: 20 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(workbook, extrasSheet, "Extra Earnings");
    }

    return workbook;
  };

  const generateMultiSeasonXlsx = (): XLSX.WorkBook => {
    const workbook = XLSX.utils.book_new();

    // Overview Sheet
    const overviewData: (string | number)[][] = [
      ["TallyBox Multi-Season Export"],
      ["Exported", new Date().toLocaleString()],
      [],
      ["Season Overview"],
      ["Season Name", "Year", "Entries", "Trees", "Extra Earnings", "Tree Value", "Total Earnings"],
    ];

    let grandTrees = 0;
    let grandValue = 0;
    let grandExtras = 0;

    for (const seasonId of selectedSeasons) {
      const data = selectedData.get(seasonId);
      if (data) {
        const trees = data.entries.reduce((sum, e) => sum + e.total_trees, 0);
        const value = data.entries.reduce((sum, e) => sum + e.total_value, 0);
        const extras = data.extras.reduce((sum, e) => sum + e.amount, 0);
        grandTrees += trees;
        grandValue += value;
        grandExtras += extras;
        overviewData.push([
          `${data.season.name}`,
          data.season.year,
          data.entries.length,
          trees,
          extras,
          value,
          value + extras,
        ]);
      }
    }

    overviewData.push([]);
    overviewData.push(["GRAND TOTAL", "", "", grandTrees, grandExtras, grandValue, grandValue + grandExtras]);

    const overviewSheet = XLSX.utils.aoa_to_sheet(overviewData);
    overviewSheet["!cols"] = [{ wch: 20 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(workbook, overviewSheet, "Overview");

    // Individual season sheets
    for (const seasonId of selectedSeasons) {
      const data = selectedData.get(seasonId);
      if (data) {
        const safeName = `${data.season.name} ${data.season.year}`.substring(0, 31);
        const seasonWorkbook = generateXlsxWorkbook(data.season, data.entries, data.extras);
        const entriesSheet = seasonWorkbook.Sheets["Entries"];
        const extrasSheet = seasonWorkbook.Sheets["Extra Earnings"];
        const dailySheet = seasonWorkbook.Sheets["Daily Summary"];
        const summarySheet = seasonWorkbook.Sheets["Summary"];

        if (summarySheet) XLSX.utils.book_append_sheet(workbook, summarySheet, `S${selectedSeasons.size > 1 ? selectedSeasons.size - Array.from(selectedSeasons).indexOf(seasonId) : ""}: ${safeName}`);
        if (dailySheet) XLSX.utils.book_append_sheet(workbook, dailySheet, "Daily Summary");
        if (entriesSheet) XLSX.utils.book_append_sheet(workbook, entriesSheet, "Entries");
        if (extrasSheet) XLSX.utils.book_append_sheet(workbook, extrasSheet, "Extra Earnings");
      }
    }

    return workbook;
  };

  if (loading) {
    return (
      <View style={[globalStyles.screen, { justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: Colors.textMuted }}>Loading...</Text>
      </View>
    );
  }

  const selectedCount = selectedSeasons.size;

  return (
    <View style={globalStyles.screen}>
      <ScrollView contentContainerStyle={{ padding: Spacing.md }}>
        <View style={styles.header}>
          <Text style={styles.title}>Export & Backup</Text>
          <Text style={styles.subtitle}>
            Export your data for backup or import from a previous backup
          </Text>
        </View>

        <View style={styles.importSection}>
          <Text style={styles.sectionTitle}>Import</Text>
          <Text style={styles.sectionSub}>Restore seasons from a JSON backup file</Text>
          <Button
            label={importing ? "Importing..." : "Import from Backup"}
            variant="secondary"
            onPress={handleImport}
            loading={importing}
            disabled={importing}
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Export</Text>
          <Text style={styles.sectionSub}>Select seasons to export</Text>

          <View style={styles.sectionHeader}>
            <Text style={styles.label}>Seasons</Text>
            <TouchableOpacity onPress={handleSelectAll}>
              <Text style={styles.selectAllText}>
                {selectedSeasons.size === seasons.length ? "Deselect All" : "Select All"}
              </Text>
            </TouchableOpacity>
          </View>

          {seasons.length === 0 ? (
            <Text style={styles.emptyText}>No seasons to export</Text>
          ) : (
            seasons.map((season) => (
              <TouchableOpacity
                key={season.id}
                style={[
                  styles.seasonItem,
                  selectedSeasons.has(season.id) && styles.seasonItemSelected,
                ]}
                onPress={() => handleToggleSeason(season)}
              >
                <View style={styles.seasonItemContent}>
                  <View style={styles.seasonInfo}>
                    <Text style={styles.seasonName}>
                      {season.name} {season.year}
                    </Text>
                    <Text style={styles.seasonMeta}>
                      {season.crew_boss ? `${season.crew_boss} • ` : ""}
                      Created {new Date(season.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.checkbox,
                      selectedSeasons.has(season.id) && styles.checkboxSelected,
                    ]}
                  >
                    {selectedSeasons.has(season.id) && (
                      <Text style={styles.checkmark}>✓</Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Export Format</Text>

          <View style={styles.formatOptions}>
            <TouchableOpacity
              style={[styles.formatOption, format === "json" && styles.formatOptionSelected]}
              onPress={() => setFormat("json")}
            >
              <View style={styles.formatRadio}>
                {format === "json" && <View style={styles.formatRadioInner} />}
              </View>
              <View style={styles.formatInfo}>
                <Text style={styles.formatName}>JSON (App Data Backup)</Text>
                <Text style={styles.formatDesc}>Full backup with all data. Best for restoring or transferring.</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.formatOption, format === "csv" && styles.formatOptionSelected]}
              onPress={() => setFormat("csv")}
            >
              <View style={styles.formatRadio}>
                {format === "csv" && <View style={styles.formatRadioInner} />}
              </View>
              <View style={styles.formatInfo}>
                <Text style={styles.formatName}>CSV (Most Compatible)</Text>
                <Text style={styles.formatDesc}>Opens in any spreadsheet app. Simple format.</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.formatOption, format === "xlsx" && styles.formatOptionSelected]}
              onPress={() => setFormat("xlsx")}
            >
              <View style={styles.formatRadio}>
                {format === "xlsx" && <View style={styles.formatRadioInner} />}
              </View>
              <View style={styles.formatInfo}>
                <Text style={styles.formatName}>Spreadsheet (Most Detailed)</Text>
                <Text style={styles.formatDesc}>Multiple sheets with daily summaries and totals.</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Export Style</Text>
          <Text style={styles.sectionSub}>
            {selectedCount === 1 
              ? "Choose how to export your data" 
              : "Choose how to export multiple seasons"}
          </Text>

          <View style={styles.styleOptions}>
            <TouchableOpacity
              style={[styles.styleOption, exportStyle === "single" && styles.styleOptionSelected]}
              onPress={() => setExportStyle("single")}
            >
              <View style={styles.formatRadio}>
                {exportStyle === "single" && <View style={styles.formatRadioInner} />}
              </View>
              <View style={styles.formatInfo}>
                <Text style={styles.formatName}>Single File</Text>
                <Text style={styles.formatDesc}>
                  {selectedCount === 1 
                    ? "All data in one file" 
                    : "Combined into one file"}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.styleOption, exportStyle === "multiple" && styles.styleOptionSelected]}
              onPress={() => setExportStyle("multiple")}
            >
              <View style={styles.formatRadio}>
                {exportStyle === "multiple" && <View style={styles.formatRadioInner} />}
              </View>
              <View style={styles.formatInfo}>
                <Text style={styles.formatName}>Multiple Files</Text>
                <Text style={styles.formatDesc}>
                  {selectedCount === 1 
                    ? "One file per season" 
                    : "One file per season"}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.exportSection}>
          <Button
            label={exporting ? "Exporting..." : `Export ${selectedCount} Season${selectedCount !== 1 ? "s" : ""}`}
            onPress={handleExport}
            loading={exporting}
            disabled={selectedCount === 0}
            size="lg"
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: Spacing.lg,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: Typography.titleSize,
    fontWeight: Typography.fontWeight.bold,
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: Typography.bodySize,
    marginTop: 4,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.subtitleSize,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: 4,
  },
  sectionSub: {
    color: Colors.textMuted,
    fontSize: Typography.captionSize,
    marginBottom: Spacing.sm,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  label: {
    color: Colors.textPrimary,
    fontSize: Typography.subtitleSize,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.sm,
  },
  selectAllText: {
    color: Colors.accent,
    fontSize: Typography.bodySize,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: Typography.bodySize,
    textAlign: "center",
    padding: Spacing.lg,
  },
  seasonItem: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
    overflow: "hidden",
  },
  seasonItemSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentMuted,
  },
  seasonItemContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
  },
  seasonInfo: {
    flex: 1,
  },
  seasonName: {
    color: Colors.textPrimary,
    fontSize: Typography.bodySize,
    fontWeight: Typography.fontWeight.bold,
  },
  seasonMeta: {
    color: Colors.textMuted,
    fontSize: Typography.captionSize,
    marginTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accent,
  },
  checkmark: {
    color: Colors.textLight,
    fontSize: 14,
    fontWeight: Typography.fontWeight.bold,
  },
  formatOptions: {
    gap: Spacing.sm,
  },
  styleOptions: {
    gap: Spacing.sm,
  },
  formatOption: {
    flexDirection: "row",
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    alignItems: "flex-start",
  },
  styleOption: {
    flexDirection: "row",
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    alignItems: "flex-start",
  },
  formatOptionSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentMuted,
  },
  styleOptionSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentMuted,
  },
  formatRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
    marginTop: 2,
  },
  formatRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.accent,
  },
  formatInfo: {
    flex: 1,
  },
  formatName: {
    color: Colors.textPrimary,
    fontSize: Typography.bodySize,
    fontWeight: Typography.fontWeight.semibold,
  },
  formatDesc: {
    color: Colors.textMuted,
    fontSize: Typography.captionSize,
    marginTop: 2,
  },
  exportSection: {
    marginTop: Spacing.lg,
  },
  importSection: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.md,
  },
});
