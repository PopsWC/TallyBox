import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LineChart, BarChart } from "react-native-gifted-charts";
import {
  getSeasons,
  getSeasonSummary,
  getEntriesForSeason,
  getExtrasForSeason,
  SeasonSummary,
  Season,
  TallyEntry,
  SeasonExtra,
} from "@/lib/database";
import { Colors, Typography, Spacing, Radius, globalStyles } from "@/lib/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CHART_WIDTH = SCREEN_WIDTH - Spacing.md * 2 - Spacing.sm * 2;

interface DailyData {
  date: string;
  trees: number;
  value: number;
  extra: number;
  entries: number;
  avgBagUpMinutes: number;
  times?: number[];
}

interface StatsInsight {
  label: string;
  value: string;
  change: string;
  isPositive: boolean;
  trend: "up" | "down" | "neutral";
}

export default function SeasonInsightsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [season, setSeason] = useState<Season | null>(null);
  const [entries, setEntries] = useState<TallyEntry[]>([]);
  const [extras, setExtras] = useState<SeasonExtra[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    let isMounted = true;
      
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const seasons = await getSeasons();
        if (!isMounted) return;
        
        const s = seasons.find((x) => String(x.id) === id);
        
        if (!s) {
          setError("Season not found");
          setLoading(false);
          return;
        }
        setSeason(s);
        
        const entryData = await getEntriesForSeason(s.table_name);
        if (!isMounted) return;
        
        const extraData = await getExtrasForSeason(s.table_name);
        if (!isMounted) return;
        
        setEntries(Array.isArray(entryData) ? entryData : []);
        setExtras(Array.isArray(extraData) ? extraData : []);
        setLoading(false);
      } catch (e: any) {
        if (isMounted) {
          setError(e?.message || "Failed to load");
          setLoading(false);
        }
      }
    };
    
    load();
    
    return () => {
      isMounted = false;
    };
  }, [id]);

  const dailyData = useMemo((): DailyData[] => {
    if (entries.length === 0) return [];
    
    const byDate = new Map<string, DailyData>();
    
    for (const e of entries) {
      const existing = byDate.get(e.date) || { 
        date: e.date, 
        trees: 0, 
        value: 0, 
        extra: 0, 
        entries: 0,
        avgBagUpMinutes: 0,
        times: [] as number[],
      };
      existing.trees += e.total_trees;
      existing.value += e.total_value;
      existing.entries += 1;
      existing.times?.push(new Date(e.created_at).getTime());
      byDate.set(e.date, existing);
    }
    
    for (const ex of extras) {
      const existing = byDate.get(ex.date) || { 
        date: ex.date, 
        trees: 0, 
        value: 0, 
        extra: 0, 
        entries: 0,
        avgBagUpMinutes: 0,
        times: [] as number[],
      };
      existing.extra += ex.amount;
      byDate.set(ex.date, existing);
    }
    
    const result: DailyData[] = [];
    const sortedDates = Array.from(byDate.keys()).sort();
    
    for (const date of sortedDates) {
      const day = byDate.get(date)!;
      if (day.times && day.times.length > 1) {
        let totalMinutes = 0;
        for (let i = 1; i < day.times.length; i++) {
          totalMinutes += (day.times[i] - day.times[i - 1]) / (1000 * 60);
        }
        day.avgBagUpMinutes = Math.round(totalMinutes / (day.times.length - 1));
      }
      const { times: _t, ...cleanDay } = day;
      result.push(cleanDay as DailyData);
    }
    
    return result;
  }, [entries, extras]);

  const topTreeDay = useMemo(() => {
    if (dailyData.length === 0) return null;
    return dailyData.reduce((best, d) => d.trees > best.trees ? d : best, dailyData[0]);
  }, [dailyData]);

  const topMoneyDay = useMemo(() => {
    if (dailyData.length === 0) return null;
    return dailyData.reduce((best, d) => (d.value + d.extra) > (best.value + best.extra) ? d : best, dailyData[0]);
  }, [dailyData]);

  const topExtrasDay = useMemo(() => {
    if (dailyData.length === 0) return null;
    return dailyData.reduce((best, d) => d.extra > best.extra ? d : best, dailyData[0]);
  }, [dailyData]);

  const topSpeciesData = useMemo(() => {
    if (entries.length === 0) return null;
    const speciesMap = new Map<string, number>();
    for (const e of entries) {
      speciesMap.set(e.species, (speciesMap.get(e.species) || 0) + e.total_trees);
    }
    const sorted = Array.from(speciesMap.entries()).sort((a, b) => b[1] - a[1]);
    return sorted.length > 0 ? { name: sorted[0][0], trees: sorted[0][1] } : null;
  }, [entries]);

  const highestPriceEntry = useMemo(() => {
    if (entries.length === 0) return null;
    return entries.reduce((best, e) => e.price_per_tree > best.price_per_tree ? e : best, entries[0]);
  }, [entries]);

  const lowestPriceEntry = useMemo(() => {
    if (entries.length === 0) return null;
    return entries.reduce((best, e) => e.price_per_tree < best.price_per_tree ? e : best, entries[0]);
  }, [entries]);

  const largestBagUp = useMemo(() => {
    if (entries.length === 0) return null;
    return entries.reduce((best, e) => e.total_trees > best.total_trees ? e : best, entries[0]);
  }, [entries]);

  const longestBagUp = useMemo(() => {
    if (entries.length < 2) return null;
    
    const sortedEntries = [...entries].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    
    let maxGap = 0;
    let maxGapEntry = sortedEntries[1];
    
    for (let i = 1; i < sortedEntries.length; i++) {
      // Only count gaps within the same day
      const prevDate = sortedEntries[i - 1].date;
      const currDate = sortedEntries[i].date;
      
      if (prevDate !== currDate) continue;
      
      const gap = new Date(sortedEntries[i].created_at).getTime() - new Date(sortedEntries[i - 1].created_at).getTime();
      if (gap > maxGap) {
        maxGap = gap;
        maxGapEntry = sortedEntries[i];
      }
    }
    
    return { entry: maxGapEntry, minutes: Math.round(maxGap / (1000 * 60)) };
  }, [entries]);

  const longestDay = useMemo(() => {
    if (dailyData.length === 0) return null;
    let longest = null;
    let maxMinutes = 0;
    
    for (const day of dailyData) {
      const dayEntries = entries.filter(e => e.date === day.date).sort((a, b) => 
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      
      if (dayEntries.length === 0) continue;
      
      const firstTime = new Date(dayEntries[0].created_at).getTime();
      const lastTime = new Date(dayEntries[dayEntries.length - 1].created_at).getTime();
      
      let totalBagUpMinutes = 0;
      for (let i = 1; i < dayEntries.length; i++) {
        totalBagUpMinutes += (new Date(dayEntries[i].created_at).getTime() - new Date(dayEntries[i - 1].created_at).getTime()) / (1000 * 60);
      }
      
      const avgBagUp = dayEntries.length > 1 ? totalBagUpMinutes / (dayEntries.length - 1) : 0;
      const estimatedEndTime = lastTime + (avgBagUp * 60 * 1000);
      const dayLength = (estimatedEndTime - firstTime) / (1000 * 60);
      
      if (dayLength > maxMinutes) {
        maxMinutes = dayLength;
        longest = { date: day.date, minutes: Math.round(dayLength), hours: (dayLength / 60).toFixed(1) };
      }
    }
    
    return longest;
  }, [dailyData, entries]);

  const formatDateShort = (dateStr: string) =>
    new Date(dateStr + "T12:00:00").toLocaleDateString("en-CA", {
      month: "short",
      day: "numeric",
    });

  const formatChartLabel = (dateStr: string, showMonth: boolean = false) => {
    const d = new Date(dateStr + "T12:00:00");
    if (showMonth) {
      return `${d.toLocaleDateString("en-CA", { month: "short" })} ${d.getDate()}`;
    }
    return String(d.getDate());
  };

  const getChartDataWithSmartLabels = (data: DailyData[], valueKey: 'trees' | 'value' | 'avgBagUpMinutes', formatter: (v: number) => string) => {
    if (data.length === 0) return [];
    
    const slicedData = data.slice(-14);
    let lastMonth = -1;
    
    return slicedData.map((d, idx) => {
      const date = new Date(d.date + "T12:00:00");
      const currentMonth = date.getMonth();
      
      const showMonth = currentMonth !== lastMonth || idx === 0;
      lastMonth = currentMonth;
      
      return {
        value: valueKey === 'trees' ? d.trees : valueKey === 'value' ? Math.round(d.value) : (d.avgBagUpMinutes || 0),
        label: formatChartLabel(d.date, showMonth),
        dataPointText: formatter(valueKey === 'trees' ? d.trees : valueKey === 'value' ? Math.round(d.value) : (d.avgBagUpMinutes || 0)),
      };
    });
  };

  const treesChartData = useMemo(() => {
    return getChartDataWithSmartLabels(dailyData, 'trees', (v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v));
  }, [dailyData]);

  const valueChartData = useMemo(() => {
    return getChartDataWithSmartLabels(dailyData, 'value', (v) => `$${v}`);
  }, [dailyData]);

  const bagUpChartData = useMemo(() => {
    return getChartDataWithSmartLabels(dailyData, 'avgBagUpMinutes', (v) => v > 0 ? `${v}m` : "-");
  }, [dailyData]);

  const insights = useMemo((): StatsInsight[] => {
    if (dailyData.length < 2) return [];
    
    const recentDays = dailyData.slice(-7);
    const previousDays = dailyData.slice(-14, -7);
    
    if (previousDays.length === 0) return [];
    
    const avgTreesRecent = recentDays.reduce((s, d) => s + d.trees, 0) / recentDays.length;
    const avgTreesPrevious = previousDays.reduce((s, d) => s + d.trees, 0) / previousDays.length;
    const avgValueRecent = recentDays.reduce((s, d) => s + d.value, 0) / recentDays.length;
    const avgValuePrevious = previousDays.reduce((s, d) => s + d.value, 0) / previousDays.length;
    const avgBagRecent = recentDays.filter(d => d.avgBagUpMinutes > 0).reduce((s, d, _, a) => s + d.avgBagUpMinutes / a.length, 0);
    const avgBagPrevious = previousDays.filter(d => d.avgBagUpMinutes > 0).reduce((s, d, _, a) => s + d.avgBagUpMinutes / a.length, 0);
    
    const treesChange = avgTreesPrevious > 0 ? ((avgTreesRecent - avgTreesPrevious) / avgTreesPrevious * 100) : 0;
    const valueChange = avgValuePrevious > 0 ? ((avgValueRecent - avgValuePrevious) / avgValuePrevious * 100) : 0;
    const bagChange = avgBagPrevious > 0 ? ((avgBagRecent - avgBagPrevious) / avgBagPrevious * 100) : 0;
    
    return [
      {
        label: "Avg Trees/Day",
        value: Math.round(avgTreesRecent).toLocaleString(),
        change: `${treesChange >= 0 ? "+" : ""}${treesChange.toFixed(1)}%`,
        isPositive: treesChange >= 0,
        trend: treesChange > 5 ? "up" : treesChange < -5 ? "down" : "neutral",
      },
      {
        label: "Avg Earnings/Day",
        value: `$${Math.round(avgValueRecent)}`,
        change: `${valueChange >= 0 ? "+" : ""}${valueChange.toFixed(1)}%`,
        isPositive: valueChange >= 0,
        trend: valueChange > 5 ? "up" : valueChange < -5 ? "down" : "neutral",
      },
      {
        label: "Avg Bag-Up Time",
        value: `${Math.round(avgBagRecent)}m`,
        change: `${bagChange >= 0 ? "+" : ""}${bagChange.toFixed(1)}%`,
        isPositive: bagChange <= 0,
        trend: bagChange < -5 ? "up" : bagChange > 5 ? "down" : "neutral",
      },
    ];
  }, [dailyData]);

  const topSpecies = useMemo(() => {
    const speciesMap = new Map<string, number>();
    for (const e of entries) {
      speciesMap.set(e.species, (speciesMap.get(e.species) || 0) + e.total_trees);
    }
    return Array.from(speciesMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, trees]) => ({ name, trees }));
  }, [entries]);

  const topBlocks = useMemo(() => {
    const blockMap = new Map<string, number>();
    for (const e of entries) {
      blockMap.set(e.plot, (blockMap.get(e.plot) || 0) + e.total_trees);
    }
    return Array.from(blockMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, trees]) => ({ name, trees }));
  }, [entries]);

  const avgBagUpMinutes = useMemo(() => {
    const daysWithBagUps = dailyData.filter(d => d.avgBagUpMinutes > 0);
    if (daysWithBagUps.length === 0) return 0;
    return Math.round(daysWithBagUps.reduce((s, d) => s + d.avgBagUpMinutes, 0) / daysWithBagUps.length);
  }, [dailyData]);

  const formatCurrency = (n: number) =>
    "$" + n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  if (loading) {
    return (
      <View style={[globalStyles.screen, { justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: Colors.textMuted }}>Loading insights...</Text>
      </View>
    );
  }

  if (error || !season) {
    return (
      <ScrollView style={globalStyles.screen}>
        <View style={styles.header}>
          <Text style={styles.title}>Insights</Text>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>{error || "Season not found"}</Text>
          <Text style={styles.emptySubtext}>Please try again</Text>
        </View>
      </ScrollView>
    );
  }

  if (dailyData.length === 0) {
    return (
      <ScrollView style={globalStyles.screen}>
        <View style={styles.header}>
          <Text style={styles.title}>Insights</Text>
          <Text style={styles.subtitle}>{season?.name} {season?.year}</Text>
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No data yet</Text>
          <Text style={styles.emptySubtext}>Start adding entries to see insights</Text>
        </View>
      </ScrollView>
    );
  }

  const totalTrees = entries.reduce((s, e) => s + e.total_trees, 0);
  const totalValue = entries.reduce((s, e) => s + e.total_value, 0) + extras.reduce((s, e) => s + e.amount, 0);
  const avgTreesPerDay = dailyData.length > 0 ? totalTrees / dailyData.length : 0;
  const avgValuePerDay = dailyData.length > 0 ? totalValue / dailyData.length : 0;

  return (
    <ScrollView style={globalStyles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Insights</Text>
        <Text style={styles.subtitle}>{season.name} {season.year}</Text>
      </View>

      {/* Overview Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{totalTrees.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Total Trees</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: Colors.green }]}>{formatCurrency(totalValue)}</Text>
          <Text style={styles.statLabel}>Total Earnings</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{dailyData.length}</Text>
          <Text style={styles.statLabel}>Days</Text>
        </View>
      </View>

      {/* Improvement Insights */}
      {insights.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Improvement vs Last Week</Text>
          <View style={styles.insightsRow}>
            {insights.map((insight, idx) => (
              <View key={idx} style={styles.insightCard}>
                <Text style={styles.insightLabel}>{insight.label}</Text>
                <Text style={[
                  styles.insightValue,
                  insight.isPositive ? styles.insightPositive : styles.insightNegative
                ]}>
                  {insight.value}
                </Text>
                <View style={[styles.insightChange, insight.isPositive ? styles.insightChangePositive : styles.insightChangeNegative]}>
                  <Text style={[styles.insightChangeText, insight.isPositive ? styles.insightChangeTextPositive : styles.insightChangeTextNegative]}>
                    {insight.trend === "up" ? "↑" : insight.trend === "down" ? "↓" : "→"} {insight.change}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Averages */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Averages</Text>
        <View style={styles.averagesCard}>
          <View style={styles.averageRow}>
            <Text style={styles.averageLabel}>Trees / day</Text>
            <Text style={styles.averageValue}>{Math.round(avgTreesPerDay).toLocaleString()}</Text>
          </View>
          <View style={styles.averageDivider} />
          <View style={styles.averageRow}>
            <Text style={styles.averageLabel}>Total earnings / day</Text>
            <Text style={[styles.averageValue, { color: Colors.green }]}>{formatCurrency(avgValuePerDay)}</Text>
          </View>
          <View style={styles.averageDivider} />
          <View style={styles.averageRow}>
            <Text style={styles.averageLabel}>Tree earnings / day</Text>
            <Text style={[styles.averageValue, { color: Colors.green }]}>
              {formatCurrency((entries.reduce((s, e) => s + e.total_value, 0)) / dailyData.length)}
            </Text>
          </View>
          <View style={styles.averageDivider} />
          <View style={styles.averageRow}>
            <Text style={styles.averageLabel}>Extras / day</Text>
            <Text style={[styles.averageValue, { color: Colors.green }]}>
              {formatCurrency((extras.reduce((s, e) => s + e.amount, 0)) / dailyData.length)}
            </Text>
          </View>
          <View style={styles.averageDivider} />
          <View style={styles.averageRow}>
            <Text style={styles.averageLabel}>Bag ups / day</Text>
            <Text style={styles.averageValue}>{(entries.length / dailyData.length).toFixed(1)}</Text>
          </View>
          <View style={styles.averageDivider} />
          <View style={styles.averageRow}>
            <Text style={styles.averageLabel}>Avg bag-up time</Text>
            <Text style={styles.averageValue}>
              {dailyData.filter(d => d.avgBagUpMinutes > 0).length > 0
                ? `${Math.round(dailyData.filter(d => d.avgBagUpMinutes > 0).reduce((s, d) => s + d.avgBagUpMinutes, 0) / dailyData.filter(d => d.avgBagUpMinutes > 0).length)}m`
                : "-"}
            </Text>
          </View>
        </View>
      </View>

      {/* Top Days */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Top Days</Text>
        <View style={styles.topDaysCard}>
          {topTreeDay && (
            <TouchableOpacity 
              style={styles.topDayRow}
              onPress={() => router.push({
                pathname: "/tally/[date]",
                params: { date: topTreeDay.date, seasonId: String(season?.id), tableName: season?.table_name },
              })}
            >
              <View style={styles.topDayLeft}>
                <View>
                  <Text style={styles.topDayLabel}>Top Trees Day</Text>
                  <Text style={styles.topDayValue}>{topTreeDay.trees.toLocaleString()} trees</Text>
                </View>
              </View>
              <View style={styles.topDayRight}>
                <Text style={styles.topDayDate}>{formatDateShort(topTreeDay.date)}</Text>
                <Text style={styles.topDayArrow}>→</Text>
              </View>
            </TouchableOpacity>
          )}
          {topMoneyDay && (
            <TouchableOpacity 
              style={styles.topDayRow}
              onPress={() => router.push({
                pathname: "/tally/[date]",
                params: { date: topMoneyDay.date, seasonId: String(season?.id), tableName: season?.table_name },
              })}
            >
              <View style={styles.topDayLeft}>
                <View>
                  <Text style={styles.topDayLabel}>Top Money Day</Text>
                  <Text style={[styles.topDayValue, { color: Colors.green }]}>
                    {formatCurrency(topMoneyDay.value + topMoneyDay.extra)}
                  </Text>
                </View>
              </View>
              <View style={styles.topDayRight}>
                <Text style={styles.topDayDate}>{formatDateShort(topMoneyDay.date)}</Text>
                <Text style={styles.topDayArrow}>→</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Top Section */}
      <View style={styles.section}>
        <View style={styles.topCard}>
          {topSpeciesData && (
            <View style={styles.topRow}>
              <Text style={styles.topLabel}>Top species</Text>
              <Text style={styles.topValue}>{topSpeciesData.name}</Text>
              <Text style={styles.topSubtext}>{topSpeciesData.trees.toLocaleString()} trees</Text>
            </View>
          )}
          <View style={styles.topDivider} />
          {highestPriceEntry && (
            <View style={styles.topRow}>
              <Text style={styles.topLabel}>Highest price/tree</Text>
              <Text style={[styles.topValue, { color: Colors.green }]}>${highestPriceEntry.price_per_tree.toFixed(3)}</Text>
              <Text style={styles.topSubtext}>{highestPriceEntry.species}</Text>
            </View>
          )}
          <View style={styles.topDivider} />
          {lowestPriceEntry && (
            <View style={styles.topRow}>
              <Text style={styles.topLabel}>Lowest price/tree</Text>
              <Text style={[styles.topValue, { color: Colors.green }]}>${lowestPriceEntry.price_per_tree.toFixed(3)}</Text>
              <Text style={styles.topSubtext}>{lowestPriceEntry.species}</Text>
            </View>
          )}
          {lowestPriceEntry && <View style={styles.topDivider} />}
          {largestBagUp && (
            <TouchableOpacity 
              style={styles.topRow}
              onPress={() => router.push({
                pathname: "/tally/[date]",
                params: { date: largestBagUp.date, seasonId: String(season?.id), tableName: season?.table_name },
              })}
            >
              <Text style={styles.topLabel}>Largest bag up</Text>
              <Text style={[styles.topValue, { color: Colors.accent }]}>{largestBagUp.total_trees.toLocaleString()} trees</Text>
              <Text style={styles.topSubtext}>{formatDateShort(largestBagUp.date)}</Text>
            </TouchableOpacity>
          )}
          <View style={styles.topDivider} />
          {longestBagUp && (
            <TouchableOpacity 
              style={styles.topRow}
              onPress={() => router.push({
                pathname: "/tally/[date]",
                params: { date: longestBagUp.entry.date, seasonId: String(season?.id), tableName: season?.table_name },
              })}
            >
              <Text style={styles.topLabel}>Longest bag up</Text>
              <Text style={styles.topValue}>{longestBagUp.minutes}m</Text>
              <Text style={styles.topSubtext}>{formatDateShort(longestBagUp.entry.date)}</Text>
            </TouchableOpacity>
          )}
          <View style={styles.topDivider} />
          {topExtrasDay && topExtrasDay.extra > 0 && (
            <TouchableOpacity 
              style={styles.topRow}
              onPress={() => router.push({
                pathname: "/tally/[date]",
                params: { date: topExtrasDay.date, seasonId: String(season?.id), tableName: season?.table_name },
              })}
            >
              <Text style={styles.topLabel}>Top extras day</Text>
              <Text style={[styles.topValue, { color: Colors.green }]}>{formatCurrency(topExtrasDay.extra)}</Text>
              <Text style={styles.topSubtext}>{formatDateShort(topExtrasDay.date)}</Text>
            </TouchableOpacity>
          )}
          <View style={styles.topDivider} />
          {longestDay && (
            <TouchableOpacity 
              style={styles.topRow}
              onPress={() => router.push({
                pathname: "/tally/[date]",
                params: { date: longestDay.date, seasonId: String(season?.id), tableName: season?.table_name },
              })}
            >
            <Text style={styles.topLabel}>Longest day</Text>
            <Text style={styles.topValue}>{longestDay.hours}h</Text>
            <Text style={styles.topSubtext}>{formatDateShort(longestDay.date)}</Text>
          </TouchableOpacity>
        )}
        </View>
      </View>

      {/* Trees Per Day Chart */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Trees Planted Per Day</Text>
        <View style={styles.chartCard}>
          <View style={styles.chartStats}>
            <View style={styles.chartStat}>
              <Text style={styles.chartStatValue}>{Math.round(avgTreesPerDay).toLocaleString()}</Text>
              <Text style={styles.chartStatLabel}>avg/day</Text>
            </View>
            <View style={styles.chartStat}>
              <Text style={[styles.chartStatValue, { color: Colors.green }]}>
                {Math.max(...dailyData.map(d => d.trees)).toLocaleString()}
              </Text>
              <Text style={styles.chartStatLabel}>best day</Text>
            </View>
          </View>
          {treesChartData.length > 0 && (
            <LineChart
              data={treesChartData}
              width={CHART_WIDTH}
              height={120}
              spacing={Math.min(30, CHART_WIDTH / (treesChartData.length + 2))}
              color={Colors.accent}
              dataPointsColor={Colors.accent}
              dataPointsRadius={3}
              curved
              thickness={2}
              hideDataPoints={treesChartData.length > 8}
              xAxisColor={Colors.border}
              yAxisColor={Colors.border}
              yAxisTextStyle={{ color: Colors.textMuted, fontSize: 10 }}
              xAxisLabelTextStyle={{ color: Colors.textMuted, fontSize: 10 }}
              noOfSections={4}
              maxValue={Math.max(...treesChartData.map(d => d.value)) * 1.2}
              yAxisLabelSuffix=""
              showVerticalLines
              verticalLinesColor={Colors.border}
              hideRules
              yAxisOffset={0}
            />
          )}
        </View>
      </View>

      {/* Earnings Per Day Chart */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Earnings Per Day</Text>
        <View style={styles.chartCard}>
          <View style={styles.chartStats}>
            <View style={styles.chartStat}>
              <Text style={[styles.chartStatValue, { color: Colors.green }]}>{formatCurrency(avgValuePerDay)}</Text>
              <Text style={styles.chartStatLabel}>avg/day</Text>
            </View>
            <View style={styles.chartStat}>
              <Text style={[styles.chartStatValue, { color: Colors.green }]}>
                {formatCurrency(Math.max(...dailyData.map(d => d.value + d.extra)))}
              </Text>
              <Text style={styles.chartStatLabel}>best day</Text>
            </View>
          </View>
          {valueChartData.length > 0 && (
            <LineChart
              data={valueChartData}
              width={CHART_WIDTH}
              height={120}
              spacing={Math.min(30, CHART_WIDTH / (valueChartData.length + 2))}
              color={Colors.green}
              dataPointsColor={Colors.green}
              dataPointsRadius={3}
              curved
              thickness={2}
              hideDataPoints={valueChartData.length > 8}
              xAxisColor={Colors.border}
              yAxisColor={Colors.border}
              yAxisTextStyle={{ color: Colors.textMuted, fontSize: 10 }}
              xAxisLabelTextStyle={{ color: Colors.textMuted, fontSize: 10 }}
              noOfSections={4}
              maxValue={Math.max(...valueChartData.map(d => d.value)) * 1.2}
              yAxisLabelSuffix=""
              showVerticalLines
              verticalLinesColor={Colors.border}
              hideRules
              yAxisOffset={0}
            />
          )}
        </View>
      </View>

      {/* Bag-Up Time Chart */}
      {bagUpChartData.some(d => d.value > 0) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Avg Bag-Up Time</Text>
          <View style={styles.chartCard}>
            <View style={styles.chartStats}>
              <View style={styles.chartStat}>
                <Text style={styles.chartStatValue}>
                  {Math.round(dailyData.filter(d => d.avgBagUpMinutes > 0).reduce((s, d) => s + d.avgBagUpMinutes, 0) / dailyData.filter(d => d.avgBagUpMinutes > 0).length)}m
                </Text>
                <Text style={styles.chartStatLabel}>avg time</Text>
              </View>
              <View style={styles.chartStat}>
                <Text style={[styles.chartStatValue, { color: Colors.green }]}>
                  {Math.min(...dailyData.filter(d => d.avgBagUpMinutes > 0).map(d => d.avgBagUpMinutes))}m
                </Text>
                <Text style={styles.chartStatLabel}>best day</Text>
              </View>
            </View>
            <LineChart
              data={bagUpChartData.filter(d => d.value > 0)}
              width={CHART_WIDTH}
              height={100}
              spacing={Math.min(30, CHART_WIDTH / (bagUpChartData.filter(d => d.value > 0).length + 2))}
              color={Colors.accent}
              dataPointsColor={Colors.accent}
              dataPointsRadius={3}
              curved
              thickness={2}
              xAxisColor={Colors.border}
              yAxisColor={Colors.border}
              yAxisTextStyle={{ color: Colors.textMuted, fontSize: 10 }}
              xAxisLabelTextStyle={{ color: Colors.textMuted, fontSize: 10 }}
              noOfSections={4}
              maxValue={Math.max(...bagUpChartData.map(d => d.value)) * 1.3}
              yAxisLabelSuffix="m"
              showVerticalLines
              verticalLinesColor={Colors.border}
              hideRules
              yAxisOffset={0}
            />
            <Text style={styles.chartNote}>Lower is better - shows efficiency improvement</Text>
          </View>
        </View>
      )}

      <View style={{ height: 80 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: Spacing.md,
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
  statsRow: {
    flexDirection: "row",
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    alignItems: "center",
  },
  statValue: {
    color: Colors.textPrimary,
    fontSize: Typography.subtitleSize,
    fontWeight: Typography.fontWeight.heavy,
  },
  statLabel: {
    color: Colors.textMuted,
    fontSize: Typography.captionSize,
    marginTop: 4,
  },
  section: {
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.subtitleSize,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.sm,
  },
  insightsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  insightCard: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    alignItems: "center",
  },
  insightLabel: {
    color: Colors.textMuted,
    fontSize: Typography.captionSize,
    marginBottom: 4,
  },
  insightValue: {
    fontSize: Typography.subtitleSize,
    fontWeight: Typography.fontWeight.heavy,
  },
  insightPositive: {
    color: Colors.green,
  },
  insightNegative: {
    color: Colors.danger,
  },
  insightChange: {
    marginTop: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.full,
  },
  insightChangePositive: {
    backgroundColor: Colors.greenMuted,
  },
  insightChangeNegative: {
    backgroundColor: Colors.dangerDim,
  },
  insightChangeText: {
    fontSize: Typography.captionSize,
    fontWeight: Typography.fontWeight.semibold,
  },
  insightChangeTextPositive: {
    color: Colors.green,
  },
  insightChangeTextNegative: {
    color: Colors.danger,
  },
  chartCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  chartStats: {
    flexDirection: "row",
    marginBottom: Spacing.md,
  },
  chartStat: {
    flex: 1,
  },
  chartStatValue: {
    color: Colors.textPrimary,
    fontSize: Typography.subtitleSize,
    fontWeight: Typography.fontWeight.bold,
  },
  chartStatLabel: {
    color: Colors.textMuted,
    fontSize: Typography.captionSize,
  },
  chartNote: {
    color: Colors.textMuted,
    fontSize: Typography.captionSize,
    fontStyle: "italic",
    textAlign: "center",
    marginTop: Spacing.sm,
  },
  rankingCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  rankingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rankingLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  rankingNum: {
    color: Colors.textMuted,
    fontSize: Typography.bodySize,
    fontWeight: Typography.fontWeight.bold,
    width: 20,
  },
  rankingName: {
    color: Colors.textPrimary,
    fontSize: Typography.bodySize,
  },
  rankingValue: {
    color: Colors.accent,
    fontSize: Typography.bodySize,
    fontWeight: Typography.fontWeight.semibold,
  },
  topCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  topRow: {
    paddingVertical: Spacing.xs,
  },
  topLabel: {
    color: Colors.textSecondary,
    fontSize: Typography.captionSize,
  },
  topValue: {
    color: Colors.textPrimary,
    fontSize: Typography.subtitleSize,
    fontWeight: Typography.fontWeight.bold,
    marginTop: 2,
  },
  topSubtext: {
    color: Colors.textMuted,
    fontSize: Typography.captionSize,
    marginTop: 2,
  },
  topDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.sm,
  },
  averagesCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  averageRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.xs,
  },
  averageLabel: {
    color: Colors.textSecondary,
    fontSize: Typography.bodySize,
  },
  averageValue: {
    color: Colors.textPrimary,
    fontSize: Typography.bodySize,
    fontWeight: Typography.fontWeight.semibold,
  },
  averageDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.xs,
  },
  emptyState: {
    padding: Spacing.xxl,
    alignItems: "center",
  },
  emptyText: {
    color: Colors.textPrimary,
    fontSize: Typography.subtitleSize,
    fontWeight: Typography.fontWeight.bold,
  },
  emptySubtext: {
    color: Colors.textMuted,
    fontSize: Typography.bodySize,
    marginTop: Spacing.xs,
  },
  topDaysCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  topDayRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  topDayLeft: {
    flex: 1,
  },
  topDayLabel: {
    color: Colors.textSecondary,
    fontSize: Typography.captionSize,
  },
  topDayValue: {
    color: Colors.textPrimary,
    fontSize: Typography.bodySize,
    fontWeight: Typography.fontWeight.bold,
  },
  topDayRight: {
    alignItems: "flex-end",
  },
  topDayDate: {
    color: Colors.textPrimary,
    fontSize: Typography.bodySize,
    fontWeight: Typography.fontWeight.semibold,
  },
  topDayArrow: {
    color: Colors.textMuted,
    fontSize: Typography.bodySize,
  },
});
