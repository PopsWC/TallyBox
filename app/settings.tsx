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
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { getUserSettings, updateUserSettings, UserSettings } from "@/lib/database";
import { Button, LabeledInput, Divider } from "@/components/ui";
import { Colors, Typography, Spacing, globalStyles } from "@/lib/theme";

export default function SettingsScreen() {
  const router = useRouter();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [defaultPricePerTree, setDefaultPricePerTree] = useState("");

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const s = await getUserSettings();
      setSettings(s);
      setName(s.name);
      setDefaultPricePerTree(String(s.default_price_per_tree));
    } catch {
      Alert.alert("Error", "Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const price = parseFloat(defaultPricePerTree);

    if (defaultPricePerTree && (isNaN(price) || price < 0)) {
      return Alert.alert("Invalid Price", "Please enter a valid price per tree.");
    }

    setSaving(true);
    try {
      await updateUserSettings(name.trim(), price, 50);
      Alert.alert("Saved", "Your settings have been saved.");
      router.back();
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings) {
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
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Profile</Text>
          <Text style={styles.sectionSub}>
            This name will be used as the default planter name for new entries.
          </Text>
          <LabeledInput
            label="Your Name"
            value={name}
            onChangeText={setName}
            placeholder="Enter your name"
            autoCapitalize="words"
            returnKeyType="next"
          />
        </View>

        <Divider style={{ marginVertical: Spacing.md }} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Default Values</Text>
          <Text style={styles.sectionSub}>
            These values will be pre-filled when adding new entries.
          </Text>

          <LabeledInput
            label="Default Price per Tree ($)"
            value={defaultPricePerTree}
            onChangeText={setDefaultPricePerTree}
            placeholder="0.20"
            keyboardType="decimal-pad"
            returnKeyType="next"
          />
        </View>

        <Divider style={{ marginVertical: Spacing.md }} />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About TallyBox</Text>
          <Text style={styles.aboutText}>
            Track every tree. Every day.
          </Text>
          <Text style={styles.versionText}>Version {Constants.expoConfig?.version}</Text>
        </View>

        <Button
          label="Save Settings"
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
    lineHeight: 18,
  },
  presetRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  aboutText: {
    color: Colors.textSecondary,
    fontSize: Typography.bodySize,
  },
  versionText: {
    color: Colors.textMuted,
    fontSize: Typography.captionSize,
    marginTop: Spacing.xs,
  },
});
