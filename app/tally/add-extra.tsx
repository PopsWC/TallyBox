import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter, useLocalSearchParams } from "expo-router";
import { addExtra } from "@/lib/database";
import { Button, LabeledInput } from "@/components/ui";
import { Colors, Typography, Spacing, Radius, globalStyles } from "@/lib/theme";

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default function AddExtraScreen() {
  const params = useLocalSearchParams<{ date: string; seasonId: string; tableName: string }>();
  const date = param(params.date);
  const tableName = param(params.tableName);
  const router = useRouter();

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedTime, setSelectedTime] = useState(new Date());

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
    const trimmedName = name.trim();
    const parsedAmount = parseFloat(amount);

    if (!trimmedName) {
      Alert.alert("Missing Info", "Please enter a name for this entry.");
      return;
    }
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      Alert.alert("Invalid Amount", "Please enter a valid amount.");
      return;
    }

    setSaving(true);
    try {
      const timeStr = formatTimeForStorage(selectedTime);
      await addExtra(tableName, date, trimmedName, parsedAmount, timeStr);
      router.back();
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const displayDate = new Date(date + "T12:00:00").toLocaleDateString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <KeyboardAvoidingView
      style={globalStyles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={{ padding: Spacing.md, paddingBottom: 100 }}>
        <View style={styles.header}>
          <Text style={styles.title}>Add Extra Earnings</Text>
          <Text style={styles.subtitle}>{displayDate}</Text>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Add extra earnings like driving, cleaning, or other work not related to tree planting.
          </Text>
        </View>

        <LabeledInput
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Driving, Cleaning"
          autoCapitalize="words"
          autoFocus
        />

        <LabeledInput
          label="Amount ($)"
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          keyboardType="decimal-pad"
        />

        <View style={{ marginBottom: Spacing.md }}>
          <Text style={globalStyles.label}>Time Recorded</Text>
          <TouchableOpacity
            style={styles.timeSelector}
            onPress={() => setShowTimePicker(true)}
          >
            <Text style={styles.timeSelectorText}>{formatTime(selectedTime)}</Text>
            <Text style={styles.timeSelectorArrow}>▼</Text>
          </TouchableOpacity>
        </View>

        {showTimePicker && (
          <DateTimePicker
            value={selectedTime}
            mode="time"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={handleTimeChange}
            themeVariant="dark"
            textColor="#ffffff"
          />
        )}

        <Button
          label="Add Extra"
          onPress={handleSave}
          loading={saving}
          size="lg"
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: Spacing.lg,
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
  infoBox: {
    backgroundColor: Colors.bgCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  infoText: {
    color: Colors.textSecondary,
    fontSize: Typography.bodySize,
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
});
