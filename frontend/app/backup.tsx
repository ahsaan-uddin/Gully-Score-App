import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  Platform,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/src/theme/ThemeContext";
import {
  applyBackup,
  BackupPayload,
  exportAndShare,
  ImportMode,
  pickAndReadBackup,
} from "@/src/storage/backup";
import { loadAllMatches } from "@/src/storage/matches";

interface Toast { id: number; tone: "ok" | "err"; text: string }

export default function BackupScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [matchCount, setMatchCount] = useState(0);
  const [busy, setBusy] = useState<"export" | "import" | null>(null);
  const [pendingImport, setPendingImport] = useState<BackupPayload | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const m = await loadAllMatches();
        if (!cancelled) setMatchCount(m.length);
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const flash = (tone: "ok" | "err", text: string) => {
    const id = Date.now();
    setToast({ id, tone, text });
    setTimeout(() => {
      setToast((t) => (t?.id === id ? null : t));
    }, 3200);
  };

  const onExport = async () => {
    setBusy("export");
    try {
      const r = await exportAndShare();
      if (r.ok) {
        flash(
          "ok",
          r.method === "share"
            ? `Shared ${r.matchCount} matches`
            : `Downloaded ${r.matchCount} matches`,
        );
      } else {
        flash("err", r.message ?? "Sharing not available on this device.");
      }
    } catch (e) {
      flash("err", (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const onImportPick = async () => {
    setBusy("import");
    try {
      const payload = await pickAndReadBackup();
      if (payload) setPendingImport(payload);
    } catch (e) {
      flash("err", (e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const onApply = async (mode: ImportMode) => {
    if (!pendingImport) return;
    try {
      const r = await applyBackup(pendingImport, mode);
      setPendingImport(null);
      const m = await loadAllMatches();
      setMatchCount(m.length);
      flash(
        "ok",
        mode === "replace"
          ? `Replaced — ${r.total} match${r.total === 1 ? "" : "es"} loaded`
          : `Merged — ${r.added} added, ${r.updated} updated`,
      );
    } catch (e) {
      flash("err", (e as Error).message);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          testID="backup-back-button"
          onPress={() => router.back()}
          style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          Backup & Share
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingBottom: insets.bottom + 40,
          gap: 16,
        }}
      >
        <View
          style={[
            styles.stat,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>STORED</Text>
          <Text testID="backup-match-count" style={[styles.statValue, { color: colors.textPrimary }]}>
            {matchCount} match{matchCount === 1 ? "" : "es"}
          </Text>
          <Text style={[styles.statDesc, { color: colors.textSecondary }]}>
            All data is stored on this device only. Export to share with friends.
          </Text>
        </View>

        {/* Export */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.cardIcon,
                { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
              ]}
            >
              <Ionicons name="share-social-outline" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                Export Data
              </Text>
              <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
                Save all matches + player stats as a JSON file. Share via WhatsApp, Bluetooth, etc.
              </Text>
            </View>
          </View>
          <TouchableOpacity
            testID="export-button"
            disabled={busy !== null}
            onPress={onExport}
            activeOpacity={0.9}
            style={[
              styles.primaryBtn,
              {
                backgroundColor: colors.primary,
                opacity: busy ? 0.6 : 1,
              },
            ]}
          >
            <Ionicons name={Platform.OS === "web" ? "download-outline" : "share-outline"} size={18} color={colors.onPrimary} />
            <Text style={[styles.primaryBtnText, { color: colors.onPrimary }]}>
              {busy === "export"
                ? "Preparing..."
                : Platform.OS === "web"
                  ? "Download Backup"
                  : "Export & Share"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Import */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.cardIcon,
                { backgroundColor: colors.warningMuted, borderColor: colors.warning },
              ]}
            >
              <Ionicons name="cloud-download-outline" size={20} color={colors.warning} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                Import Data
              </Text>
              <Text style={[styles.cardDesc, { color: colors.textSecondary }]}>
                Pick a GullyScore backup file. You can replace or merge with existing data.
              </Text>
            </View>
          </View>
          <TouchableOpacity
            testID="import-button"
            disabled={busy !== null}
            onPress={onImportPick}
            activeOpacity={0.9}
            style={[
              styles.secondaryBtn,
              {
                backgroundColor: colors.surfaceElevated,
                borderColor: colors.border,
                opacity: busy ? 0.6 : 1,
              },
            ]}
          >
            <Ionicons name="folder-open-outline" size={18} color={colors.textPrimary} />
            <Text style={[styles.secondaryBtnText, { color: colors.textPrimary }]}>
              {busy === "import" ? "Opening..." : "Pick Backup File"}
            </Text>
          </TouchableOpacity>
        </View>

        <View
          style={[
            styles.tip,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Ionicons name="information-circle-outline" size={18} color={colors.textMuted} />
          <Text style={[styles.tipText, { color: colors.textSecondary }]}>
            One person records, then exports the file and shares it. Everyone else taps Import → Merge to keep their own matches too.
          </Text>
        </View>
      </ScrollView>

      {/* Import-mode chooser */}
      <Modal visible={pendingImport !== null} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.bottomSheet,
              { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 },
            ]}
          >
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              Import {pendingImport?.matches.length ?? 0} matches?
            </Text>
            <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>
              Exported {pendingImport ? new Date(pendingImport.exportedAt).toLocaleString() : ""}
            </Text>

            <TouchableOpacity
              testID="import-merge-button"
              onPress={() => onApply("merge")}
              style={[styles.primaryBtn, { backgroundColor: colors.primary, marginTop: 16 }]}
            >
              <Ionicons name="git-merge-outline" size={18} color={colors.onPrimary} />
              <Text style={[styles.primaryBtnText, { color: colors.onPrimary }]}>
                Merge (keep mine)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID="import-replace-button"
              onPress={() => onApply("replace")}
              style={[
                styles.secondaryBtn,
                {
                  backgroundColor: colors.dangerMuted,
                  borderColor: colors.danger,
                  marginTop: 10,
                },
              ]}
            >
              <Ionicons name="swap-horizontal" size={18} color={colors.danger} />
              <Text style={[styles.secondaryBtnText, { color: colors.danger }]}>
                Replace All
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              testID="import-cancel-button"
              onPress={() => setPendingImport(null)}
              style={[
                styles.secondaryBtn,
                {
                  backgroundColor: "transparent",
                  borderColor: colors.border,
                  marginTop: 10,
                },
              ]}
            >
              <Text style={[styles.secondaryBtnText, { color: colors.textSecondary }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {toast && (
        <View
          testID="backup-toast"
          style={[
            styles.toast,
            {
              backgroundColor: toast.tone === "ok" ? colors.primary : colors.danger,
              bottom: insets.bottom + 24,
            },
          ]}
        >
          <Ionicons
            name={toast.tone === "ok" ? "checkmark-circle" : "alert-circle"}
            size={18}
            color="#fff"
          />
          <Text style={styles.toastText}>{toast.text}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: "800" },
  stat: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 4,
  },
  statLabel: { fontSize: 11, fontWeight: "900", letterSpacing: 1.4 },
  statValue: { fontSize: 26, fontWeight: "900", letterSpacing: -0.6 },
  statDesc: { fontSize: 13, fontWeight: "500", marginTop: 4 },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  cardHeader: { flexDirection: "row", gap: 12, marginBottom: 14 },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { fontSize: 16, fontWeight: "800" },
  cardDesc: { fontSize: 13, fontWeight: "600", marginTop: 4 },
  primaryBtn: {
    height: 52,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryBtnText: { fontSize: 15, fontWeight: "800" },
  secondaryBtn: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryBtnText: { fontSize: 15, fontWeight: "800" },
  tip: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    gap: 8,
  },
  tipText: { fontSize: 12, fontWeight: "600", flex: 1, lineHeight: 18 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  bottomSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignSelf: "center",
    marginBottom: 12,
  },
  modalTitle: { fontSize: 20, fontWeight: "900" },
  modalDesc: { fontSize: 13, fontWeight: "600", marginTop: 4 },
  toast: {
    position: "absolute",
    left: 20,
    right: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  toastText: { color: "#fff", fontWeight: "800", fontSize: 13, flex: 1 },
});
