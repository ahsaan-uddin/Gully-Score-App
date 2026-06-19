import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/src/theme/ThemeContext";
import {
  computeStandings,
  loadAllSeries,
  makeSeries,
  Series,
  upsertSeries,
} from "@/src/storage/series";
import { loadAllMatches } from "@/src/storage/matches";
import { Match } from "@/src/types/cricket";
import { Palette } from "@/src/theme/tokens";

const BEST_OF_OPTIONS = [3, 5, 7];

export default function SeriesScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [list, setList] = useState<Series[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [createOpen, setCreateOpen] = useState(false);

  const [name, setName] = useState("");
  const [teamA, setTeamA] = useState("");
  const [teamB, setTeamB] = useState("");
  const [bestOf, setBestOf] = useState(3);

  const load = useCallback(async () => {
    const [s, m] = await Promise.all([loadAllSeries(), loadAllMatches()]);
    setList(s);
    setMatches(m);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const canCreate = name.trim() && teamA.trim() && teamB.trim() &&
    teamA.trim().toLowerCase() !== teamB.trim().toLowerCase();

  const onCreate = async () => {
    if (!canCreate) return;
    const s = makeSeries({
      name: name.trim(),
      teamA: teamA.trim(),
      teamB: teamB.trim(),
      bestOf,
    });
    await upsertSeries(s);
    setName(""); setTeamA(""); setTeamB(""); setBestOf(3);
    setCreateOpen(false);
    await load();
    router.push({ pathname: "/series-detail", params: { id: s.id } });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          testID="series-back-button"
          onPress={() => router.back()}
          style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Series</Text>
        <TouchableOpacity
          testID="series-create-open"
          onPress={() => setCreateOpen(true)}
          style={[styles.iconBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
        >
          <Ionicons name="add" size={22} color={colors.onPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 24,
          gap: 10,
        }}
      >
        {list.length === 0 && (
          <View
            testID="series-empty"
            style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Ionicons name="trophy-outline" size={32} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No series yet</Text>
            <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
              Create a best-of-N series and track wins across matches.
            </Text>
            <TouchableOpacity
              testID="series-empty-create"
              onPress={() => setCreateOpen(true)}
              style={[styles.cta, { backgroundColor: colors.primary }]}
            >
              <Ionicons name="add-circle" size={18} color={colors.onPrimary} />
              <Text style={[styles.ctaText, { color: colors.onPrimary }]}>Create Series</Text>
            </TouchableOpacity>
          </View>
        )}
        {list.map((s) => (
          <SeriesRow key={s.id} series={s} matches={matches} colors={colors} onPress={() => router.push({ pathname: "/series-detail", params: { id: s.id } })} />
        ))}
      </ScrollView>

      <Modal visible={createOpen} transparent animationType="slide" onRequestClose={() => setCreateOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.handle} />
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>New Series</Text>

            <Text style={[styles.label, { color: colors.textSecondary, marginTop: 12 }]}>Series name</Text>
            <TextInput
              testID="series-name-input"
              value={name}
              onChangeText={setName}
              placeholder="e.g., Diwali Cup"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
            />

            <Text style={[styles.label, { color: colors.textSecondary, marginTop: 12 }]}>Team A</Text>
            <TextInput
              testID="series-teamA-input"
              value={teamA}
              onChangeText={setTeamA}
              placeholder="e.g., Mohalla XI"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
            />

            <Text style={[styles.label, { color: colors.textSecondary, marginTop: 12 }]}>Team B</Text>
            <TextInput
              testID="series-teamB-input"
              value={teamB}
              onChangeText={setTeamB}
              placeholder="e.g., Galli Tigers"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
            />

            <Text style={[styles.label, { color: colors.textSecondary, marginTop: 12 }]}>Format</Text>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
              {BEST_OF_OPTIONS.map((n) => {
                const active = bestOf === n;
                return (
                  <TouchableOpacity
                    key={n}
                    testID={`series-bestof-${n}`}
                    onPress={() => setBestOf(n)}
                    style={{
                      flex: 1, height: 44, borderRadius: 12, borderWidth: 1,
                      alignItems: "center", justifyContent: "center",
                      backgroundColor: active ? colors.primary : colors.surface,
                      borderColor: active ? colors.primary : colors.border,
                    }}
                  >
                    <Text style={{ color: active ? colors.onPrimary : colors.textPrimary, fontWeight: "800", fontSize: 14 }}>
                      Best of {n}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              testID="series-create-confirm"
              onPress={onCreate}
              disabled={!canCreate}
              style={[styles.cta, { backgroundColor: canCreate ? colors.primary : colors.surfaceElevated, marginTop: 18 }]}
            >
              <Text style={[styles.ctaText, { color: canCreate ? colors.onPrimary : colors.textMuted }]}>
                Create Series
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function SeriesRow({ series, matches, colors, onPress }: { series: Series; matches: Match[]; colors: Palette; onPress: () => void }) {
  const s = computeStandings(series, matches);
  return (
    <TouchableOpacity
      testID={`series-row-${series.id}`}
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={[styles.rowTitle, { color: colors.textPrimary }]} numberOfLines={1}>{series.name}</Text>
        <View style={[styles.pill, { backgroundColor: series.status === "completed" ? colors.primaryMuted : colors.warningMuted, borderColor: series.status === "completed" ? colors.primary : colors.warning }]}>
          <Text style={{ color: series.status === "completed" ? colors.primary : colors.warning, fontSize: 10, fontWeight: "900", letterSpacing: 0.5 }}>
            {series.status === "completed" ? "DONE" : "LIVE"}
          </Text>
        </View>
      </View>
      <Text style={[styles.rowSub, { color: colors.textSecondary }]}>
        Best of {series.bestOf} • {series.teamA} vs {series.teamB}
      </Text>
      <View style={styles.scoreRow}>
        <Score colors={colors} team={series.teamA} wins={s.winsA} highlight={s.clinchedBy === series.teamA} />
        <Text style={{ color: colors.textMuted, fontWeight: "800", fontSize: 13 }}>—</Text>
        <Score colors={colors} team={series.teamB} wins={s.winsB} highlight={s.clinchedBy === series.teamB} />
      </View>
      {series.winnerName && (
        <Text style={[styles.winnerText, { color: colors.primary }]}>
          🏆 {series.winnerName} won the series
        </Text>
      )}
    </TouchableOpacity>
  );
}

function Score({ team, wins, colors, highlight }: { team: string; wins: number; colors: Palette; highlight: boolean }) {
  return (
    <View style={{ alignItems: "center", flex: 1 }}>
      <Text style={{ color: highlight ? colors.primary : colors.textPrimary, fontSize: 22, fontWeight: "900" }}>{wins}</Text>
      <Text style={{ color: colors.textSecondary, fontSize: 11, fontWeight: "700", marginTop: 2 }} numberOfLines={1}>{team}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 12 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: "800" },
  empty: { borderWidth: 1, borderRadius: 16, padding: 24, alignItems: "center", gap: 6 },
  emptyTitle: { fontSize: 16, fontWeight: "800", marginTop: 4 },
  emptyDesc: { fontSize: 13, textAlign: "center" },
  cta: { height: 50, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, paddingHorizontal: 16, marginTop: 10 },
  ctaText: { fontSize: 15, fontWeight: "800" },
  row: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 6 },
  rowTitle: { fontSize: 16, fontWeight: "800", flex: 1, paddingRight: 8 },
  rowSub: { fontSize: 12, fontWeight: "600" },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  scoreRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6 },
  winnerText: { fontSize: 13, fontWeight: "800", marginTop: 4 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingHorizontal: 20, paddingBottom: 24 },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.15)", alignSelf: "center", marginBottom: 12 },
  modalTitle: { fontSize: 22, fontWeight: "900" },
  label: { fontSize: 13, fontWeight: "700" },
  input: { height: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, fontSize: 15, fontWeight: "600", marginTop: 6 },
});
