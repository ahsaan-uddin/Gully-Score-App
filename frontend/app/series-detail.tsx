import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/src/theme/ThemeContext";
import { Match } from "@/src/types/cricket";
import {
  computeStandings,
  deleteSeries,
  getSeries,
  Series,
} from "@/src/storage/series";
import { loadAllMatches } from "@/src/storage/matches";
import { formatOvers } from "@/src/logic/cricket";

export default function SeriesDetailScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string }>();
  const [series, setSeries] = useState<Series | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);

  const load = useCallback(async () => {
    if (!params.id) {
      router.replace("/series");
      return;
    }
    const [s, m] = await Promise.all([getSeries(params.id), loadAllMatches()]);
    if (!s) {
      router.replace("/series");
      return;
    }
    setSeries(s);
    setMatches(m);
  }, [params.id, router]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!series) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  const standings = computeStandings(series, matches);
  const seriesMatches = series.matchIds
    .map((id) => matches.find((m) => m.id === id))
    .filter((m): m is Match => !!m);

  const onStartNext = () => {
    router.push({ pathname: "/setup", params: { seriesId: series.id } });
  };

  const onDelete = async () => {
    await deleteSeries(series.id);
    router.replace("/series");
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          testID="series-detail-back"
          onPress={() => router.back()}
          style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          {series.name}
        </Text>
        <TouchableOpacity
          testID="series-delete"
          onPress={onDelete}
          style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Ionicons name="trash-outline" size={18} color={colors.danger} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 100,
          gap: 14,
        }}
      >
        {/* Hero */}
        <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.heroLabel, { color: colors.textMuted }]}>BEST OF {series.bestOf}</Text>
          <View style={styles.scoreRow}>
            <View style={{ flex: 1, alignItems: "center" }}>
              <Text testID="series-team-a" style={[styles.teamName, { color: colors.textPrimary }]} numberOfLines={1}>
                {series.teamA}
              </Text>
              <Text style={[styles.teamWins, { color: standings.clinchedBy === series.teamA ? colors.primary : colors.textPrimary }]}>
                {standings.winsA}
              </Text>
            </View>
            <Text style={{ color: colors.textMuted, fontSize: 20, fontWeight: "900" }}>—</Text>
            <View style={{ flex: 1, alignItems: "center" }}>
              <Text testID="series-team-b" style={[styles.teamName, { color: colors.textPrimary }]} numberOfLines={1}>
                {series.teamB}
              </Text>
              <Text style={[styles.teamWins, { color: standings.clinchedBy === series.teamB ? colors.primary : colors.textPrimary }]}>
                {standings.winsB}
              </Text>
            </View>
          </View>
          <Text style={[styles.heroSub, { color: colors.textSecondary }]}>
            {standings.played} played • need {standings.needed} to win
          </Text>
          {series.winnerName && (
            <View style={[styles.winnerBox, { backgroundColor: colors.primaryMuted, borderColor: colors.primary }]}>
              <Ionicons name="trophy" size={18} color={colors.primary} />
              <Text style={[styles.winnerText, { color: colors.primary }]}>
                {series.winnerName} won the series
              </Text>
            </View>
          )}
        </View>

        {/* Start next match */}
        {series.status !== "completed" && (
          <TouchableOpacity
            testID="series-start-match-button"
            onPress={onStartNext}
            activeOpacity={0.9}
            style={[styles.cta, { backgroundColor: colors.primary }]}
          >
            <Ionicons name="play-circle" size={20} color={colors.onPrimary} />
            <Text style={[styles.ctaText, { color: colors.onPrimary }]}>
              Start Match {standings.played + 1}
            </Text>
          </TouchableOpacity>
        )}

        {/* Matches list */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Matches</Text>
        {seriesMatches.length === 0 && (
          <Text style={[styles.empty, { color: colors.textMuted }]}>
            No matches played yet.
          </Text>
        )}
        {seriesMatches.map((m, idx) => {
          const date = new Date(m.createdAt).toLocaleDateString(undefined, { day: "2-digit", month: "short" });
          const i1 = m.innings1;
          const i2 = m.innings2;
          return (
            <TouchableOpacity
              key={m.id}
              testID={`series-match-${m.id}`}
              onPress={() => router.push({ pathname: "/scorecard", params: { id: m.id } })}
              activeOpacity={0.85}
              style={[styles.matchRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={[styles.matchTitle, { color: colors.textPrimary }]}>Match {idx + 1}</Text>
                <Text style={[styles.matchDate, { color: colors.textMuted }]}>{date}</Text>
              </View>
              <View style={styles.lineRow}>
                <Text style={[styles.teamLine, { color: colors.textPrimary }]} numberOfLines={1}>
                  {m.teams[i1.battingTeamIdx].name}
                </Text>
                <Text style={[styles.teamScore, { color: colors.textPrimary }]}>
                  {i1.score}/{i1.wickets} ({formatOvers(i1.legalBalls).text})
                </Text>
              </View>
              {i2 && (
                <View style={styles.lineRow}>
                  <Text style={[styles.teamLine, { color: colors.textPrimary }]} numberOfLines={1}>
                    {m.teams[i2.battingTeamIdx].name}
                  </Text>
                  <Text style={[styles.teamScore, { color: colors.textPrimary }]}>
                    {i2.score}/{i2.wickets} ({formatOvers(i2.legalBalls).text})
                  </Text>
                </View>
              )}
              {m.resultText && (
                <Text style={[styles.matchResult, { color: colors.primary }]} numberOfLines={2}>{m.resultText}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 12, gap: 8 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: "800", flex: 1, textAlign: "center" },
  hero: { borderWidth: 1, borderRadius: 20, padding: 18, gap: 6 },
  heroLabel: { fontSize: 11, fontWeight: "900", letterSpacing: 1.4, textAlign: "center" },
  scoreRow: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  teamName: { fontSize: 14, fontWeight: "800" },
  teamWins: { fontSize: 36, fontWeight: "900", letterSpacing: -1, marginTop: 4 },
  heroSub: { fontSize: 12, fontWeight: "600", textAlign: "center", marginTop: 8 },
  winnerBox: { marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 12 },
  winnerText: { fontSize: 14, fontWeight: "800" },
  cta: { height: 54, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  ctaText: { fontSize: 15, fontWeight: "800" },
  sectionTitle: { fontSize: 16, fontWeight: "800", marginTop: 6 },
  empty: { fontSize: 13, fontWeight: "600", textAlign: "center", paddingVertical: 16 },
  matchRow: { borderRadius: 14, borderWidth: 1, padding: 12, gap: 4 },
  matchTitle: { fontSize: 14, fontWeight: "800" },
  matchDate: { fontSize: 11, fontWeight: "700" },
  lineRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 2 },
  teamLine: { fontSize: 13, fontWeight: "700", flex: 1, paddingRight: 8 },
  teamScore: { fontSize: 13, fontWeight: "800" },
  matchResult: { fontSize: 12, fontWeight: "800", marginTop: 4 },
});
