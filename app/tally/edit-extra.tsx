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
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useRouter, useLocalSearchParams } from "expo-router";
import { updateExtra, SeasonExtra, deleteExtra } from "@/lib/database";
import { Button, LabeledInput } from "@/components/ui";
import { Colors, Typography, Spacing, Radius, globalStyles } from "@/lib/theme";

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function parseExtra(json: string): SeasonExtra {
  try {
    return JSON.parse(json);
  } catch {
    throw new Error("Invalid extra data");
  }
}

export default function EditExtraScreen() {
  const params = useLocalSearchParams<{ extraJson: string; tableName: string; date: string }>();
  const tableName = param(params.tableName);
  const date = param(params.date);
  const router = useRouter();

  const [extra, setExtra] = useState<SeasonExtra | null>(null);
  const [parseError, setParseError] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [selectedTime, setSelectedTime] = useState<Date | null>(null);

  useEffect(() => {
    try {
      const parsed = parseExtra(param(params.extraJson));
      setExtra(parsed);
      setName(parsed.name);
      setAmount(String(parsed.amount));
      
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
  }, [params.extraJson]);

  useEffect(() => {
    if (parseError) {
      Alert.alert("Error", "Invalid extra data");
      router.back();
    }
  }, [parseError, router]);

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
    if (!extra) return;
    
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
      const timeToUse = selectedTime || new Date();
      const timeStr = `${date} ${formatTimeForStorage(timeToUse)}`;
      await updateExtra(tableName, extra.id, trimmedName, parsedAmount, timeStr);
      router.back();
    } catch (e: unknown) {
      Alert.alert("Error", e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!extra) return;
    Alert.alert(
      "Delete Extra",
      `Remove ${extra.name} ($${extra.amount.toFixed(2)})?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteExtra(tableName, extra.id);
            router.back();
          },
        },
      ]
    );
  };

  if (parseError || !extra) {
    return (
      <View style={globalStyles.screen}>
        <Text style={{ color: Colors.textMuted }}>Loading...</Text>
      </View>
    );
  }

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
          <Text style={styles.title}>Edit Extra Earnings</Text>
          <Text style={styles.subtitle}>{displayDate}</Text>
        </View>

        <LabeledInput
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Driving, Cleaning"
          autoCapitalize="words"
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
          <Text style={styles.deleteLinkText}>Delete this extra</Text>
        </TouchableOpacity>
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
