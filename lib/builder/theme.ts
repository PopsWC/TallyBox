import { StyleSheet } from "react-native";

export const Colors = {
  // Forest-floor palette
  bg: "#0f1a0f",
  bgCard: "#172117",
  bgInput: "#1e2b1e",
  border: "#2a3d2a",
  borderLight: "#3a5a3a",

  accent: "#6abf5e",       // leafy green
  accentDim: "#3d7a35",
  accentMuted: "#2a5225",

  amber: "#e6a020",        // earnings / money
  amberDim: "#a06e10",

  textPrimary: "#e8f5e0",
  textSecondary: "#8aab80",
  textMuted: "#4a6644",

  danger: "#e05050",
  dangerDim: "#7a2020",

  white: "#ffffff",
};

export const Typography = {
  // Headings — sturdy slab feel
  displaySize: 32,
  titleSize: 22,
  subtitleSize: 17,
  bodySize: 15,
  captionSize: 12,

  fontWeight: {
    regular: "400" as const,
    medium: "500" as const,
    semibold: "600" as const,
    bold: "700" as const,
    heavy: "800" as const,
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Radius = {
  sm: 6,
  md: 12,
  lg: 18,
  full: 999,
};

export const globalStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.bg,
  },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
  },
  input: {
    backgroundColor: Colors.bgInput,
    borderRadius: Radius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.textPrimary,
    fontSize: Typography.bodySize,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  label: {
    color: Colors.textSecondary,
    fontSize: Typography.captionSize,
    fontWeight: Typography.fontWeight.semibold,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: Spacing.xs,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.subtitleSize,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  spaceBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
