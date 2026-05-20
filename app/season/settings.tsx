import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Modal,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { getSeasons, updateSeason, deleteSeason, getEntriesForSeason, Season } from "@/lib/database";
import { shareSeasonCsv, shareSeasonJson } from "@/lib/functions/export";
import { Button, LabeledInput, Divider } from "@/components/ui";
import { Colors, Typography, Spacing, Radius, globalStyles } from "@/lib/theme";

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default function SeasonSettingsScreen() {
  const params = useLocalSearchParams<{ seasonId: string }>();
  const seasonId = param(params.seasonId);
  const router = useRouter();

  const [season, setSeason] = useState<Season | null>(null);
  const [name, setName] = useState("");
  const [year, setYear] = useState("");
  const [crewBoss, setCrewBoss] = useState("");
  const [dailyGoal, setDailyGoal] = useState("");
  const [seasonGoal, setSeasonGoal] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteSeasonName, setDeleteSeasonName] = useState("");

  useEffect(() => {
    loadSeason();
  }, []);

  const loadSeason = async () => {
    try {
      const seasons = await getSeasons();
      const s = seasons.find((x) => String(x.id) === seasonId);
      if (s) {
        setSeason(s);
        setName(s.name);
        setYear(String(s.year));
        setCrewBoss(s.crew_boss || "");
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
    const parsedYear = parseInt(year, 10);
    if (!name.trim()) {
      Alert.alert("Missing Info", "Please enter a season name.");
      return;
    }
    if (isNaN(parsedYear) || parsedYear < 2000 || parsedYear > 2100) {
      Alert.alert("Invalid Year", "Please enter a valid year.");
      return;
    }

    const daily = dailyGoal ? parseFloat(dailyGoal) : undefined;
    const seasonG = seasonGoal ? parseFloat(seasonGoal) : undefined;
    if (dailyGoal && (isNaN(daily!) || daily! < 0)) {
      Alert.alert("Invalid Daily Goal", "Please enter a valid daily goal.");
      return;
    }
    if (seasonGoal && (isNaN(seasonG!) || seasonG! < 0)) {
      Alert.alert("Invalid Season Goal", "Please enter a valid season goal.");
      return;
    }

    setSaving(true);
    try {
      await updateSeason(
        parseInt(seasonId, 10),
        name.trim(),
        parsedYear,
        crewBoss.trim(),
        daily,
        seasonG
      );
      Alert.alert("Saved", "Season settings have been saved.");
      router.back();
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

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
    Alert.alert("Export Season", "Choose format:", [
      { text: "Cancel", style: "cancel" },
      { text: "CSV (spreadsheet)", onPress: () => handleExport("csv") },
      { text: "JSON (companion app)", onPress: () => handleExport("json") },
    ]);
  };

  const handleDelete = () => {
    setDeleteSeasonName(season?.name || "");
    setDeleteConfirm("");
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (deleteConfirm !== deleteSeasonName) {
      Alert.alert("Wrong Name", "The name doesn't match. Please try again.");
      return;
    }
    setShowDeleteModal(false);
    const seasonYear = season?.year || "";
    Alert.alert(
      "Delete Season",
      `Permanently delete "${deleteSeasonName} ${seasonYear}" and all its tally data? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteSeason(season!.id, season!.table_name);
            router.replace("/");
          },
        },
      ]
    );
  };

  if (loading) {
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
      <ScrollView contentContainerStyle={{ padding: Spacing.md, paddingBottom: 100 }}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Season Details</Text>

          <LabeledInput
            label="Season Name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Spring"
            autoCapitalize="words"
          />

          <LabeledInput
            label="Year"
            value={year}
            onChangeText={setYear}
            placeholder="e.g. 2026"
            keyboardType="number-pad"
          />

          <LabeledInput
            label="Crew Boss"
            value={crewBoss}
            onChangeText={setCrewBoss}
            placeholder="e.g. John Smith"
            autoCapitalize="words"
          />
        </View>

        <Divider style={{ marginVertical: Spacing.md }} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Goals</Text>
          <Text style={styles.sectionSub}>
            Set earning goals for this season. Leave empty to remove a goal.
          </Text>

          <LabeledInput
            label="Daily Goal ($)"
            value={dailyGoal}
            onChangeText={setDailyGoal}
            placeholder="e.g. 500"
            keyboardType="decimal-pad"
          />

          <LabeledInput
            label="Season Goal ($)"
            value={seasonGoal}
            onChangeText={setSeasonGoal}
            placeholder="e.g. 10000"
            keyboardType="decimal-pad"
          />
        </View>

        <Divider style={{ marginVertical: Spacing.md }} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Actions</Text>
          
          <Button
            label="Export Season Data"
            variant="secondary"
            onPress={handleExportPrompt}
            loading={exporting}
            style={{ marginBottom: Spacing.sm }}
          />
        </View>

        <Divider style={{ marginVertical: Spacing.md }} />

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: Colors.danger }]}>Danger Zone</Text>
          <Text style={styles.sectionSub}>
            Permanently delete this season and all its tally data.
          </Text>
          
          <Button
            label="Delete Season"
            variant="danger"
            onPress={handleDelete}
          />
        </View>

        <Button
          label="Save Changes"
          onPress={handleSave}
          loading={saving}
          size="lg"
          style={{ marginTop: Spacing.lg }}
        />
      </ScrollView>

      {/* Delete Confirmation Modal */}
      <Modal visible={showDeleteModal} transparent animationType="fade">
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowDeleteModal(false)}
        >
          <TouchableOpacity style={styles.modalContent} activeOpacity={1}>
            <Text style={styles.modalTitle}>Confirm Deletion</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              <Text style={styles.modalBody}>Type the season name "</Text>
              <Text style={[styles.modalBody, styles.boldText]}>{deleteSeasonName}</Text>
              <Text style={styles.modalBody}>" to confirm deletion. This is case-sensitive.</Text>
            </View>
            <LabeledInput
              label="Season name"
              value={deleteConfirm}
              onChangeText={setDeleteConfirm}
              placeholder="Type here"
              autoCapitalize="none"
              style={{ marginBottom: Spacing.md }}
            />
            <View style={styles.modalButtons}>
              <Button
                label="Cancel"
                variant="secondary"
                onPress={() => { setShowDeleteModal(false); setDeleteConfirm(""); }}
                style={{ flex: 1 }}
              />
              <Button
                label="Delete"
                variant="danger"
                onPress={confirmDelete}
                disabled={deleteConfirm !== deleteSeasonName}
                style={{ flex: 1 }}
              />
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: Spacing.sm,
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
    marginBottom: Spacing.sm,
  },
  modalBody: {
    color: Colors.textSecondary,
    fontSize: Typography.bodySize,
    marginBottom: Spacing.md,
  },
  boldText: {
    fontWeight: Typography.fontWeight.bold,
  },
  modalButtons: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
});
