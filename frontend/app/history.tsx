import React, { useCallback, useEffect, useState } from "react";
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
import { Match } from "@/src/types/cricket";
import { formatOvers } from "@/src/logic/cricket";
import { deleteMatch, loadAllMatches } from "@/src/storage/matches";

export default function HistoryScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [matches, setMatches] = useState<Match[]>([]);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    const list = await loadAllMatches();
    setMatches(list.filter((m) => m.status === "completed"));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    load();
  }, [load]);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? matches.filter(
        (m) =>
          m.teams[0].name.toLowerCase().includes(q) ||
          m.teams[1].name.toLowerCase().includes(q) ||
          (m.resultText ?? "").toLowerCase().includes(q),
      )
    : matches;

  const onDelete = async (id: string) => {
    await deleteMatch(id);
    await load();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          testID="history-back-button"
          onPress={() => router.back()}
          style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Match History</Text>
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
            testID="history-search-input"
            value={query}
            onChangeText={setQuery}
            placeholder="Search teams or result..."
            placeholderTextColor={colors.textMuted}
            style={{ flex: 1, fontSize: 14, color: colors.textPrimary, paddingVertical: 8 }}
          />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 12,
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
          >
            <Ionicons name="folder-open-outline" size={32} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No matches found</Text>
            <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
              {q ? "Try a different search." : "Completed matches will appear here."}
            </Text>
          </View>
        )}
        {filtered.map((m) => {
          const i1 = m.innings1;
          const i2 = m.innings2;
          const date = new Date(m.createdAt).toLocaleDateString(undefined, {
            day: "2-digit",
            month: "short",
            year: "numeric",
          });
          return (
            <TouchableOpacity
              key={m.id}
              testID={`history-card-${m.id}`}
              activeOpacity={0.85}
              onPress={() => router.push({ pathname: "/scorecard", params: { id: m.id } })}
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={styles.topRow}>
                <Text style={[styles.date, { color: colors.textMuted }]}>{date}</Text>
                <TouchableOpacity
                  testID={`history-delete-${m.id}`}
                  onPress={() => onDelete(m.id)}
                  hitSlop={12}
                >
                  <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
              <View style={styles.teamRow}>
                <Text style={[styles.team, { color: colors.textPrimary }]} numberOfLines={1}>
                  {m.teams[i1.battingTeamIdx].name}
                </Text>
                <Text style={[styles.scoreInline, { color: colors.textPrimary }]}>
                  {i1.score}/{i1.wickets}{" "}
                  <Text style={[styles.overSub, { color: colors.textMuted }]}>
                    ({formatOvers(i1.legalBalls).text})
                  </Text>
                </Text>
              </View>
              {i2 && (
                <View style={styles.teamRow}>
                  <Text style={[styles.team, { color: colors.textPrimary }]} numberOfLines={1}>
                    {m.teams[i2.battingTeamIdx].name}
                  </Text>
                  <Text style={[styles.scoreInline, { color: colors.textPrimary }]}>
                    {i2.score}/{i2.wickets}{" "}
                    <Text style={[styles.overSub, { color: colors.textMuted }]}>
                      ({formatOvers(i2.legalBalls).text})
                    </Text>
                  </Text>
                </View>
              )}
              {m.resultText && (
                <Text style={[styles.result, { color: colors.primary }]} numberOfLines={2}>
                  {m.resultText}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
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
  card: { borderWidth: 1, borderRadius: 16, padding: 14 },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  date: { fontSize: 12, fontWeight: "700" },
  teamRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  team: { fontSize: 15, fontWeight: "700", flex: 1, paddingRight: 8 },
  scoreInline: { fontSize: 15, fontWeight: "800" },
  overSub: { fontSize: 12, fontWeight: "600" },
  result: { fontSize: 13, fontWeight: "700", marginTop: 6 },
  empty: { borderWidth: 1, borderRadius: 16, padding: 24, alignItems: "center", gap: 4 },
  emptyTitle: { fontSize: 16, fontWeight: "800", marginTop: 4 },
  emptyDesc: { fontSize: 13, textAlign: "center" },
});
