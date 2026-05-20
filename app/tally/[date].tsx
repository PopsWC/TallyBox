import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import {
  getEntriesForDay,
  getDailySummary,
  deleteEntry,
  deleteAllEntriesForDay,
  getSeasons,
  getExtrasForDay,
  deleteExtra,
  TallyEntry,
  DailySummary,
  Season,
  SeasonExtra,
} from "@/lib/database";
import { shareDailyCsv, shareDailyJson } from "@/lib/functions/export";
import { Button, StatBadge, EmptyState, Divider } from "@/components/ui";
import { Colors, Typography, Spacing, Radius, globalStyles } from "@/lib/theme";

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

type ListItem = 
  | { type: "entry"; data: TallyEntry }
  | { type: "extra"; data: SeasonExtra };

export default function DailyTallyScreen() {
  const params = useLocalSearchParams<{ date: string; seasonId: string; tableName: string }>();
  const date = param(params.date);
  const seasonId = param(params.seasonId);
  const tableName = param(params.tableName);

  const router = useRouter();
  const [entries, setEntries] = useState<TallyEntry[]>([]);
  const [extras, setExtras] = useState<SeasonExtra[]>([]);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [season, setSeason] = useState<Season | null>(null);
  const [exporting, setExporting] = useState(false);
  const [sortNewest, setSortNewest] = useState(true);

  const load = useCallback(async () => {
    if (!tableName || !date) return;
    const seasons = await getSeasons();
    const s = seasons.find((x) => String(x.id) === seasonId);
    setSeason(s ?? null);
    const [e, sum, ex] = await Promise.all([
      getEntriesForDay(tableName, date),
      getDailySummary(tableName, date),
      getExtrasForDay(tableName, date),
    ]);
    setEntries(e);
    setExtras(ex);
    setSummary(sum);
  }, [tableName, date, seasonId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleDelete = (entry: TallyEntry) => {
    Alert.alert(
      "Delete Entry",
      `Remove ${entry.total_trees} trees (${entry.species} - ${entry.plot})?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteEntry(tableName, entry.id);
            await load();
          },
        },
      ]
    );
  };

  const handleDeleteExtra = (extra: SeasonExtra) => {
    Alert.alert(
      "Delete Extra",
      `Remove ${extra.name} ($${extra.amount.toFixed(2)})?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteExtra(tableName, extra.id);
            await load();
          },
        },
      ]
    );
  };

  const handleDeleteAll = () => {
    if (totalItems === 0) return;
    const totalTrees = entries.reduce((sum, e) => sum + e.total_trees, 0);
    Alert.alert(
      "Delete Day",
      `Delete all ${totalItems} items (${totalTrees.toLocaleString()} trees) for ${displayDate}? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Day",
          style: "destructive",
          onPress: async () => {
            await deleteAllEntriesForDay(tableName, date);
            router.back();
          },
        },
      ]
    );
  };

  const handleExport = async (format: "csv" | "json") => {
    if (!summary) return;
    setExporting(true);
    try {
      const seasons = await getSeasons();
      const season = seasons.find((s) => String(s.id) === seasonId);
      if (!season) throw new Error("Season not found");
      if (format === "csv") {
        await shareDailyCsv(entries, season, date);
      } else {
        await shareDailyJson(season, summary, entries);
      }
    } catch (e: unknown) {
      Alert.alert("Export Error", e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const handleExportPrompt = () => {
    Alert.alert("Send to Crew Boss", "Choose format:", [
      { text: "Cancel", style: "cancel" },
      { text: "CSV (spreadsheet)", onPress: () => handleExport("csv") },
      { text: "JSON (companion app)", onPress: () => handleExport("json") },
    ]);
  };

  const formatCurrency = (n: number) =>
    "$" + n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const displayDate = new Date(date + "T12:00:00").toLocaleDateString("en-CA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const hasDailyGoal = season?.daily_goal && season.daily_goal > 0;
  const dailyProgress = hasDailyGoal && summary
    ? Math.min(100, (summary.totalValue / season!.daily_goal!) * 100)
    : 0;

  const listItems: ListItem[] = [
    ...entries.map((e) => ({ type: "entry" as const, data: e })),
    ...extras.map((e) => ({ type: "extra" as const, data: e })),
  ].sort((a, b) => {
    const timeA = new Date(a.data.created_at).getTime();
    const timeB = new Date(b.data.created_at).getTime();
    if (timeA === timeB) {
      // Use ID as tiebreaker - entries and extras have separate ID spaces
      const idA = a.type === "entry" ? (a.data as TallyEntry).id : -(a.data as SeasonExtra).id;
      const idB = b.type === "entry" ? (b.data as TallyEntry).id : -(b.data as SeasonExtra).id;
      return sortNewest ? idB - idA : idA - idB;
    }
    return sortNewest ? timeB - timeA : timeA - timeB;
  });
  const totalItems = listItems.length;

  return (
    <View style={globalStyles.screen}>
      <FlatList
        data={listItems}
        keyExtractor={(item) => item.type === "entry" ? `entry-${item.data.id}` : `extra-${item.data.id}`}
        contentContainerStyle={{ paddingBottom: 120 }}
        ListHeaderComponent={
          <>
            <View style={styles.dateHeader}>
              <Text style={styles.dateText}>{displayDate}</Text>
              {totalItems > 0 && (
                <TouchableOpacity 
                  style={styles.deleteBtn} 
                  onPress={handleDeleteAll}
                >
                  <Text style={styles.deleteBtnText}>Delete</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={{ flexDirection: "row", gap: Spacing.sm, padding: Spacing.md }}>
              <StatBadge
                label="Trees Today"
                value={(summary?.totalTrees ?? 0).toLocaleString()}
                color={Colors.textPrimary}
              />
              <StatBadge
                label="Earnings"
                value={formatCurrency(summary?.totalValue ?? 0)}
                color={Colors.green}
              />
            </View>

            {hasDailyGoal && summary && (
              <View style={styles.goalSection}>
                <View style={styles.goalHeader}>
                  <Text style={styles.goalLabel}>Daily Goal</Text>
                  <Text style={styles.goalValue}>
                    {formatCurrency(summary.totalValue)} / {formatCurrency(season!.daily_goal!)}
                  </Text>
                </View>
                <View style={styles.progressBarBg}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${dailyProgress}%` },
                      dailyProgress >= 100 && styles.progressBarComplete,
                    ]}
                  />
                </View>
                <Text style={styles.goalPercent}>{dailyProgress.toFixed(1)}% complete</Text>
              </View>
            )}

            <View
              style={{
                flexDirection: "row",
                gap: Spacing.sm,
                paddingHorizontal: Spacing.md,
                marginBottom: Spacing.md,
              }}
            >
              <Button
                label="Add Entry"
                onPress={() =>
                  router.push({
                    pathname: "/tally/new-entry",
                    params: { date, seasonId, tableName },
                  })
                }
                style={{ flex: 1 }}
                icon="plus"
              />
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: "/tally/add-extra",
                    params: { date, seasonId, tableName },
                  })
                }
                style={styles.extraBtn}
              >
                <Text style={styles.extraBtnText}>+</Text>
              </TouchableOpacity>
              <Button
                label="Send"
                variant={totalItems > 0 ? "secondary" : "ghost"}
                onPress={handleExportPrompt}
                loading={exporting}
                disabled={totalItems === 0}
                style={{ flex: 1 }}
                icon="paperplane.fill"
              />
            </View>

            <View style={styles.sectionHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
                <Text style={styles.sectionTitle}>{totalItems} entr{totalItems === 1 ? "y" : "ies"}</Text>
                {totalItems > 0 && (
                  <TouchableOpacity 
                    style={styles.sortButton} 
                    onPress={() => setSortNewest(!sortNewest)}
                  >
                    <Text style={styles.sortButtonText}>
                      {sortNewest ? "↓ Newest" : "↑ Oldest"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              {totalItems > 0 && (
                <TouchableOpacity
                  style={styles.summaryButton}
                  onPress={() =>
                    router.push({
                      pathname: "/summary/[date]",
                      params: { date, seasonId, tableName },
                    })
                  }
                >
                  <Text style={styles.summaryButtonText}>
                    Full summary →
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        }
        ListEmptyComponent={
          <EmptyState
            icon="leaf.fill"
            title="No entries yet"
            body="Tap 'Add Entry' or '+' to add earnings. Long press an entry to delete."
          />
        }
        ItemSeparatorComponent={() => (
          <Divider style={{ marginHorizontal: Spacing.md, marginVertical: 0 }} />
        )}
        renderItem={({ item }) => {
          if (item.type === "extra") {
            return (
              <ExtraRow
                extra={item.data}
                onDelete={() => handleDeleteExtra(item.data)}
                onEdit={() =>
                  router.push({
                    pathname: "/tally/edit-extra",
                    params: { extraJson: JSON.stringify(item.data), tableName, date },
                  })
                }
              />
            );
          }
          return (
            <EntryRow
              entry={item.data}
              onDelete={() => handleDelete(item.data)}
              onEdit={() =>
                router.push({
                  pathname: "/tally/edit-entry",
                  params: { entryJson: JSON.stringify(item.data), tableName },
                })
              }
            />
          );
        }}
      />
    </View>
  );
}

function EntryRow({
  entry,
  onDelete,
  onEdit,
}: {
  entry: TallyEntry;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const formatCurrency = (n: number) => "$" + n.toFixed(2);
  const formatTime = (createdAt: string | null | undefined) => {
    if (!createdAt) return "";
    const time = createdAt.split(" ")[1];
    if (!time) return "";
    const [hours, minutes] = time.split(":");
    const h = parseInt(hours, 10);
    const suffix = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 || 12;
    return `${hour12}:${minutes} ${suffix}`;
  };

  return (
    <TouchableOpacity
      style={styles.entryRow}
      onLongPress={onDelete}
      onPress={onEdit}
      activeOpacity={0.8}
    >
      <View style={{ flex: 1 }}>
        <View style={styles.entryTop}>
          <View style={styles.speciesPill}>
            <Text style={styles.speciesText}>{entry.species}</Text>
          </View>
        </View>
        <View style={styles.locationRow}>
          <Text style={styles.plotText}>Block: {entry.plot}</Text>
          {entry.cache ? (
            <Text style={styles.cacheText}>Cache: {entry.cache}</Text>
          ) : null}
        </View>
        <Text style={styles.timeText}>
          {formatTime(entry.created_at)}
        </Text>
      </View>

      <View style={{ alignItems: "flex-end" }}>
        <Text style={styles.treeCount}>{entry.total_trees.toLocaleString()}</Text>
        <Text style={styles.treeLabel}>trees</Text>
        <Text style={styles.entryValue}>{formatCurrency(entry.total_value)}</Text>
      </View>
    </TouchableOpacity>
  );
}

function ExtraRow({
  extra,
  onDelete,
  onEdit,
}: {
  extra: SeasonExtra;
  onDelete: () => void;
  onEdit: () => void;
}) {
  const formatCurrency = (n: number) => "$" + n.toFixed(2);
  const formatTime = (createdAt: string | null | undefined) => {
    if (!createdAt) return "";
    const time = createdAt.split(" ")[1];
    if (!time) return "";
    const [hours, minutes] = time.split(":");
    const h = parseInt(hours, 10);
    const suffix = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 || 12;
    return `${hour12}:${minutes} ${suffix}`;
  };

  return (
    <TouchableOpacity
      style={styles.entryRow}
      onLongPress={onDelete}
      onPress={onEdit}
      activeOpacity={0.8}
    >
      <View style={{ flex: 1 }}>
        <View style={styles.entryTop}>
          <View style={[styles.speciesPill, styles.extraPill]}>
            <Text style={[styles.speciesText, { color: Colors.green }]}>{extra.name}</Text>
          </View>
        </View>
        <Text style={styles.timeText}>{formatTime(extra.created_at)}</Text>
      </View>

      <View style={{ alignItems: "flex-end" }}>
        <Text style={[styles.treeCount, { color: Colors.green }]}>{formatCurrency(extra.amount)}</Text>
        <Text style={styles.treeLabel}>extra</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  dateHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dateText: {
    color: Colors.textSecondary,
    fontSize: Typography.bodySize,
    fontWeight: Typography.fontWeight.medium,
  },
  goalSection: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  goalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  goalLabel: {
    color: Colors.textSecondary,
    fontSize: Typography.captionSize,
    fontWeight: Typography.fontWeight.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  goalValue: {
    color: Colors.textPrimary,
    fontSize: Typography.bodySize,
    fontWeight: Typography.fontWeight.bold,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: Colors.bgInput,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: Colors.accent,
    borderRadius: 4,
  },
  progressBarComplete: {
    backgroundColor: Colors.green,
  },
  goalPercent: {
    color: Colors.textMuted,
    fontSize: Typography.captionSize,
    marginTop: Spacing.xs,
    textAlign: "right",
  },
  entryRow: {
    flexDirection: "row",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  entryTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: 4,
  },
  speciesPill: {
    backgroundColor: Colors.accentMuted,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.accentDim,
  },
  extraPill: {
    backgroundColor: Colors.greenMuted,
    borderColor: Colors.greenDim,
  },
  speciesText: {
    color: Colors.accent,
    fontSize: Typography.captionSize,
    fontWeight: Typography.fontWeight.bold,
  },
  locationRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: 2,
  },
  plotText: {
    color: Colors.textSecondary,
    fontSize: Typography.captionSize,
  },
  cacheText: {
    color: Colors.textSecondary,
    fontSize: Typography.captionSize,
    fontWeight: Typography.fontWeight.medium,
  },
  timeText: {
    color: Colors.textPrimary,
    fontSize: Typography.bodySize,
    fontWeight: Typography.fontWeight.medium,
  },
  bundleText: {
    color: Colors.textMuted,
    fontSize: Typography.captionSize,
  },
  planterText: {
    color: Colors.textMuted,
    fontSize: Typography.captionSize,
  },
  notesText: {
    color: Colors.textMuted,
    fontSize: Typography.captionSize,
    marginTop: 4,
    fontStyle: "italic",
  },
  treeCount: {
    color: Colors.textPrimary,
    fontSize: Typography.subtitleSize,
    fontWeight: Typography.fontWeight.heavy,
  },
  treeLabel: {
    color: Colors.textMuted,
    fontSize: Typography.captionSize,
  },
  entryValue: {
    color: Colors.green,
    fontSize: Typography.bodySize,
    fontWeight: Typography.fontWeight.bold,
    marginTop: 2,
  },
  entryRight: {
    alignItems: "flex-end",
    marginLeft: Spacing.sm,
  },
  deleteBtn: {
    backgroundColor: Colors.dangerDim,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  deleteBtnText: {
    color: Colors.danger,
    fontSize: Typography.captionSize,
    fontWeight: Typography.fontWeight.bold,
  },
  extraBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgInput,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  extraBtnText: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: Typography.fontWeight.medium,
    marginTop: -2,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.bgCard,
  },
  sectionTitle: {
    color: Colors.textSecondary,
    fontSize: Typography.captionSize,
    fontWeight: Typography.fontWeight.bold,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  sortButton: {
    backgroundColor: Colors.bgInput,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sortButtonText: {
    color: Colors.accent,
    fontSize: Typography.bodySize,
    fontWeight: Typography.fontWeight.semibold,
  },
  summaryButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  summaryButtonText: {
    color: Colors.accent,
    fontSize: Typography.bodySize,
    fontWeight: Typography.fontWeight.medium,
  },
});
