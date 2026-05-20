import React from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  TextInputProps,
} from "react-native";
import { Colors, Typography, Spacing, Radius, globalStyles } from "@/lib/theme";
import { IconSymbol } from "./ui/icon-symbol";

// ─── Button ───────────────────────────────────────────────────────────────────

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  icon?: string;
}

const ICON_SYMBOLS = [
  'house.fill', 'paperplane.fill', 'chevron.left.forwardslash.chevron.right',
  'chevron.right', 'gearshape.fill', 'leaf.fill', 'plus', 'arrow.right',
  'list.bullet', 'flag.fill', 'calendar', 'pencil', 'location.fill',
  'checkmark', 'note.text', 'chevron.left', 'star.fill', 'person.fill',
  'dollarsign.circle', 'trash'
];

export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  disabled,
  loading,
  style,
  icon,
}: ButtonProps) {
  const variantStyle = {
    primary: { bg: Colors.accent, text: Colors.bg },
    secondary: { bg: Colors.bgInput, text: Colors.textPrimary },
    danger: { bg: Colors.dangerDim, text: Colors.danger },
    ghost: { bg: "transparent", text: Colors.accent },
  }[variant];

  const sizeStyle = {
    sm: { py: 6, px: 12, fontSize: Typography.captionSize, iconSize: 14 },
    md: { py: 12, px: 20, fontSize: Typography.bodySize, iconSize: 18 },
    lg: { py: 16, px: 28, fontSize: Typography.subtitleSize, iconSize: 22 },
  }[size];

  const isIconSymbol = icon && ICON_SYMBOLS.includes(icon);

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
      style={[
        {
          backgroundColor: variantStyle.bg,
          borderRadius: Radius.sm,
          paddingVertical: sizeStyle.py,
          paddingHorizontal: sizeStyle.px,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          opacity: disabled ? 0.4 : 1,
          borderWidth: variant === "ghost" ? 1 : 0,
          borderColor: variant === "ghost" ? Colors.accentDim : undefined,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variantStyle.text} size="small" />
      ) : (
        <>
          {icon && isIconSymbol && (
            <IconSymbol 
              name={icon as any} 
              size={sizeStyle.iconSize} 
              color={variantStyle.text} 
              style={{ marginRight: 6 }} 
            />
          )}
          {icon && !isIconSymbol && (
            <Text style={{ color: variantStyle.text, fontSize: sizeStyle.fontSize, marginRight: 6 }}>
              {icon}
            </Text>
          )}
          <Text
            style={{
              color: variantStyle.text,
              fontSize: sizeStyle.fontSize,
              fontWeight: Typography.fontWeight.bold,
              letterSpacing: 0.3,
            }}
          >
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

// ─── LabeledInput ─────────────────────────────────────────────────────────────

interface LabeledInputProps extends Omit<TextInputProps, "style"> {
  label: string;
  style?: ViewStyle;
  inputStyle?: TextStyle;
}

export function LabeledInput({ label, style, inputStyle, ...props }: LabeledInputProps) {
  return (
    <View style={[{ marginBottom: Spacing.md }, style]}>
      <Text style={globalStyles.label}>{label}</Text>
      <TextInput
        {...props}
        style={[
          globalStyles.input,
          props.multiline && { minHeight: 72, textAlignVertical: "top", paddingTop: Spacing.sm },
          inputStyle,
        ]}
        placeholderTextColor={Colors.textMuted}
      />
    </View>
  );
}

// ─── StatBadge ────────────────────────────────────────────────────────────────

interface StatBadgeProps {
  label: string;
  value: string;
  color?: string;
  style?: ViewStyle;
}

export function StatBadge({ label, value, color = Colors.accent, style }: StatBadgeProps) {
  return (
    <View
      style={[
        {
          backgroundColor: Colors.bgCard,
          borderRadius: Radius.md,
          borderWidth: 1,
          borderColor: Colors.border,
          padding: Spacing.md,
          alignItems: "center",
          flex: 1,
        },
        style,
      ]}
    >
      <Text style={{ color, fontSize: Typography.titleSize, fontWeight: Typography.fontWeight.heavy }}>
        {value}
      </Text>
      <Text style={{ color: Colors.textSecondary, fontSize: Typography.captionSize, marginTop: 2 }}>
        {label}
      </Text>
    </View>
  );
}

// ─── Divider ──────────────────────────────────────────────────────────────────

export function Divider({ style }: { style?: ViewStyle }) {
  return (
    <View style={[{ height: 1, backgroundColor: Colors.border, marginVertical: Spacing.sm }, style]} />
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

const EMPTY_STATE_ICONS = [
  'house.fill', 'paperplane.fill', 'chevron.left.forwardslash.chevron.right',
  'chevron.right', 'gearshape.fill', 'leaf.fill', 'plus', 'arrow.right',
  'list.bullet', 'flag.fill', 'calendar', 'pencil', 'location.fill',
  'checkmark', 'note.text', 'chevron.left', 'star.fill', 'person.fill',
  'dollarsign.circle', 'trash'
];

export function EmptyState({ icon, title, body }: { icon: string; title: string; body?: string }) {
  const isIconSymbol = icon && EMPTY_STATE_ICONS.includes(icon);
  
  return (
    <View style={{ alignItems: "center", paddingVertical: Spacing.xxl, paddingHorizontal: Spacing.xl }}>
      {isIconSymbol ? (
        <IconSymbol name={icon as any} size={48} color={Colors.textMuted} style={{ marginBottom: Spacing.md }} />
      ) : (
        <Text style={{ fontSize: 48, marginBottom: Spacing.md }}>{icon}</Text>
      )}
      <Text
        style={{
          color: Colors.textPrimary,
          fontSize: Typography.subtitleSize,
          fontWeight: Typography.fontWeight.bold,
          textAlign: "center",
          marginBottom: Spacing.xs,
        }}
      >
        {title}
      </Text>
      {body && (
        <Text style={{ color: Colors.textMuted, fontSize: Typography.bodySize, textAlign: "center" }}>
          {body}
        </Text>
      )}
    </View>
  );
}

// ─── SectionHeader ────────────────────────────────────────────────────────────

export function SectionHeader({ title, left, right }: { title: string; left?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderBottomWidth: 1,
        borderBottomColor: Colors.border,
        backgroundColor: Colors.bgCard,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
        {left}
        <Text
          style={{
            color: Colors.textSecondary,
            fontSize: Typography.captionSize,
            fontWeight: Typography.fontWeight.bold,
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          {title}
        </Text>
      </View>
      {right}
    </View>
  );
}
