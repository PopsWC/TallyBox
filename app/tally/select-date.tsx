import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Button, LabeledInput } from "@/components/ui";
import { Colors, Typography, Spacing, globalStyles } from "@/lib/theme";

const getLocalDateString = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default function SelectDateScreen() {
  const params = useLocalSearchParams<{ seasonId: string; tableName: string }>();
  const seasonId = param(params.seasonId);
  const tableName = param(params.tableName);
  const router = useRouter();

  const today = getLocalDateString();
  const [selectedDate, setSelectedDate] = useState(today);

  const isValidDate = (dateStr: string): boolean => {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateStr)) return false;
    const date = new Date(dateStr + "T12:00:00");
    return !isNaN(date.getTime());
  };

  const displayDate = (dateStr: string) => {
    if (!isValidDate(dateStr)) return "Invalid date";
    const d = new Date(dateStr + "T12:00:00");
    const todayStr = getLocalDateString();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = getLocalDateString(yesterday);
    
    if (dateStr === todayStr) return "Today";
    if (dateStr === yesterdayStr) return "Yesterday";
    
    return d.toLocaleDateString("en-CA", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const handleContinue = () => {
    if (!isValidDate(selectedDate)) {
      return;
    }
    router.push({
      pathname: "/tally/new-entry",
      params: { date: selectedDate, seasonId, tableName },
    });
  };

  const handleSetToday = () => {
    setSelectedDate(getLocalDateString());
  };

  const handleSetYesterday = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    setSelectedDate(getLocalDateString(yesterday));
  };

  return (
    <View style={globalStyles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Select Date</Text>
        <Text style={styles.subtitle}>Enter the date for this tally entry</Text>
      </View>

      <View style={styles.content}>
        <LabeledInput
          label="Date (YYYY-MM-DD)"
          value={selectedDate}
          onChangeText={setSelectedDate}
          placeholder="2024-01-15"
          keyboardType="numbers-and-punctuation"
          autoCapitalize="none"
        />

        {isValidDate(selectedDate) && (
          <View style={styles.preview}>
            <Text style={styles.previewLabel}>Selected:</Text>
            <Text style={styles.previewDate}>{displayDate(selectedDate)}</Text>
          </View>
        )}

        <View style={styles.quickDates}>
          <Button
            label="Today"
            variant="secondary"
            size="sm"
            onPress={handleSetToday}
            style={{ flex: 1 }}
          />
          <Button
            label="Yesterday"
            variant="secondary"
            size="sm"
            onPress={handleSetYesterday}
            style={{ flex: 1 }}
          />
        </View>
      </View>

      <View style={styles.footer}>
        <Button 
          label="Continue" 
          onPress={handleContinue} 
          size="lg" 
          disabled={!isValidDate(selectedDate)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: Typography.titleSize,
    fontWeight: Typography.fontWeight.bold,
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: Typography.captionSize,
    marginTop: 4,
  },
  content: {
    padding: Spacing.md,
    flex: 1,
  },
  preview: {
    marginTop: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
  },
  previewLabel: {
    color: Colors.textMuted,
    fontSize: Typography.captionSize,
  },
  previewDate: {
    color: Colors.green,
    fontSize: Typography.subtitleSize,
    fontWeight: Typography.fontWeight.bold,
    marginTop: 4,
  },
  quickDates: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  footer: {
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
});
