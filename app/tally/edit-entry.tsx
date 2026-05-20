import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  TextInput,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { updateEntry, TallyEntry, getSpeciesCatalog, Species, deleteEntry } from "@/lib/database";
import { Button, LabeledInput, Divider } from "@/components/ui";
import { Colors, Typography, Spacing, Radius, globalStyles } from "@/lib/theme";

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function parseEntry(json: string): TallyEntry {
  try {
    return JSON.parse(json);
  } catch {
    throw new Error("Invalid entry data");
  }
}

const BUNDLE_SIZE_PRESETS = [25, 50, 100, 200];

export default function EditEntryScreen() {
  const params = useLocalSearchParams<{ entryJson: string; tableName: string }>();
  const router = useRouter();
  const tableName = param(params.tableName);

  const [entry, setEntry] = useState<TallyEntry | null>(null);
  const [parseError, setParseError] = useState(false);
  const [speciesList, setSpeciesList] = useState<Species[]>([]);
  const [speciesModalVisible, setSpeciesModalVisible] = useState(false);
  const [currentSpecies, setCurrentSpecies] = useState<Species | null>(null);

  const [planterName, setPlanterName] = useState("");
  const [species, setSpecies] = useState("");
  const [plot, setPlot] = useState("");
  const [cache, setCache] = useState("");
  const [pricePerTree, setPricePerTree] = useState("");
  const [treeCount, setTreeCount] = useState("");
  const [treesPerBundle, setTreesPerBundle] = useState("15");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedTime, setSelectedTime] = useState<Date | null>(null);

  const loadSpecies = useCallback(async () => {
    const data = await getSpeciesCatalog();
    setSpeciesList(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSpecies();
    }, [loadSpecies])
  );

  useEffect(() => {
    try {
      const parsed = parseEntry(param(params.entryJson));
      setEntry(parsed);
      setPlanterName(parsed.planter_name);
      setSpecies(parsed.species);
      setPlot(parsed.plot);
      setPricePerTree(String(parsed.price_per_tree));
      setTreeCount(String(parsed.bundle_count * parsed.trees_per_bundle));
      setTreesPerBundle(String(parsed.trees_per_bundle));
      // Set cache from the dedicated cache field (with fallback to parsing from notes for old entries)
      if (parsed.cache) {
        setCache(parsed.cache);
      } else if (parsed.notes) {
        // Fallback: Parse cache from notes for old entries
        const parts = parsed.notes.split(" - ");
        if (parts.length >= 2) {
          setCache(parts[0]);
        } else if (parsed.notes.length <= 5 && /^[A-Za-z0-9]+$/.test(parsed.notes)) {
          setCache(parsed.notes);
        } else {
          setCache("");
        }
      } else {
        setCache("");
      }
      // Notes should only contain the actual notes (not the cache prefix)
      if (parsed.notes) {
        const parts = parsed.notes.split(" - ");
        if (parts.length >= 2) {
          // This is old format with cache prefix, extract notes after cache
          setNotes(parts.slice(1).join(" - "));
        } else if (parsed.notes.length <= 5 && /^[A-Za-z0-9]+$/.test(parsed.notes)) {
          // This was parsed as cache, so notes is empty
          setNotes("");
        } else {
          // This is pure notes (no cache)
          setNotes(parsed.notes);
        }
      } else {
        setNotes("");
      }
      // Parse the time from created_at
      if (parsed.created_at) {
        const timePart = parsed.created_at.split(" ")[1];
        if (timePart) {
          const parts = timePart.split(":");
          const hours = parseInt(parts[0], 10);
          const minutes = parseInt(parts[1], 10);
          const seconds = parts[2] ? parseInt(parts[2], 10) : 0;
          if (!isNaN(hours) && !isNaN(minutes)) {
            const time = new Date();
            time.setHours(hours, minutes, isNaN(seconds) ? 0 : seconds, 0);
            setSelectedTime(time);
          }
        }
      }
    } catch {
      setParseError(true);
    }
  }, [params.entryJson]);

  useEffect(() => {
    if (parseError) {
      Alert.alert("Error", "Invalid entry data");
      router.back();
    }
  }, [parseError, router]);

  useEffect(() => {
    getSpeciesCatalog().then((data) => {
      setSpeciesList(data);
      // Find and set currentSpecies if we have an entry loaded
      if (entry) {
        const matched = data.find(
          (s) => s.name === entry.species || s.request_key === entry.species
        );
        if (matched) {
          setCurrentSpecies(matched);
        }
      }
    }).catch(() => {});
  }, []);

  if (parseError || !entry) {
    return (
      <View style={globalStyles.screen}>
        <Text style={{ color: Colors.textMuted }}>Loading...</Text>
      </View>
    );
  }

  const totalTrees = parseInt(treeCount, 10) || 0;
  const totalValue = totalTrees * (parseFloat(pricePerTree) || 0);

  const formatTime = (d: Date) => {
    return d.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit", hour12: true });
  };

  const formatTimeForStorage = (d: Date) => {
    return d.toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit", hour12: false });
  };

  const handleTimeChange = (event: any, time?: Date) => {
    setShowTimePicker(Platform.OS === "ios");
    if (time) {
      setSelectedTime(time);
    }
  };

  const handleSave = async () => {
    if (!species.trim()) return Alert.alert("Missing Info", "Please select a tree species.");
    if (!plot.trim()) return Alert.alert("Missing Info", "Please enter a block.");
    const price = parseFloat(pricePerTree);
    if (isNaN(price) || price <= 0)
      return Alert.alert("Invalid Price", "Enter a valid price per tree (e.g. 0.22).");
    const tc = parseInt(treeCount, 10);
    if (isNaN(tc) || tc <= 0) return Alert.alert("Invalid Count", "Enter number of trees.");
    const tpb = parseInt(treesPerBundle, 10);
    if (isNaN(tpb) || tpb <= 0) return Alert.alert("Invalid Count", "Invalid trees per bundle.");
    
    // Validate tree count is divisible by bundle size
    if (tc % tpb !== 0) {
      return Alert.alert(
        "Invalid Tree Count",
        `Tree count (${tc}) must be divisible by bundle size (${tpb}).`
      );
    }

    setSaving(true);
    try {
      const timeToUse = selectedTime || new Date();
      const timeStr = `${entry.date} ${formatTimeForStorage(timeToUse)}`;
      await updateEntry(tableName, {
        ...entry,
        planter_name: planterName.trim() || "Unnamed",
        species: species.trim(),
        plot: plot.trim(),
        cache: cache.trim(),
        price_per_tree: price,
        bundle_count: Math.round(tc / tpb),
        trees_per_bundle: tpb,
        total_trees: tc,
        total_value: tc * price,
        notes: notes.trim() || null,
      }, timeStr);
      router.back();
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!entry) return;
    Alert.alert(
      "Delete Entry",
      `Remove ${totalTrees} trees (${species} - ${plot})?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteEntry(tableName, entry.id);
            router.back();
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      style={globalStyles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ padding: Spacing.md, paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.preview}>
          <View style={styles.previewStat}>
            <Text style={[styles.previewValue, { color: Colors.textPrimary }]}>{totalTrees.toLocaleString()}</Text>
            <Text style={styles.previewLabel}>trees</Text>
          </View>
          <View style={styles.previewDivider} />
          <View style={styles.previewStat}>
            <Text style={[styles.previewValue, { color: Colors.green }]}>
              ${totalValue.toFixed(2)}
            </Text>
            <Text style={styles.previewLabel}>earnings</Text>
          </View>
        </View>

        <View style={{ marginBottom: Spacing.md }}>
          <Text style={globalStyles.label}>Tree Species</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
            <TouchableOpacity
              style={[styles.speciesSelector, { flex: 1 }]}
              onPress={() => setSpeciesModalVisible(true)}
            >
              <Text style={[styles.speciesSelectorText, !species && styles.speciesSelectorPlaceholder]}>
                {species || "Select species..."}
              </Text>
              <Text style={styles.speciesSelectorArrow}>▼</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.addSpeciesBtn}
              onPress={() => router.push("/species")}
            >
              <Text style={styles.addSpeciesBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: Spacing.sm }}>
          <View style={{ flex: 1 }}>
            <LabeledInput
              label="Block"
              value={plot}
              onChangeText={setPlot}
              autoCapitalize="words"
            />
          </View>
          <View style={{ flex: 1 }}>
            <LabeledInput
              label="Cache"
              value={cache}
              onChangeText={setCache}
              placeholder="e.g. A1"
              autoCapitalize="characters"
            />
          </View>
        </View>

        <LabeledInput
          label="Price per Tree ($)"
          value={pricePerTree}
          onChangeText={setPricePerTree}
          keyboardType="decimal-pad"
        />

        <View style={{ marginBottom: Spacing.md }}>
          <Text style={globalStyles.label}>Tree Count</Text>
          <View style={styles.counterRow}>
            <TouchableOpacity
              style={styles.counterBtn}
              onPress={() => {
                const current = parseInt(treeCount) || 0;
                if (current > 0) setTreeCount(String(current - (currentSpecies?.bundle_size || 15)));
              }}
            >
              <Text style={styles.counterBtnText}>−</Text>
            </TouchableOpacity>
            <View style={[globalStyles.input, styles.counterInput, { flex: 1, marginHorizontal: Spacing.sm }]}>
              <TextInput
                style={{ color: Colors.textPrimary, fontSize: Typography.bodySize, textAlign: "center", height: "100%" }}
                value={treeCount}
                onChangeText={setTreeCount}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
            <TouchableOpacity
              style={styles.counterBtn}
              onPress={() => {
                const current = parseInt(treeCount) || 0;
                setTreeCount(String(current + (currentSpecies?.bundle_size || 15)));
              }}
            >
              <Text style={styles.counterBtnText}>+</Text>
            </TouchableOpacity>
          </View>
          {currentSpecies && (
            <View style={styles.boxShortcuts}>
              <Text style={styles.boxShortcutsLabel}>Quick add:</Text>
              <View style={styles.boxShortcutBtns}>
                <TouchableOpacity
                  style={styles.boxShortcutBtn}
                  onPress={() => setTreeCount(String(Math.round(currentSpecies.box_total_trees * 0.5)))}
                >
                  <Text style={styles.boxShortcutBtnText}>0.5x</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.boxShortcutBtn}
                  onPress={() => setTreeCount(String(currentSpecies.box_total_trees))}
                >
                  <Text style={styles.boxShortcutBtnText}>1x</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.boxShortcutBtn}
                  onPress={() => setTreeCount(String(Math.round(currentSpecies.box_total_trees * 1.5)))}
                >
                  <Text style={styles.boxShortcutBtnText}>1.5x</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.boxShortcutBtn}
                  onPress={() => setTreeCount(String(currentSpecies.box_total_trees * 2))}
                >
                  <Text style={styles.boxShortcutBtnText}>2x</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        <LabeledInput
          label="Day Notes (optional)"
          value={notes}
          onChangeText={setNotes}
          placeholder="Long walk, wet ground, etc..."
          multiline
          numberOfLines={2}
        />

        <View style={{ marginBottom: Spacing.md }}>
          <Text style={globalStyles.label}>Time Recorded</Text>
          <TouchableOpacity
            style={styles.timeSelector}
            onPress={() => setShowTimePicker(true)}
          >
            <Text style={styles.timeSelectorText}>{selectedTime ? formatTime(selectedTime) : "Select time"}</Text>
            <Text style={styles.timeSelectorArrow}>▼</Text>
          </TouchableOpacity>
        </View>

        {showTimePicker && (
          <DateTimePicker
            value={selectedTime || new Date()}
            mode="time"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={handleTimeChange}
            themeVariant="dark"
            textColor="#ffffff"
          />
        )}

        <Button label="Save Changes" onPress={handleSave} loading={saving} size="lg" />
        
        <TouchableOpacity
          style={styles.deleteLink}
          onPress={handleDelete}
        >
          <Text style={styles.deleteLinkText}>Delete this entry</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Species Selection Modal */}
      <Modal
        visible={speciesModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setSpeciesModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setSpeciesModalVisible(false)}
        >
          <TouchableOpacity
            style={styles.modalContent}
            activeOpacity={1}
            onPress={() => {}}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Species</Text>
              <TouchableOpacity onPress={() => setSpeciesModalVisible(false)}>
                <Text style={styles.modalClose}>Done</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={speciesList}
              keyExtractor={(item) => String(item.id)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.speciesItem}
                  onPress={() => {
                    setCurrentSpecies(item);
                    setSpecies(item.request_key || item.name);
                    setTreesPerBundle(String(item.bundle_size));
                    setTreeCount(String(item.box_total_trees || item.bundle_size * 4));
                    setSpeciesModalVisible(false);
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.speciesItemName}>{item.request_key}</Text>
                    {item.name && item.name !== item.request_key && (
                      <Text style={styles.speciesItemKey}>{item.name}</Text>
                    )}
                    <Text style={styles.speciesItemDetails}>
                      {item.bundle_size}/bundle | {item.box_total_trees || item.bundle_size * 4}/box
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  preview: {
    flexDirection: "row",
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    justifyContent: "space-around",
  },
  previewStat: { alignItems: "center" },
  previewValue: {
    color: Colors.accent,
    fontSize: Typography.titleSize,
    fontWeight: Typography.fontWeight.heavy,
  },
  previewLabel: {
    color: Colors.textMuted,
    fontSize: Typography.captionSize,
    marginTop: 2,
  },
  previewDivider: { width: 1, backgroundColor: Colors.border },
  speciesSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.bgInput,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  speciesSelectorText: {
    color: Colors.textPrimary,
    fontSize: Typography.bodySize,
    flex: 1,
  },
  speciesSelectorPlaceholder: {
    color: Colors.textMuted,
  },
  speciesSelectorArrow: {
    color: Colors.textMuted,
    fontSize: 12,
    marginLeft: Spacing.sm,
  },
  addSpeciesBtn: {
    width: 50,
    height: 50,
    borderRadius: Radius.md,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  addSpeciesBtnText: {
    color: Colors.textLight,
    fontSize: 18,
    fontWeight: Typography.fontWeight.bold,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    maxHeight: "70%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.subtitleSize,
    fontWeight: Typography.fontWeight.bold,
  },
  modalClose: {
    color: Colors.textMuted,
    fontSize: Typography.bodySize,
  },
  speciesItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  speciesItemName: {
    color: Colors.textPrimary,
    fontSize: Typography.bodySize,
    fontWeight: Typography.fontWeight.medium,
    flex: 1,
  },
  speciesItemKey: {
    color: Colors.green,
    fontSize: Typography.captionSize,
    fontWeight: Typography.fontWeight.bold,
  },
  speciesItemDetails: {
    color: Colors.textMuted,
    fontSize: Typography.captionSize,
    marginTop: 2,
  },
  presetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  presetChip: {
    backgroundColor: Colors.bgInput,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  presetChipActive: {
    borderColor: Colors.accentDim,
    backgroundColor: Colors.accentMuted,
  },
  presetChipText: {
    color: Colors.textSecondary,
    fontSize: Typography.captionSize,
    fontWeight: Typography.fontWeight.medium,
  },
  counterRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  counterBtn: {
    backgroundColor: Colors.bgInput,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    width: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  counterBtnText: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: Typography.fontWeight.bold,
  },
  counterInput: {
    height: 44,
  },
  boxShortcuts: {
    marginTop: Spacing.sm,
  },
  boxShortcutsLabel: {
    color: Colors.textMuted,
    fontSize: Typography.captionSize,
    marginBottom: Spacing.xs,
  },
  boxShortcutBtns: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  boxShortcutBtn: {
    flex: 1,
    backgroundColor: Colors.bgInput,
    borderRadius: Radius.sm,
    paddingVertical: Spacing.xs,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  boxShortcutBtnText: {
    color: Colors.textSecondary,
    fontSize: Typography.captionSize,
    fontWeight: Typography.fontWeight.bold,
  },
  timeSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.bgInput,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  timeSelectorText: {
    color: Colors.textPrimary,
    fontSize: Typography.bodySize,
  },
  timeSelectorArrow: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  deleteLink: {
    marginTop: Spacing.md,
    alignItems: "center",
    padding: Spacing.sm,
  },
  deleteLinkText: {
    color: Colors.danger,
    fontSize: Typography.bodySize,
  },
});
