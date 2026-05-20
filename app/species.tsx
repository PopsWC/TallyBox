import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Modal,
  ScrollView,
} from "react-native";
import { useFocusEffect } from "expo-router";
import {
  getSpeciesCatalog,
  addSpeciesToCatalog,
  updateSpeciesInCatalog,
  deleteSpeciesFromCatalog,
  Species,
} from "@/lib/database";
import { Button, LabeledInput } from "@/components/ui";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors, Typography, Spacing, Radius, globalStyles } from "@/lib/theme";

export default function SpeciesCatalogScreen() {
  const [species, setSpecies] = useState<Species[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingSpecies, setEditingSpecies] = useState<Species | null>(null);
  const [newSpecies, setNewSpecies] = useState({
    name: "",
    requestKey: "",
    bundleSize: "15",
    boxTotalTrees: "360",
  });
  const [saving, setSaving] = useState(false);

  const loadSpecies = useCallback(async () => {
    try {
      const data = await getSpeciesCatalog();
      setSpecies(data);
    } catch {
      Alert.alert("Error", "Failed to load species");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSpecies();
    }, [loadSpecies])
  );

  const openAddModal = () => {
    setEditingSpecies(null);
    setNewSpecies({ name: "", requestKey: "", bundleSize: "15", boxTotalTrees: "360" });
    setModalVisible(true);
  };

  const openEditModal = (item: Species) => {
    setEditingSpecies(item);
    setNewSpecies({
      name: item.name,
      requestKey: item.request_key || "",
      bundleSize: String(item.bundle_size),
      boxTotalTrees: String(item.box_total_trees),
    });
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingSpecies(null);
  };

  const handleSave = async () => {
    const requestKey = newSpecies.requestKey.trim().toUpperCase();
    if (!requestKey) {
      Alert.alert("Missing Info", "Please enter a request key.");
      return;
    }

    const bundleSize = parseInt(newSpecies.bundleSize, 10);
    const boxTotalTrees = parseInt(newSpecies.boxTotalTrees, 10);

    if (isNaN(bundleSize) || bundleSize <= 0) {
      Alert.alert("Invalid Value", "Please enter a valid bundle size.");
      return;
    }
    if (isNaN(boxTotalTrees) || boxTotalTrees <= 0) {
      Alert.alert("Invalid Value", "Please enter a valid box total trees.");
      return;
    }

    if (boxTotalTrees % bundleSize !== 0) {
      Alert.alert(
        "Invalid Value",
        `Box total (${boxTotalTrees}) must be divisible by bundle size (${bundleSize}).`
      );
      return;
    }

    setSaving(true);
    try {
      const speciesName = newSpecies.name.trim() || requestKey;
      if (editingSpecies) {
        await updateSpeciesInCatalog(
          editingSpecies.id,
          speciesName,
          requestKey,
          bundleSize,
          boxTotalTrees
        );
      } else {
        await addSpeciesToCatalog(
          speciesName,
          requestKey,
          bundleSize,
          boxTotalTrees
        );
      }
      closeModal();
      await loadSpecies();
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to save species");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSpecies = (item: Species) => {
    Alert.alert(
      "Delete Species",
      `Remove "${item.name}" from the catalog?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteSpeciesFromCatalog(item.id);
            await loadSpecies();
          },
        },
      ]
    );
  };

  const renderItem = ({ item }: { item: Species }) => (
    <TouchableOpacity
      style={styles.speciesRow}
      onPress={() => openEditModal(item)}
      onLongPress={() => handleDeleteSpecies(item)}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.speciesName}>{item.request_key}</Text>
        {item.name && item.name !== item.request_key && (
          <Text style={styles.detailText}>{item.name}</Text>
        )}
        <View style={styles.speciesDetails}>
          <Text style={styles.detailText}>{item.bundle_size}/bundle</Text>
          <Text style={styles.detailText}>{item.box_total_trees}/box</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={globalStyles.screen}>
      <View style={styles.addSection}>
        <Button label="Add Species" onPress={openAddModal} size="lg" />
      </View>

      <FlatList
        data={species}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ paddingBottom: 100 }}
        ListHeaderComponent={
          <Text style={styles.listHeader}>
            {species.length} species in catalog
          </Text>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <IconSymbol name="tree.fill" size={48} color={Colors.textMuted} style={{ marginBottom: Spacing.md }} />
            <Text style={styles.emptyTitle}>No species yet</Text>
            <Text style={styles.emptyBody}>
              Add tree species to your catalog for quick selection.
            </Text>
          </View>
        }
        renderItem={renderItem}
      />

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={[globalStyles.screen, { padding: Spacing.md }]}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeModal}>
              <Text style={styles.modalCancel}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingSpecies ? "Edit Species" : "Add Species"}
            </Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              <Text style={[styles.modalSave, saving && styles.modalSaveDisabled]}>
                {saving ? "Saving..." : "Save"}
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
            <LabeledInput
              label="Request Key (required)"
              value={newSpecies.requestKey}
              onChangeText={(text) => setNewSpecies({ ...newSpecies, requestKey: text.toUpperCase() })}
              placeholder="e.g. BLS"
              autoCapitalize="characters"
              maxLength={5}
            />

            <LabeledInput
              label="Species Name (optional - for display)"
              value={newSpecies.name}
              onChangeText={(text) => setNewSpecies({ ...newSpecies, name: text })}
              placeholder="e.g. Black Spruce"
              autoCapitalize="words"
            />

            <View style={styles.row}>
              <View style={{ flex: 1, marginRight: Spacing.sm }}>
                <LabeledInput
                  label="Trees per Bundle"
                  value={newSpecies.bundleSize}
                  onChangeText={(text) => setNewSpecies({ ...newSpecies, bundleSize: text })}
                  placeholder="15"
                  keyboardType="number-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <LabeledInput
                  label="Total Trees per Box"
                  value={newSpecies.boxTotalTrees}
                  onChangeText={(text) => setNewSpecies({ ...newSpecies, boxTotalTrees: text })}
                  placeholder="360"
                  keyboardType="number-pad"
                />
              </View>
            </View>

            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>Info</Text>
              <Text style={styles.infoBody}>
                • Bundle Size: Trees per bundle/bag{"\n"}
                • Box Total: Total trees in a full box{"\n"}
                • Example: 15 trees/bundle × 24 bundles = 360 trees/box{"\n"}
                • Box total must be divisible by bundle size
              </Text>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  addSection: {
    padding: Spacing.md,
  },
  listHeader: {
    color: Colors.textMuted,
    fontSize: Typography.captionSize,
    padding: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  speciesRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  speciesName: {
    color: Colors.textPrimary,
    fontSize: Typography.bodySize,
    fontWeight: Typography.fontWeight.medium,
    flex: 1,
  },
  speciesDetails: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  detailText: {
    color: Colors.textMuted,
    fontSize: Typography.captionSize,
  },
  editArrow: {
    color: Colors.textMuted,
    fontSize: 20,
    marginLeft: Spacing.sm,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.xl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.subtitleSize,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.xs,
  },
  emptyBody: {
    color: Colors.textMuted,
    fontSize: Typography.bodySize,
    textAlign: "center",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    marginBottom: Spacing.md,
  },
  modalTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.subtitleSize,
    fontWeight: Typography.fontWeight.bold,
  },
  modalCancel: {
    color: Colors.textMuted,
    fontSize: Typography.bodySize,
  },
  modalSave: {
    color: Colors.accent,
    fontSize: Typography.bodySize,
    fontWeight: Typography.fontWeight.bold,
  },
  modalSaveDisabled: {
    opacity: 0.5,
  },
  row: {
    flexDirection: "row",
    gap: Spacing.sm,
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
