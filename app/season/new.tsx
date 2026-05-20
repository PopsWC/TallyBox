import React, { useState } from "react";
import {
  View,
  Text,
  Alert,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { createSeason } from "@/lib/database";
import { useActiveSeason } from "@/contexts/active-season";
import { Button, LabeledInput } from "@/components/ui";
import { Colors, Typography, Spacing, Radius, globalStyles } from "@/lib/theme";

export default function NewSeasonScreen() {
  const router = useRouter();
  const { setActiveSeason } = useActiveSeason();
  const [name, setName] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [crewBoss, setCrewBoss] = useState("");
  const [dailyGoal, setDailyGoal] = useState("");
  const [seasonGoal, setSeasonGoal] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert("Missing Info", "Please enter a season name.");
      return;
    }
    const y = parseInt(year, 10);
    if (isNaN(y) || y < 2000 || y > 2100) {
      Alert.alert("Invalid Year", "Please enter a valid year (e.g. 2025).");
      return;
    }

    const daily = dailyGoal ? parseFloat(dailyGoal) : undefined;
    const season = seasonGoal ? parseFloat(seasonGoal) : undefined;

    if (dailyGoal && (isNaN(daily!) || daily! <= 0)) {
      Alert.alert("Invalid Goal", "Please enter a valid daily goal or leave empty.");
      return;
    }
    if (seasonGoal && (isNaN(season!) || season! <= 0)) {
      Alert.alert("Invalid Goal", "Please enter a valid season goal or leave empty.");
      return;
    }

    setSaving(true);
    try {
      const id = await createSeason(trimmedName, y, crewBoss.trim(), daily, season);
      const { getSeasons } = await import("@/lib/database");
      const seasons = await getSeasons();
      const created = seasons.find((s) => s.id === id);
      if (created) setActiveSeason(created);
      router.back();
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to create season.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={globalStyles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ padding: Spacing.md, paddingBottom: 80 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>About Seasons</Text>
          <Text style={styles.infoBody}>
            Each season has its own data. All entries, plots, and species belong to a season. You
            can export any season independently.
          </Text>
        </View>

        <LabeledInput
          label="Season Name"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Spring Block A, Boreal 2025"
          autoFocus
          autoCapitalize="words"
        />

        <LabeledInput
          label="Year"
          value={year}
          onChangeText={setYear}
          placeholder="2025"
          keyboardType="number-pad"
          maxLength={4}
        />

        <LabeledInput
          label="Crew Boss"
          value={crewBoss}
          onChangeText={setCrewBoss}
          placeholder="e.g. John Smith"
          autoCapitalize="words"
        />

        <View style={styles.goalsSection}>
          <Text style={styles.goalsTitle}>Earnings Goals (Optional)</Text>
          <Text style={styles.goalsSub}>Set monetary goals to track your progress.</Text>

          <LabeledInput
            label="Daily Earnings Goal ($)"
            value={dailyGoal}
            onChangeText={setDailyGoal}
            placeholder="e.g. 200"
            keyboardType="decimal-pad"
          />

          <LabeledInput
            label="Season Earnings Goal ($)"
            value={seasonGoal}
            onChangeText={setSeasonGoal}
            placeholder="e.g. 10000"
            keyboardType="decimal-pad"
          />
        </View>

        <Button
          label="Create Season"
          onPress={handleCreate}
          loading={saving}
          size="lg"
          style={{ marginTop: Spacing.md }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  infoCard: {
    backgroundColor: Colors.accentMuted,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.accentDim,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  infoTitle: {
    color: Colors.accent,
    fontSize: Typography.bodySize,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.xs,
  },
  infoBody: {
    color: Colors.textSecondary,
    fontSize: Typography.bodySize,
    lineHeight: 22,
  },
  goalsSection: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  goalsTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.bodySize,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.xs,
  },
  goalsSub: {
    color: Colors.textMuted,
    fontSize: Typography.captionSize,
    marginBottom: Spacing.md,
  },
});
