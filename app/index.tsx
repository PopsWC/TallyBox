import React, { useCallback, useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { getSeasons, deleteSeason, getGlobalStats, getSeasonSummary, Season, GlobalStats, SeasonSummary } from "@/lib/database";
import { useActiveSeason } from "@/contexts/active-season";
import { EmptyState } from "@/components/ui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors, Typography, Spacing, Radius, globalStyles } from "@/lib/theme";

const getLocalDateString = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function HomeScreen() {
  const router = useRouter();
  const { activeSeason, setActiveSeason } = useActiveSeason();
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null);
  const [selectedSeasonStats, setSelectedSeasonStats] = useState<SeasonSummary | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [seasonsData, stats] = await Promise.all([
      getSeasons(),
      getGlobalStats(),
    ]);
    setSeasons(seasonsData);
    setGlobalStats(stats);

    if (!activeSeason && seasonsData.length > 0) {
      setActiveSeason(seasonsData[0]);
    }
  }, [activeSeason, setActiveSeason]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    if (activeSeason) {
      // Check if the season still exists in our list (it may have been deleted)
      const seasonStillExists = seasons.some(s => s.id === activeSeason.id);
      if (seasonStillExists) {
        getSeasonSummary(activeSeason.table_name).then(setSelectedSeasonStats);
      } else {
        setSelectedSeasonStats(null);
      }
    } else {
      setSelectedSeasonStats(null);
    }
  }, [activeSeason, seasons]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleDelete = (season: Season) => {
    Alert.alert(
      "Delete Season",
      `Delete "${season.name} ${season.year}"? This will permanently erase all tally data for this season.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteSeason(season.id, season.table_name);
            if (activeSeason?.id === season.id) setActiveSeason(null);
            await load();
          },
        },
      ]
    );
  };

  const handleSelectSeason = (season: Season) => {
    setActiveSeason(season);
  };

  const handleViewSeason = () => {
    if (activeSeason) {
      router.push(`/season/${activeSeason.id}`);
    }
  };

  const formatCurrency = (n: number) =>
    "$" + n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <View style={globalStyles.screen}>
      <View style={styles.logoSection}>
        <View>
          <Text style={styles.heroTitle}>TallyBox</Text>
          <Text style={styles.heroSub}>Track every tree. Every day.</Text>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            onPress={() => router.push("/backup")}
            style={styles.headerIconBtn}
          >
            <IconSymbol name="square.and.arrow.up" size={22} color={Colors.accent} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push("/species")}
            style={styles.headerIconBtn}
          >
            <IconSymbol name="tree.fill" size={22} color={Colors.accent} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push("/settings")}
            style={styles.headerIconBtn}
          >
            <IconSymbol name="gearshape.fill" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Global Stats */}
      {globalStats && globalStats.totalSeasons > 0 && (
        <View style={styles.globalStatsCard}>
          <Text style={styles.globalStatsTitle}>All-time Totals</Text>
          <View style={styles.globalStatsRow}>
            <View style={styles.globalStat}>
              <Text style={styles.globalStatValue}>{globalStats.totalTrees.toLocaleString()}</Text>
              <Text style={styles.globalStatLabel}>Trees</Text>
            </View>
            <View style={styles.globalStatDivider} />
            <View style={styles.globalStat}>
              <Text style={[styles.globalStatValue, { color: Colors.green }]}>
                {formatCurrency(globalStats.totalValue)}
              </Text>
              <Text style={styles.globalStatLabel}>Earned</Text>
            </View>
            <View style={styles.globalStatDivider} />
            <View style={styles.globalStat}>
              <Text style={styles.globalStatValue}>{globalStats.totalSeasons}</Text>
              <Text style={styles.globalStatLabel}>Seasons</Text>
            </View>
          </View>
        </View>
      )}

      {/* Selected Season Stats */}
      {activeSeason && selectedSeasonStats && (
        <View style={styles.seasonStatsCard}>
          <TouchableOpacity
            style={styles.seasonStatsHeader}
            onPress={handleViewSeason}
            activeOpacity={0.8}
          >
            <View>
              <Text style={styles.seasonStatsTitle}>
                {activeSeason.name} {activeSeason.year}
              </Text>
              <Text style={styles.seasonStatsSub}>
                {selectedSeasonStats.totalDays} planting day{selectedSeasonStats.totalDays !== 1 ? "s" : ""} · Tap to view →
              </Text>
            </View>
          </TouchableOpacity>
          <View style={styles.seasonStatsRow}>
            <View style={styles.seasonStat}>
              <Text style={styles.seasonStatValue}>
                {selectedSeasonStats.totalTrees.toLocaleString()}
              </Text>
              <Text style={styles.seasonStatLabel}>Trees</Text>
            </View>
            <View style={styles.seasonStatDivider} />
            <View style={styles.seasonStat}>
              <Text style={[styles.seasonStatValue, { color: Colors.green }]}>
                {formatCurrency(selectedSeasonStats.totalValue)}
              </Text>
              <Text style={styles.seasonStatLabel}>Earned</Text>
            </View>
            {activeSeason.season_goal && activeSeason.season_goal > 0 && (
              <>
                <View style={styles.seasonStatDivider} />
                <View style={styles.seasonStat}>
                  <Text style={[styles.seasonStatValue, { color: Colors.accent }]}>
                    {Math.min(100, (selectedSeasonStats.totalValue / activeSeason.season_goal) * 100).toFixed(0)}%
                  </Text>
                  <Text style={styles.seasonStatLabel}>Goal</Text>
                </View>
              </>
            )}
          </View>
          <TouchableOpacity
            style={styles.addTallyButton}
            onPress={() => {
              const today = getLocalDateString();
              router.push({
                pathname: "/tally/[date]",
                params: { date: today, seasonId: String(activeSeason.id), tableName: activeSeason.table_name },
              });
            }}
          >
            <Text style={styles.addTallyButtonText}>+ Today&apos;s Tally</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Season List */}
      <FlatList
        data={seasons}
        keyExtractor={(s) => String(s.id)}
        contentContainerStyle={{ padding: Spacing.md, gap: Spacing.sm, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.accent} />
        }
        ListHeaderComponent={
          seasons.length > 0 ? (
            <Text style={globalStyles.label}>Seasons (tap to select)</Text>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState
            icon="leaf.fill"
            title="No seasons yet"
            body="Create a new season to start tracking your planted trees."
          />
        }
        renderItem={({ item }) => {
          const isActive = activeSeason?.id === item.id;
          return (
            <View style={[styles.seasonCard, isActive && styles.seasonCardActive]}>
              <TouchableOpacity
                style={styles.seasonCardContent}
                onPress={() => handleSelectSeason(item)}
                onLongPress={() => handleDelete(item)}
                activeOpacity={0.8}
              >
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
                    <Text style={[styles.seasonName, isActive && styles.seasonNameActive]}>{item.name}</Text>
                    <Text style={styles.seasonYear}> {item.year}</Text>
                  </View>
                  <Text style={styles.seasonSub}>
                    Created {new Date(item.created_at).toLocaleDateString()}
                  </Text>
                </View>
                {isActive && (
                  <TouchableOpacity
                    style={styles.enterButton}
                    onPress={handleViewSeason}
                  >
                    <Text style={styles.enterButtonText}>→</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            </View>
          );
        }}
      />

      {/* FAB */}
      <View style={styles.fab}>
        <TouchableOpacity
          style={styles.fabButton}
          onPress={() => router.push("/season/new")}
          activeOpacity={0.8}
        >
          <Text style={styles.fabButtonText}>+ New Season</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  logoSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    paddingTop: Spacing.xxl,
  },
  headerButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  headerIconBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.bgInput,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.titleSize,
    fontWeight: Typography.fontWeight.heavy,
  },
  heroSub: {
    color: Colors.textMuted,
    fontSize: Typography.captionSize,
    marginTop: 2,
  },
  globalStatsCard: {
    margin: Spacing.md,
    marginBottom: 0,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  globalStatsTitle: {
    color: Colors.textSecondary,
    fontSize: Typography.captionSize,
    fontWeight: Typography.fontWeight.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  globalStatsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  globalStat: {
    flex: 1,
    alignItems: "center",
  },
  globalStatValue: {
    color: Colors.textPrimary,
    fontSize: Typography.titleSize,
    fontWeight: Typography.fontWeight.bold,
  },
  globalStatLabel: {
    color: Colors.textMuted,
    fontSize: Typography.captionSize,
    marginTop: 2,
  },
  globalStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.border,
  },
  seasonStatsCard: {
    margin: Spacing.md,
    marginBottom: 0,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  seasonStatsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  seasonStatsTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.subtitleSize,
    fontWeight: Typography.fontWeight.bold,
  },
  seasonStatsSub: {
    color: Colors.textMuted,
    fontSize: Typography.captionSize,
    marginTop: 2,
  },
  seasonStatsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  seasonStat: {
    flex: 1,
    alignItems: "center",
  },
  seasonStatValue: {
    color: Colors.textPrimary,
    fontSize: Typography.subtitleSize,
    fontWeight: Typography.fontWeight.bold,
  },
  seasonStatLabel: {
    color: Colors.textMuted,
    fontSize: Typography.captionSize,
    marginTop: 2,
  },
  seasonStatDivider: {
    width: 1,
    height: 30,
    backgroundColor: Colors.border,
  },
  addTallyButton: {
    marginTop: Spacing.md,
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    alignItems: "center",
  },
  addTallyButtonText: {
    color: Colors.textLight,
    fontSize: Typography.bodySize,
    fontWeight: Typography.fontWeight.bold,
  },
  seasonCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  seasonCardActive: {
    borderColor: Colors.accentDim,
    backgroundColor: Colors.accentMuted,
  },
  seasonCardContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
  },
  seasonName: {
    color: Colors.textPrimary,
    fontSize: Typography.bodySize,
    fontWeight: Typography.fontWeight.bold,
  },
  seasonNameActive: {
    color: Colors.accent,
  },
  seasonYear: {
    color: Colors.accent,
    fontSize: Typography.bodySize,
    fontWeight: Typography.fontWeight.heavy,
  },
  seasonSub: {
    color: Colors.textMuted,
    fontSize: Typography.captionSize,
    marginTop: 4,
  },
  enterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: Spacing.sm,
  },
  enterButtonText: {
    color: Colors.textLight,
    fontSize: 20,
    fontWeight: Typography.fontWeight.bold,
  },
  fab: {
    position: "absolute",
    bottom: Spacing.lg,
    left: Spacing.md,
    right: Spacing.md,
  },
  fabButton: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.full,
    paddingVertical: Spacing.md,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabButtonText: {
    color: Colors.bg,
    fontSize: Typography.bodySize,
    fontWeight: Typography.fontWeight.bold,
  },
});
