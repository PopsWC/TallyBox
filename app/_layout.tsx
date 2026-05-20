import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActiveSeasonProvider } from "@/contexts/active-season";
import { Colors } from "@/lib/theme";

export default function RootLayout() {
  return (
    <ActiveSeasonProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: Colors.bgCard },
          headerTintColor: Colors.textPrimary,
          headerTitleStyle: { fontWeight: "700", color: Colors.textPrimary },
          contentStyle: { backgroundColor: Colors.bg },
          headerShadowVisible: false,
          headerBackTitle: "Home",
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ title: "Settings" }} />
        <Stack.Screen name="species" options={{ title: "Species Catalog" }} />
        <Stack.Screen name="season/new" options={{ title: "New Season", presentation: "modal" }} />
        <Stack.Screen name="season/edit-goals" options={{ title: "Edit Goals", presentation: "modal" }} />
        <Stack.Screen name="season/insights" options={{ title: "Season Insights" }} />
        <Stack.Screen name="season/[id]" options={{ title: "Season" }} />
        <Stack.Screen name="tally/[date]" options={{ title: "Tally" }} />
        <Stack.Screen name="tally/new-entry" options={{ title: "Add Entry", presentation: "modal" }} />
        <Stack.Screen name="tally/edit-entry" options={{ title: "Edit Entry", presentation: "modal" }} />
        <Stack.Screen name="tally/add-extra" options={{ title: "Add Extra", presentation: "modal" }} />
        <Stack.Screen name="tally/edit-extra" options={{ title: "Edit Extra", presentation: "modal" }} />
        <Stack.Screen name="summary/[date]" options={{ title: "Day Summary" }} />
        <Stack.Screen name="backup" options={{ title: "Export & Backup" }} />
      </Stack>
    </ActiveSeasonProvider>
  );
}
