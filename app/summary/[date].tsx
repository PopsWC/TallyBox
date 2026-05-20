import React, { useCallback, useState } from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useLocalSearchParams, useFocusEffect } from "expo-router";
import { getDailySummary, type DailySummary } from "@/lib/database";
import { Colors, Typography, Spacing, Radius, globalStyles } from "@/lib/theme";

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default function DaySummaryScreen() {
  const params = useLocalSearchParams<{ date: string; seasonId: string; tableName: string }>();
  const date = param(params.date);
  const tableName = param(params.tableName);

  const [summary, setSummary] = useState<DailySummary | null>(null);

  const load = useCallback(async () => {
    if (!tableName || !date) return;
    const s = await getDailySummary(tableName, date);
    setSummary(s);
  }, [tableName, date]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const formatCurrency = (n: number) =>
    "$" + n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const formatNumber = (n: number, decimals = 0) =>
    n.toLocaleString("en-CA", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

  const displayDate = new Date(date + "T12:00:00").toLocaleDateString("en-CA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  if (!summary) {
    return (
      <View style={[globalStyles.screen, { justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: Colors.textMuted }}>Loading…</Text>
      </View>
    );
  }

  const hasExtras = summary.extrasByName && summary.extrasByName.length > 0;
  const hasEntries = summary.entryCount > 0;

  return (
    <ScrollView style={globalStyles.screen} contentContainerStyle={{ paddingBottom: 80 }}>
      <View style={styles.header}>
        <Text style={styles.dateText}>{displayDate}</Text>
      </View>

      {/* Main Stats */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: Colors.accent }]}>
            {formatNumber(summary.totalTrees)}
          </Text>
          <Text style={styles.statLabel}>Trees Planted</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: Colors.green }]}>
            {formatCurrency(summary.totalValue)}
          </Text>
          <Text style={styles.statLabel}>Total Earnings</Text>
        </View>
        <View style={styles.statCardWide}>
          <Text style={styles.sectionTitle}>Entries</Text>
          <View style={styles.entriesRow}>
            <View style={styles.entryStat}>
              <Text style={styles.entryStatValue}>{formatNumber(summary.entryCount + summary.extraCount)}</Text>
              <Text style={styles.entryStatLabel}>total</Text>
            </View>
            <Text style={styles.entryDivider}>/</Text>
            <View style={styles.entryStat}>
              <Text style={styles.entryStatValue}>{formatNumber(summary.entryCount)}</Text>
              <Text style={styles.entryStatLabel}>trees</Text>
            </View>
            <Text style={styles.entryDivider}>/</Text>
            <View style={styles.entryStat}>
              <Text style={[styles.entryStatValue, { color: Colors.green }]}>{formatNumber(summary.extraCount)}</Text>
              <Text style={styles.entryStatLabel}>extras</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Earnings Breakdown */}
      <View style={styles.breakdownCard}>
        <Text style={styles.sectionTitle}>Earnings Breakdown</Text>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Tree Earnings</Text>
          <Text style={[styles.breakdownValue, { color: Colors.accent }]}>
            {formatCurrency(summary.totalTreeValue)}
          </Text>
        </View>
        {hasExtras && (
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>Extra Earnings</Text>
            <Text style={[styles.breakdownValue, { color: Colors.green }]}>
              +{formatCurrency(summary.totalExtra || 0)}
            </Text>
          </View>
        )}
        <View style={[styles.breakdownRow, styles.breakdownTotal]}>
          <Text style={styles.breakdownLabelTotal}>Total Earnings</Text>
          <Text style={[styles.breakdownValueTotal, { color: Colors.green }]}>
            {formatCurrency(summary.totalValue)}
          </Text>
        </View>
      </View>

      {/* Averages */}
      {hasEntries && (
        <View style={styles.averagesCard}>
          <Text style={styles.sectionTitle}>Averages</Text>
          <View style={styles.averagesRow}>
            <View style={styles.averageItem}>
              <Text style={styles.averageValue}>{formatNumber(summary.avgTreesPerEntry, 1)}</Text>
              <Text style={styles.averageLabel}>trees/entry</Text>
            </View>
            <View style={styles.averageDivider} />
            <View style={styles.averageItem}>
              <Text style={styles.averageValue}>{formatCurrency(summary.avgValuePerEntry)}</Text>
              <Text style={styles.averageLabel}>value/entry</Text>
            </View>
            <View style={styles.averageDivider} />
            <View style={styles.averageItem}>
              <Text style={styles.averageValue}>{formatNumber(summary.avgBagUpMinutes)}</Text>
              <Text style={styles.averageLabel}>bag-up mins</Text>
            </View>
          </View>
        </View>
      )}

      {/* Extras Section */}
      {hasExtras && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Extra Earnings</Text>
          {summary.extrasByName.map((extra) => {
            const pct = (summary.totalExtra || 0) > 0 ? Math.round((extra.amount / (summary.totalExtra || 1)) * 100) : 0;
            return (
              <View key={extra.name} style={styles.row}>
                <View style={styles.rowLeft}>
                  <View style={styles.rowLabelRow}>
                    <View style={[styles.extraBadge]}>
                      <Text style={styles.extraBadgeText}>{extra.name}</Text>
                    </View>
                    <View style={styles.percentBadge}>
                      <Text style={styles.percentBadgeText}>{pct}%</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.rowRight}>
                  <Text style={[styles.rowValue, { color: Colors.green }]}>
                    {formatCurrency(extra.amount)}
                  </Text>
                </View>
              </View>
            );
          })}
          <View style={[styles.row, styles.rowTotal]}>
            <Text style={styles.rowLabel}>Extra Total</Text>
            <Text style={[styles.rowValue, { color: Colors.green }]}>
              {formatCurrency(summary.totalExtra || 0)}
            </Text>
          </View>
        </View>
      )}

      {/* By Cache */}
      {summary.byCache && summary.byCache.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>By Cache</Text>
          {summary.byCache.map((row) => {
            const pct = summary.totalTrees > 0 ? Math.round((row.trees / summary.totalTrees) * 100) : 0;
            return (
              <View key={row.cache} style={styles.row}>
                <View style={styles.rowLeft}>
                  <View style={styles.rowLabelRow}>
                    <Text style={styles.rowLabel}>{row.cache}</Text>
                    <View style={styles.percentBadge}>
                      <Text style={styles.percentBadgeText}>{pct}%</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.rowRight}>
                  <Text style={styles.rowTrees}>{formatNumber(row.trees)} trees</Text>
                  <Text style={[styles.rowValue, { color: Colors.green }]}>
                    {formatCurrency(row.value)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* By Species */}
      {summary.bySpecies.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>By Species</Text>
          {summary.bySpecies.map((row) => {
            const pct = summary.totalTrees > 0 ? Math.round((row.trees / summary.totalTrees) * 100) : 0;
            return (
              <View key={row.species} style={styles.row}>
                <View style={styles.rowLeft}>
                  <View style={styles.rowLabelRow}>
                    <Text style={styles.rowLabel}>{row.species}</Text>
                    <View style={styles.percentBadge}>
                      <Text style={styles.percentBadgeText}>{pct}%</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.rowRight}>
                  <Text style={styles.rowTrees}>{formatNumber(row.trees)} trees</Text>
                  <Text style={[styles.rowValue, { color: Colors.green }]}>
                    {formatCurrency(row.value)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* By Plot */}
      {summary.byPlot.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>By Block</Text>
          {summary.byPlot.map((row) => {
            const pct = summary.totalTrees > 0 ? Math.round((row.trees / summary.totalTrees) * 100) : 0;
            return (
              <View key={row.plot} style={styles.row}>
                <View style={styles.rowLeft}>
                  <View style={styles.rowLabelRow}>
                    <Text style={styles.rowLabel}>{row.plot}</Text>
                    <View style={styles.percentBadge}>
                      <Text style={styles.percentBadgeText}>{pct}%</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.rowRight}>
                  <Text style={styles.rowTrees}>{formatNumber(row.trees)} trees</Text>
                  <Text style={[styles.rowValue, { color: Colors.green }]}>
                    {formatCurrency(row.value)}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Empty State */}
      {!hasEntries && !hasExtras && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No data recorded for this day</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
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
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  statCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    alignItems: "center",
  },
  statCardWide: {
    width: "100%",
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  entriesRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  entryStat: {
    alignItems: "center",
    flex: 1,
  },
  entryStatValue: {
    color: Colors.textPrimary,
    fontSize: Typography.titleSize,
    fontWeight: Typography.fontWeight.heavy,
  },
  entryStatLabel: {
    color: Colors.textMuted,
    fontSize: Typography.captionSize,
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  entryDivider: {
    color: Colors.border,
    fontSize: 24,
    fontWeight: "300",
    paddingHorizontal: Spacing.sm,
  },
  entryBreakdown: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
  breakdownItem: {
    flex: 1,
    alignItems: "center",
  },
  breakdownDivider: {
    width: 1,
    height: 30,
    backgroundColor: Colors.border,
  },
  breakdownEntryValue: {
    color: Colors.textPrimary,
    fontSize: Typography.subtitleSize,
    fontWeight: Typography.fontWeight.bold,
  },
  breakdownEntryLabel: {
    color: Colors.textMuted,
    fontSize: Typography.captionSize,
    marginTop: 2,
  },
  statValue: {
    fontSize: Typography.titleSize,
    fontWeight: Typography.fontWeight.heavy,
    color: Colors.textPrimary,
  },
  statLabel: {
    color: Colors.textMuted,
    fontSize: Typography.captionSize,
    marginTop: 4,
  },
  statValueSmall: {
    fontSize: Typography.bodySize,
    fontWeight: Typography.fontWeight.bold,
    color: Colors.green,
  },
  breakdownCard: {
    margin: Spacing.md,
    marginTop: 0,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.subtitleSize,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.sm,
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.xs,
  },
  breakdownLabel: {
    color: Colors.textSecondary,
    fontSize: Typography.bodySize,
  },
  breakdownValue: {
    fontSize: Typography.bodySize,
    fontWeight: Typography.fontWeight.semibold,
  },
  breakdownTotal: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  breakdownLabelTotal: {
    color: Colors.textPrimary,
    fontSize: Typography.bodySize,
    fontWeight: Typography.fontWeight.bold,
  },
  breakdownValueTotal: {
    fontSize: Typography.subtitleSize,
    fontWeight: Typography.fontWeight.bold,
  },
  averagesCard: {
    marginHorizontal: Spacing.md,
    marginTop: 0,
    marginBottom: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  averagesRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  averageItem: {
    flex: 1,
    alignItems: "center",
  },
  averageDivider: {
    width: 1,
    height: 30,
    backgroundColor: Colors.border,
  },
  averageValue: {
    color: Colors.textPrimary,
    fontSize: Typography.subtitleSize,
    fontWeight: Typography.fontWeight.bold,
  },
  averageLabel: {
    color: Colors.textMuted,
    fontSize: Typography.captionSize,
    marginTop: 2,
  },
  section: {
    padding: Spacing.md,
    paddingTop: Spacing.lg,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rowLeft: {
    flex: 1,
  },
  rowRight: {
    alignItems: "flex-end",
  },
  rowLabel: {
    color: Colors.textPrimary,
    fontSize: Typography.bodySize,
    fontWeight: Typography.fontWeight.medium,
  },
  rowLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  percentBadge: {
    backgroundColor: Colors.accentMuted,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 1,
  },
  percentBadgeText: {
    color: Colors.accent,
    fontSize: Typography.captionSize,
    fontWeight: Typography.fontWeight.bold,
  },
  rowTrees: {
    color: Colors.accent,
    fontSize: Typography.captionSize,
  },
  rowValue: {
    fontSize: Typography.bodySize,
    fontWeight: Typography.fontWeight.bold,
    marginTop: 2,
  },
  rowTotal: {
    borderBottomWidth: 0,
    marginTop: Spacing.sm,
  },
  extraBadge: {
    backgroundColor: Colors.greenMuted,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.greenDim,
  },
  extraBadgeText: {
    color: Colors.green,
    fontSize: Typography.captionSize,
    fontWeight: Typography.fontWeight.semibold,
  },
  emptyState: {
    padding: Spacing.xxl,
    alignItems: "center",
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: Typography.bodySize,
  },
});
