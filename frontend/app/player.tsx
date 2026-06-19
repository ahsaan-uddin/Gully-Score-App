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
import { loadAllMatches } from "@/src/storage/matches";
import {
  battingAverage,
  battingStrikeRate,
  bowlingEconomy,
  computeLifetimeStats,
  PlayerLifetimeStats,
} from "@/src/logic/stats";
import { Match } from "@/src/types/cricket";
import { formatOvers } from "@/src/logic/cricket";
import { Palette } from "@/src/theme/tokens";

export default function PlayerDetailScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ key?: string }>();
  const [stats, setStats] = useState<PlayerLifetimeStats | null>(null);
  const [allMatches, setAllMatches] = useState<Match[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const all = await loadAllMatches();
        const computed = computeLifetimeStats(all);
        const found = computed.find((s) => s.key === params.key) ?? null;
        if (!cancelled) {
          setStats(found);
          setAllMatches(all);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [params.key]),
  );

  if (!stats) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top + 48 }}>
        <Text style={{ color: colors.textSecondary, textAlign: "center" }}>
          Loading player...
        </Text>
      </View>
    );
  }

  const sr = battingStrikeRate(stats.batting);
  const avg = battingAverage(stats.batting);
  const econ = bowlingEconomy(stats.bowling);
  const bestB = stats.bowling.best
    ? `${stats.bowling.best.w}/${stats.bowling.best.r}`
    : "—";

  const playedMatches = allMatches.filter((m) => stats.matchIds.includes(m.id));

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          testID="player-back-button"
          onPress={() => router.back()}
          style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Player Profile</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 24,
          gap: 16,
        }}
      >
        {/* Hero */}
        <View
          style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View
            style={[
              styles.avatar,
              { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
            ]}
          >
            <Text style={{ color: colors.primary, fontWeight: "900", fontSize: 28 }}>
              {(stats.displayName?.[0] ?? "?").toUpperCase()}
            </Text>
          </View>
          <Text testID="player-name" style={[styles.heroName, { color: colors.textPrimary }]}>
            {stats.displayName}
          </Text>
          <Text style={[styles.heroTeams, { color: colors.textSecondary }]}>
            {stats.teams.join(" • ") || "—"}
          </Text>
          <View style={styles.heroStats}>
            <HeroStat label="Matches" value={String(stats.matches)} colors={colors} />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <HeroStat label="Runs" value={String(stats.batting.runs)} colors={colors} />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <HeroStat label="Wickets" value={String(stats.bowling.wickets)} colors={colors} />
          </View>
        </View>

        {/* Batting card */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="flame" size={18} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Batting</Text>
          </View>
          <View style={styles.statsGrid}>
            <Stat colors={colors} label="Innings" value={String(stats.batting.innings)} />
            <Stat colors={colors} label="Runs" value={String(stats.batting.runs)} />
            <Stat colors={colors} label="Balls" value={String(stats.batting.balls)} />
            <Stat colors={colors} label="Highest" value={String(stats.batting.highest)} />
            <Stat colors={colors} label="Strike Rate" value={sr.toFixed(1)} />
            <Stat colors={colors} label="Average" value={avg.toFixed(1)} />
            <Stat colors={colors} label="Fours" value={String(stats.batting.fours)} />
            <Stat colors={colors} label="Sixes" value={String(stats.batting.sixes)} />
          </View>
        </View>

        {/* Bowling card */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="thunderstorm" size={18} color={colors.danger} />
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Bowling</Text>
          </View>
          <View style={styles.statsGrid}>
            <Stat colors={colors} label="Innings" value={String(stats.bowling.inningsBowled)} />
            <Stat colors={colors} label="Overs" value={formatOvers(stats.bowling.legalBalls).text} />
            <Stat colors={colors} label="Runs" value={String(stats.bowling.runs)} />
            <Stat colors={colors} label="Wickets" value={String(stats.bowling.wickets)} />
            <Stat colors={colors} label="Economy" value={econ.toFixed(2)} />
            <Stat colors={colors} label="Best" value={bestB} />
          </View>
        </View>

        {/* Match list */}
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
          Matches played
        </Text>
        {playedMatches.map((m) => {
          const date = new Date(m.createdAt).toLocaleDateString(undefined, {
            day: "2-digit",
            month: "short",
            year: "numeric",
          });
          return (
            <TouchableOpacity
              key={m.id}
              testID={`player-match-${m.id}`}
              onPress={() =>
                router.push({ pathname: "/scorecard", params: { id: m.id } })
              }
              style={[styles.mRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.mTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                  {m.teams[0].name} vs {m.teams[1].name}
                </Text>
                <Text style={[styles.mDate, { color: colors.textMuted }]}>{date}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

function HeroStat({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: Palette;
}) {
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Text style={{ fontSize: 20, fontWeight: "900", color: colors.textPrimary }}>{value}</Text>
      <Text style={{ fontSize: 11, fontWeight: "800", color: colors.textMuted, letterSpacing: 0.6 }}>
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

function Stat({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: Palette;
}) {
  return (
    <View style={[styles.statCell, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
      <Text style={[styles.statValue, { color: colors.textPrimary }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
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
  hero: {
    borderWidth: 1,
    borderRadius: 20,
    alignItems: "center",
    padding: 20,
    gap: 6,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  heroName: { fontSize: 22, fontWeight: "900", letterSpacing: -0.4, marginTop: 8 },
  heroTeams: { fontSize: 13, fontWeight: "600" },
  heroStats: {
    flexDirection: "row",
    alignSelf: "stretch",
    alignItems: "center",
    marginTop: 14,
  },
  divider: { width: 1, alignSelf: "stretch" },
  card: { borderWidth: 1, borderRadius: 16, padding: 14 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  cardTitle: { fontSize: 15, fontWeight: "800" },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statCell: {
    width: "31.5%",
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
  },
  statValue: { fontSize: 16, fontWeight: "900", letterSpacing: -0.3 },
  statLabel: { fontSize: 11, fontWeight: "700", marginTop: 2, letterSpacing: 0.4 },
  sectionTitle: { fontSize: 16, fontWeight: "800", marginTop: 4 },
  mRow: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  mTitle: { fontSize: 14, fontWeight: "700" },
  mDate: { fontSize: 11, fontWeight: "600", marginTop: 2 },
});
