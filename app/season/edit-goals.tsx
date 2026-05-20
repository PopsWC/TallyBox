import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { getSeasons, updateSeasonGoals, Season } from "@/lib/database";
import { Button, LabeledInput, Divider } from "@/components/ui";
import { Colors, Typography, Spacing, Radius, globalStyles } from "@/lib/theme";

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default function EditSeasonGoalsScreen() {
  const params = useLocalSearchParams<{ seasonId: string }>();
  const seasonId = param(params.seasonId);
  const router = useRouter();

  const [season, setSeason] = useState<Season | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [dailyGoal, setDailyGoal] = useState("");
  const [seasonGoal, setSeasonGoal] = useState("");

  useEffect(() => {
    loadSeason();
  }, []);

  const loadSeason = async () => {
    try {
      const seasons = await getSeasons();
      const s = seasons.find((x) => String(x.id) === seasonId);
      if (s) {
        setSeason(s);
        setDailyGoal(s.daily_goal ? String(s.daily_goal) : "");
        setSeasonGoal(s.season_goal ? String(s.season_goal) : "");
      }
    } catch {
      Alert.alert("Error", "Failed to load season");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const daily = dailyGoal ? parseFloat(dailyGoal) : undefined;
    const season = seasonGoal ? parseFloat(seasonGoal) : undefined;

    if (dailyGoal && daily !== undefined && (isNaN(daily) || daily <= 0)) {
      Alert.alert("Invalid Goal", "Please enter a valid daily goal or leave empty.");
      return;
    }
    if (seasonGoal && season !== undefined && (isNaN(season) || season <= 0)) {
      Alert.alert("Invalid Goal", "Please enter a valid season goal or leave empty.");
      return;
    }

    setSaving(true);
    try {
      await updateSeasonGoals(parseInt(seasonId, 10), daily, season);
      Alert.alert("Saved", "Goals have been updated.");
      router.back();
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to save goals");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !season) {
    return (
      <View style={[globalStyles.screen, { justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: Colors.textMuted }}>Loading...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={globalStyles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ padding: Spacing.md, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.seasonName}>
            {season.name} {season.year}
          </Text>
          <Text style={styles.seasonSub}>Edit Earnings Goals</Text>
        </View>

        <Divider style={{ marginVertical: Spacing.md }} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Earnings Goals</Text>
          <Text style={styles.sectionSub}>
            Set monetary goals to track your progress throughout the season.
          </Text>

          <LabeledInput
            label="Daily Earnings Goal ($)"
            value={dailyGoal}
            onChangeText={setDailyGoal}
            placeholder="e.g. 200"
            keyboardType="decimal-pad"
            returnKeyType="next"
          />

          <LabeledInput
            label="Season Earnings Goal ($)"
            value={seasonGoal}
            onChangeText={setSeasonGoal}
            placeholder="e.g. 10000"
            keyboardType="decimal-pad"
          />
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Tips</Text>
          <Text style={styles.infoBody}>
            • Daily goal: What you aim to earn each planting day{"\n"}
            • Season goal: Total earnings target for the entire season{"\n"}
            • Leave empty to remove a goal
          </Text>
        </View>

        <Button
          label="Save Goals"
          onPress={handleSave}
          loading={saving}
          size="lg"
          style={{ marginTop: Spacing.lg }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: Spacing.sm,
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
  section: {
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.subtitleSize,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.xs,
  },
  sectionSub: {
    color: Colors.textMuted,
    fontSize: Typography.captionSize,
    marginBottom: Spacing.md,
    lineHeight: 18,
  },
  infoCard: {
    backgroundColor: Colors.accentMuted,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.accentDim,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  infoTitle: {
    color: Colors.accent,
    fontSize: Typography.bodySize,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.xs,
  },
  infoBody: {
    color: Colors.textSecondary,
    fontSize: Typography.captionSize,
    lineHeight: 20,
  },
});
