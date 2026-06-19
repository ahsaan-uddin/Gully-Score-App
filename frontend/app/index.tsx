import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/src/theme/ThemeContext";
import {
  getCurrentMatchId,
  loadAllMatches,
  seedDemoIfNeeded,
} from "@/src/storage/matches";
import { Match } from "@/src/types/cricket";
import { formatOvers } from "@/src/logic/cricket";

export default function Dashboard() {
  const { colors, mode, toggle } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [matches, setMatches] = useState<Match[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    await seedDemoIfNeeded();
    const [list, cur] = await Promise.all([loadAllMatches(), getCurrentMatchId()]);
    setMatches(list);
    setCurrentId(cur);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const current = currentId ? matches.find((m) => m.id === currentId) : null;
  const completed = matches.filter((m) => m.status === "completed");

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 32,
          paddingHorizontal: 20,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.brand, { color: colors.primary }]}>GullyScore</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Tap. Score. Win.
            </Text>
          </View>
          <TouchableOpacity
            onPress={toggle}
            style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
            testID="theme-toggle-button"
          >
            <Ionicons
              name={mode === "dark" ? "sunny-outline" : "moon-outline"}
              size={20}
              color={colors.textPrimary}
            />
          </TouchableOpacity>
        </View>

        {/* Resume in-progress */}
        {current && (
          <TouchableOpacity
            testID="resume-match-card"
            onPress={() => router.push("/live")}
            activeOpacity={0.9}
            style={[
              styles.resumeCard,
              { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.resumeBadge, { color: colors.primary }]}>
                LIVE • IN PROGRESS
              </Text>
              <Text style={[styles.resumeTitle, { color: colors.textPrimary }]}>
                {current.teams[0].name} vs {current.teams[1].name}
              </Text>
              <Text style={[styles.resumeMeta, { color: colors.textSecondary }]}>
                {current.oversTotal} overs • {current.playersPerSide}-a-side
              </Text>
            </View>
            <Ionicons name="play-circle" size={48} color={colors.primary} />
          </TouchableOpacity>
        )}

        {/* New Match CTA */}
        <TouchableOpacity
          testID="new-match-button"
          activeOpacity={0.9}
          onPress={() => router.push("/setup")}
          style={[styles.ctaButton, { backgroundColor: colors.primary }]}
        >
          <Ionicons name="add-circle" size={26} color={colors.onPrimary} />
          <Text style={[styles.ctaText, { color: colors.onPrimary }]}>
            New Match
          </Text>
        </TouchableOpacity>

        {/* Quick actions */}
        <View style={styles.quickRow}>
          <TouchableOpacity
            testID="quick-players-button"
            activeOpacity={0.85}
            onPress={() => router.push("/players")}
            style={[
              styles.quickCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View
              style={[
                styles.quickIcon,
                { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
              ]}
            >
              <Ionicons name="stats-chart" size={20} color={colors.primary} />
            </View>
            <Text style={[styles.quickTitle, { color: colors.textPrimary }]}>
              Player Stats
            </Text>
            <Text style={[styles.quickDesc, { color: colors.textSecondary }]} numberOfLines={2}>
              Lifetime runs, wickets, SR & more
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            testID="quick-backup-button"
            activeOpacity={0.85}
            onPress={() => router.push("/backup")}
            style={[
              styles.quickCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View
              style={[
                styles.quickIcon,
                { backgroundColor: colors.warningMuted, borderColor: colors.warning },
              ]}
            >
              <Ionicons name="share-social-outline" size={20} color={colors.warning} />
            </View>
            <Text style={[styles.quickTitle, { color: colors.textPrimary }]}>
              Backup &amp; Share
            </Text>
            <Text style={[styles.quickDesc, { color: colors.textSecondary }]} numberOfLines={2}>
              Export / import data across devices
            </Text>
          </TouchableOpacity>
        </View>

        {/* Recent matches */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Recent Matches
          </Text>
          {completed.length > 0 && (
            <TouchableOpacity
              testID="view-all-history-button"
              onPress={() => router.push("/history")}
            >
              <Text style={[styles.linkText, { color: colors.primary }]}>
                View all
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {completed.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            testID="recent-matches-empty"
          >
            <Ionicons name="trophy-outline" size={36} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              No matches yet
            </Text>
            <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
              Start your first gully cricket match and it&apos;ll show up here.
            </Text>
          </View>
        ) : (
          completed.slice(0, 5).map((m) => (
            <MatchSummaryCard key={m.id} match={m} onPress={() => router.push({ pathname: "/scorecard", params: { id: m.id } })} />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function MatchSummaryCard({ match, onPress }: { match: Match; onPress: () => void }) {
  const { colors } = useTheme();
  const i1 = match.innings1;
  const i2 = match.innings2;
  const date = new Date(match.createdAt).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
  });
  return (
    <TouchableOpacity
      testID={`match-card-${match.id}`}
      onPress={onPress}
      activeOpacity={0.85}
      style={[
        styles.matchCard,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.matchHeader}>
        <Text style={[styles.matchDate, { color: colors.textMuted }]}>{date}</Text>
        <View
          style={[
            styles.statusPill,
            { backgroundColor: colors.primaryMuted },
          ]}
        >
          <Text style={[styles.statusPillText, { color: colors.primary }]}>
            {match.oversTotal} ov
          </Text>
        </View>
      </View>
      <View style={styles.teamRow}>
        <Text style={[styles.teamName, { color: colors.textPrimary }]} numberOfLines={1}>
          {match.teams[i1.battingTeamIdx].name}
        </Text>
        <Text style={[styles.teamScore, { color: colors.textPrimary }]}>
          {i1.score}/{i1.wickets}
          <Text style={[styles.overSub, { color: colors.textMuted }]}>
            {"  "}({formatOvers(i1.legalBalls).text})
          </Text>
        </Text>
      </View>
      {i2 && (
        <View style={styles.teamRow}>
          <Text style={[styles.teamName, { color: colors.textPrimary }]} numberOfLines={1}>
            {match.teams[i2.battingTeamIdx].name}
          </Text>
          <Text style={[styles.teamScore, { color: colors.textPrimary }]}>
            {i2.score}/{i2.wickets}
            <Text style={[styles.overSub, { color: colors.textMuted }]}>
              {"  "}({formatOvers(i2.legalBalls).text})
            </Text>
          </Text>
        </View>
      )}
      {match.resultText && (
        <Text style={[styles.resultText, { color: colors.primary }]} numberOfLines={2}>
          {match.resultText}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  brand: { fontSize: 32, fontWeight: "900", letterSpacing: -1 },
  subtitle: { fontSize: 14, fontWeight: "500", marginTop: 2 },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  resumeCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  resumeBadge: { fontSize: 11, fontWeight: "800", letterSpacing: 1.2 },
  resumeTitle: { fontSize: 18, fontWeight: "800", marginTop: 4 },
  resumeMeta: { fontSize: 13, fontWeight: "500", marginTop: 2 },
  ctaButton: {
    height: 64,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
    marginBottom: 28,
    boxShadow: "0 6px 12px rgba(0,0,0,0.18)",
    elevation: 3,
  },
  ctaText: { fontSize: 18, fontWeight: "800", letterSpacing: 0.2 },
  quickRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: -8,
    marginBottom: 24,
  },
  quickCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 4,
  },
  quickIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  quickTitle: { fontSize: 14, fontWeight: "800" },
  quickDesc: { fontSize: 11, fontWeight: "600", lineHeight: 15 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: "800" },
  linkText: { fontSize: 14, fontWeight: "700" },
  emptyCard: {
    borderRadius: 18,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    gap: 6,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", marginTop: 4 },
  emptyDesc: { fontSize: 13, textAlign: "center" },
  matchCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  matchHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  matchDate: { fontSize: 12, fontWeight: "600" },
  statusPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  statusPillText: { fontSize: 11, fontWeight: "800", letterSpacing: 0.5 },
  teamRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  teamName: { fontSize: 15, fontWeight: "700", flex: 1, paddingRight: 8 },
  teamScore: { fontSize: 15, fontWeight: "800" },
  overSub: { fontSize: 12, fontWeight: "600" },
  resultText: { fontSize: 13, fontWeight: "700", marginTop: 8 },
});
