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
import { Match } from "@/src/types/cricket";
import { computeMvp, formatOvers } from "@/src/logic/cricket";
import { getMatch } from "@/src/storage/matches";

export default function ResultScreen() {
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

  const mvp = computeMvp(match);
  const i1 = match.innings1;
  const i2 = match.innings2;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 20,
        }}
      >
        {/* Header */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <TouchableOpacity
            testID="result-home-button"
            onPress={() => router.replace("/")}
            style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Ionicons name="home-outline" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Result</Text>
          <View style={{ width: 44 }} />
        </View>

        {/* Winner */}
        <View style={[styles.winnerCard, { borderColor: colors.primary, backgroundColor: colors.primaryMuted }]}>
          <Ionicons name="trophy" size={48} color={colors.primary} />
          <Text style={[styles.winnerLabel, { color: colors.primary }]} testID="result-text">
            {match.resultText ?? "Result"}
          </Text>
        </View>

        {/* Scores */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ScoreLine match={match} innings={i1} />
          {i2 && (
            <>
              <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 10 }} />
              <ScoreLine match={match} innings={i2} />
            </>
          )}
        </View>

        {/* MVPs */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary, marginTop: 22 }]}>
          Player of the Match
        </Text>
        {mvp.topScorer && (
          <View style={[styles.mvpCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View
              style={[styles.mvpIcon, { backgroundColor: colors.primaryMuted, borderColor: colors.primary }]}
            >
              <Ionicons name="flame" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.mvpKind, { color: colors.primary }]}>TOP SCORER</Text>
              <Text style={[styles.mvpName, { color: colors.textPrimary }]} testID="top-scorer">
                {mvp.topScorer.playerName}
              </Text>
              <Text style={[styles.mvpMeta, { color: colors.textSecondary }]}>
                {match.teams[mvp.topScorer.teamIdx].name} • {mvp.topScorer.runs} ({mvp.topScorer.balls})
              </Text>
            </View>
          </View>
        )}
        {mvp.bestBowler && (
          <View style={[styles.mvpCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View
              style={[styles.mvpIcon, { backgroundColor: colors.dangerMuted, borderColor: colors.danger }]}
            >
              <Ionicons name="thunderstorm" size={22} color={colors.danger} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.mvpKind, { color: colors.danger }]}>BEST BOWLER</Text>
              <Text style={[styles.mvpName, { color: colors.textPrimary }]} testID="best-bowler">
                {mvp.bestBowler.playerName}
              </Text>
              <Text style={[styles.mvpMeta, { color: colors.textSecondary }]}>
                {match.teams[mvp.bestBowler.teamIdx].name} • {mvp.bestBowler.wickets}/{mvp.bestBowler.runs} ({formatOvers(mvp.bestBowler.legalBalls).text})
              </Text>
            </View>
          </View>
        )}

        {/* Full scorecard button */}
        <TouchableOpacity
          testID="view-scorecard-button"
          onPress={() => router.push({ pathname: "/scorecard", params: { id: match.id } })}
          activeOpacity={0.9}
          style={[styles.scoreCardBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
        >
          <Ionicons name="document-text-outline" size={18} color={colors.textPrimary} />
          <Text style={[styles.scoreCardBtnText, { color: colors.textPrimary }]}>
            View Full Scorecard
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          testID="new-match-from-result"
          onPress={() => router.replace("/setup")}
          activeOpacity={0.9}
          style={[styles.primaryBtn, { backgroundColor: colors.primary, marginTop: 12 }]}
        >
          <Ionicons name="add-circle" size={20} color={colors.onPrimary} />
          <Text style={[styles.primaryBtnText, { color: colors.onPrimary }]}>
            New Match
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function ScoreLine({ match, innings }: { match: Match; innings: NonNullable<Match["innings1"]> }) {
  const { colors } = useTheme();
  const overs = formatOvers(innings.legalBalls).text;
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.scoreTeamName, { color: colors.textPrimary }]} numberOfLines={1}>
          {match.teams[innings.battingTeamIdx].name}
        </Text>
        <Text style={[styles.scoreSub, { color: colors.textMuted }]}>
          ({overs} ov)
        </Text>
      </View>
      <Text style={[styles.scoreVal, { color: colors.textPrimary }]}>
        {innings.score}/{innings.wickets}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  headerTitle: { fontSize: 18, fontWeight: "800" },
  winnerCard: {
    marginTop: 20,
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    gap: 8,
  },
  winnerLabel: {
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -0.3,
  },
  card: {
    marginTop: 16,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  scoreTeamName: { fontSize: 16, fontWeight: "800" },
  scoreSub: { fontSize: 12, fontWeight: "600" },
  scoreVal: { fontSize: 22, fontWeight: "900", letterSpacing: -0.5 },
  sectionTitle: { fontSize: 18, fontWeight: "800" },
  mvpCard: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  mvpIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  mvpKind: { fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
  mvpName: { fontSize: 17, fontWeight: "800", marginTop: 2 },
  mvpMeta: { fontSize: 13, fontWeight: "600", marginTop: 2 },
  scoreCardBtn: {
    marginTop: 22,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  scoreCardBtnText: { fontSize: 15, fontWeight: "800" },
  primaryBtn: {
    height: 56,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryBtnText: { fontSize: 17, fontWeight: "800" },
});
