import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/src/theme/ThemeContext";
import { loadAllMatches } from "@/src/storage/matches";
import {
  battingStrikeRate,
  bowlingEconomy,
  computeLifetimeStats,
  PlayerLifetimeStats,
} from "@/src/logic/stats";

type SortKey = "runs" | "wickets" | "matches" | "name";

const SORTS: { id: SortKey; label: string }[] = [
  { id: "runs", label: "Runs" },
  { id: "wickets", label: "Wickets" },
  { id: "matches", label: "Matches" },
  { id: "name", label: "A–Z" },
];

export default function PlayersScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState<PlayerLifetimeStats[]>([]);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("runs");

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const all = await loadAllMatches();
        const computed = computeLifetimeStats(all);
        if (!cancelled) setStats(computed);
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? stats.filter((s) => s.displayName.toLowerCase().includes(q))
      : stats;
    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sort) {
        case "runs":
          return b.batting.runs - a.batting.runs;
        case "wickets":
          return b.bowling.wickets - a.bowling.wickets;
        case "matches":
          return b.matches - a.matches;
        case "name":
          return a.displayName.localeCompare(b.displayName);
        default:
          return 0;
      }
    });
    return sorted;
  }, [stats, query, sort]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          testID="players-back-button"
          onPress={() => router.back()}
          style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          Player Stats
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={{ paddingHorizontal: 20 }}>
        <View
          style={[
            styles.searchRow,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            testID="players-search-input"
            value={query}
            onChangeText={setQuery}
            placeholder="Search player..."
            placeholderTextColor={colors.textMuted}
            style={{ flex: 1, fontSize: 14, color: colors.textPrimary, paddingVertical: 8 }}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingTop: 12, paddingBottom: 6 }}
        >
          {SORTS.map((s) => {
            const active = sort === s.id;
            return (
              <TouchableOpacity
                key={s.id}
                testID={`players-sort-${s.id}`}
                onPress={() => setSort(s.id)}
                style={{
                  height: 36,
                  paddingHorizontal: 14,
                  borderRadius: 999,
                  borderWidth: 1,
                  flexShrink: 0,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: active ? colors.primary : colors.surface,
                  borderColor: active ? colors.primary : colors.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "800",
                    color: active ? colors.onPrimary : colors.textPrimary,
                  }}
                >
                  {s.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: insets.bottom + 24,
          gap: 10,
        }}
      >
        {filtered.length === 0 && (
          <View
            style={[
              styles.empty,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            testID="players-empty"
          >
            <Ionicons name="people-outline" size={32} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              No player stats yet
            </Text>
            <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
              Finish a match and players will appear here automatically.
            </Text>
          </View>
        )}
        {filtered.map((s, idx) => (
          <TouchableOpacity
            key={s.key}
            testID={`player-row-${s.key}`}
            activeOpacity={0.85}
            onPress={() =>
              router.push({ pathname: "/player", params: { key: s.key } })
            }
            style={[
              styles.row,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View
              style={[
                styles.rank,
                { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
              ]}
            >
              <Text style={{ color: colors.textPrimary, fontWeight: "800", fontSize: 13 }}>
                {idx + 1}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
                {s.displayName}
              </Text>
              <Text style={[styles.subname, { color: colors.textSecondary }]} numberOfLines={1}>
                {s.teams.join(" • ") || "—"} · {s.matches} match{s.matches === 1 ? "" : "es"}
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={[styles.metric, { color: colors.primary }]}>
                {s.batting.runs}
                <Text style={[styles.metricUnit, { color: colors.textMuted }]}> runs</Text>
              </Text>
              <Text style={[styles.metricSub, { color: colors.textSecondary }]}>
                {s.bowling.wickets} wkts · SR {battingStrikeRate(s.batting).toFixed(0)} · Eco {bowlingEconomy(s.bowling).toFixed(1)}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
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
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 12,
  },
  rank: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontSize: 15, fontWeight: "800" },
  subname: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  metric: { fontSize: 18, fontWeight: "900", letterSpacing: -0.3 },
  metricUnit: { fontSize: 11, fontWeight: "700" },
  metricSub: { fontSize: 11, fontWeight: "700", marginTop: 2 },
  empty: { borderWidth: 1, borderRadius: 16, padding: 24, alignItems: "center", gap: 4 },
  emptyTitle: { fontSize: 16, fontWeight: "800", marginTop: 4 },
  emptyDesc: { fontSize: 13, textAlign: "center" },
});
