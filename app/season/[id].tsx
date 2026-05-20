import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Modal,
  Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import {
  getSeasons,
  getSeasonSummary,
  getEntriesForSeason,
  SeasonSummary,
  Season,
} from "@/lib/database";
import { shareSeasonCsv, shareSeasonJson } from "@/lib/functions/export";
import { Button, StatBadge, EmptyState, SectionHeader, Divider } from "@/components/ui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors, Typography, Spacing, Radius, globalStyles } from "@/lib/theme";

const getLocalDateString = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function SeasonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [season, setSeason] = useState<Season | null>(null);
  const [summary, setSummary] = useState<SeasonSummary | null>(null);
  const [exporting, setExporting] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  const handleBackdatePress = () => {
    setSelectedDate(new Date());
    setDatePickerVisible(true);
  };

  const handleDateConfirm = () => {
    setDatePickerVisible(false);
    const dateStr = getLocalDateString(selectedDate);
    router.push({
      pathname: "/tally/[date]",
      params: {
        date: dateStr,
        seasonId: String(season?.id),
        tableName: season?.table_name,
      },
    });
  };

  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        const seasons = await getSeasons();
        const s = seasons.find((x) => String(x.id) === id);
        if (!s) return;
        setSeason(s);
        const sum = await getSeasonSummary(s.table_name);
        setSummary(sum);
      };
      load();
    }, [id])
  );

  const today = getLocalDateString();

  const handleExport = async (format: "csv" | "json") => {
    if (!season) return;
    setExporting(true);
    try {
      const entries = await getEntriesForSeason(season.table_name);
      if (format === "csv") {
        await shareSeasonCsv(season, entries);
      } else {
        await shareSeasonJson(season, entries);
      }
    } catch (e: unknown) {
      Alert.alert("Export Error", e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const handleExportPrompt = () => {
    Alert.alert("Export Season", "Choose export format:", [
      { text: "Cancel", style: "cancel" },
      { text: "CSV (spreadsheet)", onPress: () => handleExport("csv") },
      { text: "JSON (companion app)", onPress: () => handleExport("json") },
    ]);
  };

  const formatCurrency = (n: number) =>
    "$" + n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const formatDate = (d: string) =>
    new Date(d + "T12:00:00").toLocaleDateString("en-CA", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

  if (!season || !summary) {
    return (
      <View style={[globalStyles.screen, { justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: Colors.textMuted }}>Loading…</Text>
      </View>
    );
  }

  const hasSeasonGoal = season.season_goal && season.season_goal > 0;
  const seasonProgress = hasSeasonGoal
    ? Math.min(100, (summary.totalValue / season.season_goal!) * 100)
    : 0;

  return (
    <View style={globalStyles.screen}>
      <FlatList
        data={summary.byDay}
        keyExtractor={(d) => d.date}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListHeaderComponent={
          <>
            <View style={styles.seasonHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.seasonName}>
                  {season.name} <Text style={{ color: Colors.accent }}>{season.year}</Text>
                </Text>
                <Text style={styles.seasonSub}>
                  {season.crew_boss ? `${season.crew_boss} - ` : ""}{summary.totalDays} planting day{summary.totalDays !== 1 ? "s" : ""}
                </Text>
              </View>
              <View style={{ flexDirection: "row", gap: Spacing.sm }}>
                <TouchableOpacity 
                  onPress={() => router.push({ pathname: "/season/insights", params: { id: String(season.id) } })}
                  style={styles.headerIconBtnInsights}
                >
                  <IconSymbol name="chart.bar.fill" size={22} color={Colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity 
                  onPress={() => router.push({ pathname: "/season/settings", params: { seasonId: String(season.id) } })}
                  style={styles.headerIconBtnSmall}
                >
                  <IconSymbol name="gearshape.fill" size={22} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ flexDirection: "row", gap: Spacing.sm, padding: Spacing.md }}>
              <StatBadge
                label="Total Trees"
                value={summary.totalTrees.toLocaleString()}
                color={Colors.textPrimary}
              />
              <StatBadge
                label="Total Earnings"
                value={formatCurrency(summary.totalValue)}
                color={Colors.green}
              />
            </View>

            {hasSeasonGoal && (
              <View style={styles.goalSection}>
                <View style={styles.goalHeader}>
                  <Text style={styles.goalLabel}>Season Goal</Text>
                  <Text style={styles.goalValue}>
                    {formatCurrency(summary.totalValue)} / {formatCurrency(season.season_goal!)}
                  </Text>
                </View>
                <View style={styles.progressBarBg}>
                  <View
                    style={[
                      styles.progressBarFill,
                      { width: `${seasonProgress}%` },
                      seasonProgress >= 100 && styles.progressBarComplete,
                    ]}
                  />
                </View>
                <Text style={styles.goalPercent}>{seasonProgress.toFixed(1)}% complete</Text>
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
                label="Today's Tally"
                onPress={() => {
  const today = getLocalDateString();
                  router.push({
                    pathname: "/tally/[date]",
                    params: {
                      date: today,
                      seasonId: String(season.id),
                      tableName: season.table_name,
                    },
                  });
                }}
                style={{ flex: 1 }}
                icon="calendar"
              />
              <Button
                label="Backdate Tally"
                variant="secondary"
                onPress={handleBackdatePress}
                style={{ flex: 1 }}
              />
            </View>

            <SectionHeader title="Planting Days" />
          </>
        }
        ListEmptyComponent={
          <EmptyState
            icon="calendar"
            title="No days recorded yet"
            body="Tap the Today's Tally button to start logging trees."
          />
        }
        renderItem={({ item }) => {
          const dailyGoal = season?.daily_goal;
          const bonus = dailyGoal && dailyGoal > 0 && item.value > dailyGoal ? item.value - dailyGoal : null;
          return (
            <TouchableOpacity
              style={styles.dayRow}
              onPress={() =>
                router.push({
                  pathname: "/tally/[date]",
                  params: {
                    date: item.date,
                    seasonId: String(season.id),
                    tableName: season.table_name,
                  },
                })
              }
              activeOpacity={0.75}
            >
              <View>
                <Text style={styles.dayDate}>{formatDate(item.date)}</Text>
                <Text style={styles.dayTrees}>{item.trees.toLocaleString()} trees</Text>
                {item.extra > 0 && (
                  <Text style={styles.dayExtra}>+{formatCurrency(item.extra)} extras</Text>
                )}
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.dayValue}>{formatCurrency(item.value)}</Text>
                {bonus !== null && (
                  <Text style={styles.dayBonus}>+{formatCurrency(bonus)}</Text>
                )}
                <Text style={styles.dayArrow}>›</Text>
              </View>
            </TouchableOpacity>
          );
        }}
        ItemSeparatorComponent={() => (
          <Divider style={{ marginHorizontal: Spacing.md, marginVertical: 0 }} />
        )}
      />

      {/* Date Picker Modal */}
      <Modal
        visible={datePickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDatePickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setDatePickerVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalContent}
            activeOpacity={1}
            onPress={() => {}}
          >
            <Text style={styles.modalTitle}>Select Date</Text>
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={(event, date) => {
                if (date) setSelectedDate(date);
              }}
              maximumDate={new Date()}
              textColor={Colors.textPrimary}
              style={styles.datePicker}
            />
            <View style={styles.modalButtons}>
              <Button
                label="Cancel"
                variant="secondary"
                onPress={() => setDatePickerVisible(false)}
                style={{ flex: 1 }}
              />
              <Button
                label="Go to Date"
                onPress={handleDateConfirm}
                style={{ flex: 1 }}
              />
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  seasonHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  seasonName: {
    color: Colors.textPrimary,
    fontSize: Typography.titleSize,
    fontWeight: Typography.fontWeight.heavy,
  },
  seasonSub: {
    color: Colors.textMuted,
    fontSize: Typography.captionSize,
    marginTop: 4,
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
  dayRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  dayDate: {
    color: Colors.textPrimary,
    fontSize: Typography.bodySize,
    fontWeight: Typography.fontWeight.semibold,
  },
  dayTrees: {
    color: Colors.accent,
    fontSize: Typography.captionSize,
    marginTop: 2,
  },
  dayValue: {
    color: Colors.green,
    fontSize: Typography.bodySize,
    fontWeight: Typography.fontWeight.bold,
  },
  dayBonus: {
    color: Colors.green,
    fontSize: Typography.captionSize,
    marginTop: 2,
  },
  dayArrow: {
    color: Colors.textMuted,
    fontSize: 20,
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  modalContent: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    width: "100%",
    maxWidth: 340,
  },
  modalTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.subtitleSize,
    fontWeight: Typography.fontWeight.bold,
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  datePicker: {
    alignSelf: "center",
    marginBottom: Spacing.md,
  },
  modalButtons: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  headerIconBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgInput,
    alignItems: "center",
    justifyContent: "center",
  },
  headerIconBtnSmall: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgInput,
    alignItems: "center",
    justifyContent: "center",
  },
  headerIconBtnInsights: {
    width: 56,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: Colors.bgInput,
    alignItems: "center",
    justifyContent: "center",
  },
  dayExtra: {
    color: Colors.green,
    fontSize: Typography.captionSize,
    marginTop: 2,
  },
});
