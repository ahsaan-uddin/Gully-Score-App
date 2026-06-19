import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/src/theme/ThemeContext";
import { Innings, Match } from "@/src/types/cricket";
import { formatOvers } from "@/src/logic/cricket";
import { getMatch } from "@/src/storage/matches";

export default function ScorecardScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id?: string }>();
  const [match, setMatch] = useState<Match | null>(null);

  useEffect(() => {
    (async () => {
      if (!params.id) {
        router.replace("/");
        return;
      }
      const m = await getMatch(params.id);
      if (!m) {
        router.replace("/");
        return;
      }
      setMatch(m);
    })();
  }, [params.id, router]);

  if (!match) return <View style={{ flex: 1, backgroundColor: colors.background }} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          testID="scorecard-back-button"
          onPress={() => router.back()}
          style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          Full Scorecard
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 32,
          gap: 18,
        }}
      >
        {match.resultText && (
          <View style={[styles.resultBox, { backgroundColor: colors.primaryMuted, borderColor: colors.primary }]}>
            <Ionicons name="trophy" size={18} color={colors.primary} />
            <Text style={[styles.resultText, { color: colors.primary }]}>{match.resultText}</Text>
          </View>
        )}

        <InningsBlock match={match} innings={match.innings1} idx={1} />
        {match.innings2 && (
          <InningsBlock match={match} innings={match.innings2} idx={2} />
        )}
      </ScrollView>
    </View>
  );
}

function InningsBlock({
  match,
  innings,
  idx,
}: {
  match: Match;
  innings: Innings;
  idx: number;
}) {
  const { colors } = useTheme();
  const battingTeam = match.teams[innings.battingTeamIdx];
  const bowlingTeam = match.teams[(1 - innings.battingTeamIdx) as 0 | 1];
  const overs = formatOvers(innings.legalBalls).text;
  return (
    <View style={[styles.block, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.blockHeader}>
        <View>
          <Text style={[styles.inningsTitle, { color: colors.textPrimary }]}>
            {idx === 1 ? "1st" : "2nd"} Innings • {battingTeam.name}
          </Text>
          <Text style={[styles.inningsSub, { color: colors.textSecondary }]}>
            vs {bowlingTeam.name}
          </Text>
        </View>
        <Text style={[styles.inningsTotal, { color: colors.textPrimary }]}>
          {innings.score}/{innings.wickets}{" "}
          <Text style={[styles.inningsOver, { color: colors.textMuted }]}>
            ({overs})
          </Text>
        </Text>
      </View>

      {/* Batsmen Table */}
      <View style={styles.tableHeader}>
        <Text style={[styles.thName, { color: colors.textMuted }]}>BATTING</Text>
        <Text style={[styles.thStat, { color: colors.textMuted }]}>R</Text>
        <Text style={[styles.thStat, { color: colors.textMuted }]}>B</Text>
        <Text style={[styles.thStat, { color: colors.textMuted }]}>4s</Text>
        <Text style={[styles.thStat, { color: colors.textMuted }]}>6s</Text>
        <Text style={[styles.thStat, { color: colors.textMuted }]}>SR</Text>
      </View>
      {Object.values(innings.batsmen).map((b) => {
        const sr = b.balls === 0 ? 0 : (b.runs / b.balls) * 100;
        return (
          <View key={b.playerIdx} style={styles.tableRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.tdName, { color: colors.textPrimary }]} numberOfLines={1}>
                {battingTeam.players[b.playerIdx] ?? `Player ${b.playerIdx + 1}`}
              </Text>
              <Text style={[styles.tdMeta, { color: b.out ? colors.danger : colors.textMuted }]}>
                {b.out ? "out" : "not out"}
              </Text>
            </View>
            <Text style={[styles.tdStat, { color: colors.textPrimary, fontWeight: "800" }]}>{b.runs}</Text>
            <Text style={[styles.tdStat, { color: colors.textPrimary }]}>{b.balls}</Text>
            <Text style={[styles.tdStat, { color: colors.textPrimary }]}>{b.fours}</Text>
            <Text style={[styles.tdStat, { color: colors.textPrimary }]}>{b.sixes}</Text>
            <Text style={[styles.tdStat, { color: colors.textPrimary }]}>{sr.toFixed(0)}</Text>
          </View>
        );
      })}

      <View style={{ height: 16 }} />

      {/* Bowler Table */}
      <View style={styles.tableHeader}>
        <Text style={[styles.thName, { color: colors.textMuted }]}>BOWLING</Text>
        <Text style={[styles.thStat, { color: colors.textMuted }]}>O</Text>
        <Text style={[styles.thStat, { color: colors.textMuted }]}>R</Text>
        <Text style={[styles.thStat, { color: colors.textMuted }]}>W</Text>
        <Text style={[styles.thStat, { color: colors.textMuted }]}>Econ</Text>
      </View>
      {Object.values(innings.bowlers).map((b) => {
        const o = formatOvers(b.legalBalls).text;
        const econ = b.legalBalls === 0 ? 0 : (b.runs / b.legalBalls) * 6;
        return (
          <View key={b.playerIdx} style={styles.tableRow}>
            <Text style={[styles.tdName, { color: colors.textPrimary, flex: 1 }]} numberOfLines={1}>
              {bowlingTeam.players[b.playerIdx] ?? `Player ${b.playerIdx + 1}`}
            </Text>
            <Text style={[styles.tdStat, { color: colors.textPrimary }]}>{o}</Text>
            <Text style={[styles.tdStat, { color: colors.textPrimary }]}>{b.runs}</Text>
            <Text style={[styles.tdStat, { color: colors.textPrimary, fontWeight: "800" }]}>{b.wickets}</Text>
            <Text style={[styles.tdStat, { color: colors.textPrimary }]}>{econ.toFixed(1)}</Text>
          </View>
        );
      })}
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
  resultBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  resultText: { fontSize: 14, fontWeight: "800" },
  block: { borderWidth: 1, borderRadius: 16, padding: 14 },
  blockHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 12,
  },
  inningsTitle: { fontSize: 16, fontWeight: "800" },
  inningsSub: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  inningsTotal: { fontSize: 22, fontWeight: "900", letterSpacing: -0.4 },
  inningsOver: { fontSize: 12, fontWeight: "700" },
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  thName: { flex: 1, fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  thStat: { width: 38, textAlign: "right", fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },
  tableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  tdName: { fontSize: 14, fontWeight: "700" },
  tdMeta: { fontSize: 11, fontWeight: "600", marginTop: 2 },
  tdStat: {
    width: 38,
    textAlign: "right",
    fontSize: 13,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
});
