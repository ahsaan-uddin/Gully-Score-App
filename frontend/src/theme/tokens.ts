// Color tokens for GullyScore — Dark default + Light toggle.

export type ThemeMode = "dark" | "light";

export interface Palette {
  background: string;
  surface: string;
  surfaceElevated: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  primaryMuted: string;
  onPrimary: string;
  danger: string;
  dangerMuted: string;
  warning: string;
  warningMuted: string;
  accentBlue: string;
}

export const palettes: Record<ThemeMode, Palette> = {
  dark: {
    background: "#0A0A0A",
    surface: "#171717",
    surfaceElevated: "#262626",
    border: "#2A2A2A",
    textPrimary: "#FFFFFF",
    textSecondary: "#A3A3A3",
    textMuted: "#737373",
    primary: "#00E676",
    primaryMuted: "rgba(0, 230, 118, 0.15)",
    onPrimary: "#0A0A0A",
    danger: "#FF3B30",
    dangerMuted: "rgba(255, 59, 48, 0.18)",
    warning: "#F5A623",
    warningMuted: "rgba(245, 166, 35, 0.18)",
    accentBlue: "#007AFF",
  },
  light: {
    background: "#F4F6F8",
    surface: "#FFFFFF",
    surfaceElevated: "#F0F2F5",
    border: "#E2E5EA",
    textPrimary: "#0F172A",
    textSecondary: "#475569",
    textMuted: "#94A3B8",
    primary: "#059669",
    primaryMuted: "rgba(5, 150, 105, 0.12)",
    onPrimary: "#FFFFFF",
    danger: "#DC2626",
    dangerMuted: "rgba(220, 38, 38, 0.12)",
    warning: "#D97706",
    warningMuted: "rgba(217, 119, 6, 0.12)",
    accentBlue: "#2563EB",
  },
};
