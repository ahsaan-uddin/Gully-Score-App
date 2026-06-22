import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/src/theme/ThemeContext";
import { Palette } from "@/src/theme/tokens";
import {
  applyBallMutable,
  deepClone,
  describeBall,
  finalizeResult,
  formatOvers,
  runRate,
  setNewBatsman,
  setNewBowler,
  startSecondInnings,
} from "@/src/logic/cricket";
import {
  Ball,
  Extra,
  Innings,
  Match,
} from "@/src/types/cricket";
import {
  getCurrentMatchId,
  getMatch,
  loadAllMatches,
  setCurrentMatchId,
  upsertMatch,
} from "@/src/storage/matches";
import { attachMatchToSeries } from "@/src/storage/series";

export default function LiveScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [match, setMatch] = useState<Match | null>(null);
  const [snapshotStack, setSnapshotStack] = useState<Match[]>([]); // for undo

  const [batsmanModal, setBatsmanModal] = useState(false);
  const [bowlerModal, setBowlerModal] = useState(false);
  const [inningsBreakOpen, setInningsBreakOpen] = useState(false);
  const [endModal, setEndModal] = useState(false);
  const [exitConfirm, setExitConfirm] = useState(false);

  // load
  useEffect(() => {
    (async () => {
      const id = await getCurrentMatchId();
      if (!id) {
        router.replace("/");
        return;
      }
      const m = await getMatch(id);
      if (!m) {
        router.replace("/");
        return;
      }
      setMatch(m);
    })();
  }, [router]);

  const persistRef = useRef<Match | null>(null);
  useEffect(() => {
    if (match && match !== persistRef.current) {
      persistRef.current = match;
      upsertMatch(match);
    }
  }, [match]);

  const innings = useMemo<Innings | null>(() => {
    if (!match) return null;
    if (match.innings2) return match.innings2;
    return match.innings1;
  }, [match]);

  const isInningsTwo = !!match?.innings2;
  const battingTeamIdx = innings?.battingTeamIdx ?? 0;
  const bowlingTeamIdx = (1 - (battingTeamIdx as number)) as 0 | 1;
  const battingTeam = match?.teams[battingTeamIdx];
  const bowlingTeam = match?.teams[bowlingTeamIdx];

  // Detect need to pick bowler when innings starts and currentBowlerIdx is null
  useEffect(() => {
    if (!match || !innings || innings.closed) return;
    if (innings.currentBowlerIdx === null && !bowlerModal) {
      setBowlerModal(true);
    }
  }, [match, innings, bowlerModal]);

  if (!match || !innings || !battingTeam || !bowlingTeam) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  const oversFmt = formatOvers(innings.legalBalls);
  const rr = runRate(innings.score, innings.legalBalls);

  const striker = innings.batsmen[innings.strikerIdx];
  const nonStriker = innings.batsmen[innings.nonStrikerIdx];
  const bowler =
    innings.currentBowlerIdx !== null
      ? innings.bowlers[innings.currentBowlerIdx]
      : null;

  const recentBalls = innings.balls.slice(-12);

  // ---- Actions ----

  const tap = (input: { runs: number; extra: Extra; wicket: boolean }) => {
    if (innings.closed) return;
    if (innings.currentBowlerIdx === null) {
      setBowlerModal(true);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSnapshotStack((s) => {
      const next = [...s, deepClone(match)];
      // Cap undo history to avoid unbounded growth on long innings.
      return next.length > 60 ? next.slice(next.length - 60) : next;
    });

    const m = deepClone(match);
    const target = m.innings2 ? m.target : null;
    const currentInn = m.innings2 && !m.innings2.closed ? m.innings2 : m.innings1;
    const res = applyBallMutable(
      currentInn,
      input,
      m.oversTotal,
      m.playersPerSide,
      target,
      m.rules,
    );
    m.updatedAt = new Date().toISOString();

    if (res.inningsClosed) {
      // First innings closed -> open break
      if (!m.innings2) {
        setMatch(m);
        setInningsBreakOpen(true);
        return;
      }
      // Second innings closed -> finalize
      finalizeResult(m);
      setMatch(m);
      // If part of a series, attach now (best-effort, fire-and-forget).
      if (m.seriesId) {
        loadAllMatches()
          .then((all) => {
            const list = all.some((x) => x.id === m.id) ? all : [m, ...all];
            return attachMatchToSeries(m.seriesId!, m, list);
          })
          .catch(() => {});
      }
      setEndModal(true);
      return;
    }
    if (res.needsNewBatsman) {
      setMatch(m);
      setBatsmanModal(true);
      return;
    }
    if (res.needsNewBowler) {
      setMatch(m);
      setBowlerModal(true);
      return;
    }
    setMatch(m);
  };

  const onRun = (runs: number) => tap({ runs, extra: null, wicket: false });
  const onWicket = () => tap({ runs: 0, extra: null, wicket: true });
  const onExtra = (extra: Extra) => tap({ runs: 1, extra, wicket: false });

  const onUndo = () => {
    if (snapshotStack.length === 0) return;
    Haptics.selectionAsync().catch(() => {});
    const prev = snapshotStack[snapshotStack.length - 1];
    setSnapshotStack((s) => s.slice(0, -1));
    setMatch(prev);
    setInningsBreakOpen(false);
    setEndModal(false);
  };

  const onPickNewBatsman = (playerIdx: number) => {
    const m = deepClone(match);
    const inn = m.innings2 && !m.innings2.closed ? m.innings2 : m.innings1;
    setNewBatsman(inn, playerIdx);
    setMatch(m);
    setBatsmanModal(false);
  };

  const onPickNewBowler = (playerIdx: number) => {
    const m = deepClone(match);
    const inn = m.innings2 && !m.innings2.closed ? m.innings2 : m.innings1;
    setNewBowler(inn, playerIdx);
    setMatch(m);
    setBowlerModal(false);
  };

  const startInnings2 = (
    strikerIdx: number,
    nonStrikerIdx: number,
    bowlerIdx: number,
  ) => {
    const m = deepClone(match);
    startSecondInnings(m, strikerIdx, nonStrikerIdx, bowlerIdx);
    setMatch(m);
    setInningsBreakOpen(false);
  };

  const target = match.target;
  let chaseMsg: string | null = null;
  if (isInningsTwo && target && innings) {
    const need = target - innings.score;
    const ballsLeft = match.oversTotal * 6 - innings.legalBalls;
    if (need > 0 && ballsLeft > 0) {
      chaseMsg = `Need ${need} run${need === 1 ? "" : "s"} in ${ballsLeft} ball${ballsLeft === 1 ? "" : "s"}`;
    }
  }

  const rules = match.rules;
  const singleBatter = !!rules?.singleBatter;
  const allowByes = rules ? rules.allowByes : true;
  const allowLegByes = rules ? rules.allowLegByes : true;
  const freeHitArmed = !!innings.freeHitNext;

  // ---- Render ----
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Sticky Header */}
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + 8, backgroundColor: colors.surface, borderBottomColor: colors.border },
        ]}
      >
        <View style={styles.headerTop}>
          <TouchableOpacity
            testID="exit-match-button"
            onPress={() => setExitConfirm(true)}
            style={[styles.iconBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
          >
            <Ionicons name="close" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={[styles.inningsLabel, { color: colors.primary }]}>
              {isInningsTwo ? "2ND INNINGS" : "1ST INNINGS"}
            </Text>
            <Text style={[styles.battingTeamName, { color: colors.textPrimary }]} numberOfLines={1}>
              {battingTeam.name}
            </Text>
          </View>
          <TouchableOpacity
            testID="undo-button"
            onPress={onUndo}
            disabled={snapshotStack.length === 0}
            style={[
              styles.iconBtn,
              {
                backgroundColor: colors.surfaceElevated,
                borderColor: colors.border,
                opacity: snapshotStack.length === 0 ? 0.35 : 1,
              },
            ]}
          >
            <Ionicons name="arrow-undo" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        <View style={styles.scoreRow} testID="score-row">
          <Text style={[styles.scoreMain, { color: colors.textPrimary }]}>
            {innings.score}
            <Text style={[styles.scoreWickets, { color: colors.textSecondary }]}>
              /{innings.wickets}
            </Text>
          </Text>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={[styles.metaTopLine, { color: colors.textMuted }]}>OVERS</Text>
            <Text style={[styles.metaTopValue, { color: colors.textPrimary }]}>
              {oversFmt.text}
              <Text style={[styles.metaSub, { color: colors.textMuted }]}>
                /{match.oversTotal}
              </Text>
            </Text>
            <Text style={[styles.metaTopLine, { color: colors.textMuted, marginTop: 4 }]}>
              CRR
            </Text>
            <Text style={[styles.metaTopValue, { color: colors.textPrimary }]}>
              {rr.toFixed(2)}
            </Text>
          </View>
        </View>

        {chaseMsg && (
          <View
            testID="chase-banner"
            style={[styles.chaseBanner, { backgroundColor: colors.accentBlue }]}
          >
            <Ionicons name="flag" size={16} color="#fff" />
            <Text style={styles.chaseText}>{chaseMsg}</Text>
          </View>
        )}

        {freeHitArmed && (
          <View
            testID="freehit-banner"
            style={[styles.chaseBanner, { backgroundColor: colors.warning }]}
          >
            <Ionicons name="flash" size={16} color="#fff" />
            <Text style={styles.chaseText}>FREE HIT • Wicket disabled this ball</Text>
          </View>
        )}
      </View>

      {/* Scrollable content */}
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: 16,
          gap: 12,
        }}
      >
        {/* Batsmen */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.cardLabel, { color: colors.textMuted }]}>BATSMEN</Text>
            <Text style={[styles.cardLabelMini, { color: colors.textMuted }]}>R  B  4s 6s SR</Text>
          </View>
          {striker && (
            <BatsmanRow
              colors={colors}
              name={battingTeam.players[striker.playerIdx]}
              stat={striker}
              isStriker
              testID="striker-row"
            />
          )}
          {!singleBatter && nonStriker && (
            <BatsmanRow
              colors={colors}
              name={battingTeam.players[nonStriker.playerIdx]}
              stat={nonStriker}
              isStriker={false}
              testID="nonstriker-row"
            />
          )}
        </View>

        {/* Bowler */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.cardLabel, { color: colors.textMuted }]}>BOWLER</Text>
            <Text style={[styles.cardLabelMini, { color: colors.textMuted }]}>O  R  W ECON</Text>
          </View>
          {bowler ? (
            <BowlerRow
              colors={colors}
              name={bowlingTeam.players[bowler.playerIdx]}
              stat={bowler}
            />
          ) : (
            <Text style={[styles.placeholder, { color: colors.textMuted }]}>
              Select bowler to start the over
            </Text>
          )}
        </View>

        {/* This Over chips */}
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHeaderRow}>
            <Text style={[styles.cardLabel, { color: colors.textMuted }]}>RECENT</Text>
            <Text style={[styles.cardLabelMini, { color: colors.textMuted }]}>
              {recentBalls.length === 0 ? "Yet to bowl" : "Last balls"}
            </Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingVertical: 6 }}
          >
            {recentBalls.length === 0 && (
              <Text style={[styles.placeholder, { color: colors.textMuted }]}>—</Text>
            )}
            {recentBalls.map((b, idx) => (
              <BallChip key={idx} ball={b} colors={colors} />
            ))}
          </ScrollView>
        </View>
      </ScrollView>

      {/* Scoring Pad */}
      <View
        style={[
          styles.padContainer,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            paddingBottom: insets.bottom + 12,
          },
        ]}
      >
        {/* Extras + Wicket */}
        <View style={styles.extrasRow}>
          {(
            [
              { label: "Wd", extra: "wd" as Extra, testID: "extra-wd", enabled: true },
              { label: "Nb", extra: "nb" as Extra, testID: "extra-nb", enabled: true },
              { label: "B", extra: "b" as Extra, testID: "extra-b", enabled: allowByes },
              { label: "Lb", extra: "lb" as Extra, testID: "extra-lb", enabled: allowLegByes },
            ]
          ).filter((e) => e.enabled).map((e) => (
            <TouchableOpacity
              key={e.label}
              testID={e.testID}
              onPress={() => onExtra(e.extra)}
              style={[
                styles.extraBtn,
                {
                  backgroundColor: colors.warningMuted,
                  borderColor: colors.warning,
                },
              ]}
              activeOpacity={0.8}
            >
              <Text style={[styles.extraText, { color: colors.warning }]}>{e.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Runs Grid */}
        <View style={styles.runsGrid}>
          {[0, 1, 2, 3, 4, 6].map((n) => {
            const isBoundary = n === 4 || n === 6;
            return (
              <TouchableOpacity
                key={n}
                testID={`run-button-${n}`}
                onPress={() => onRun(n)}
                activeOpacity={0.8}
                style={[
                  styles.runBtn,
                  {
                    backgroundColor: isBoundary
                      ? colors.primaryMuted
                      : colors.surfaceElevated,
                    borderColor: isBoundary ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.runBtnText,
                    {
                      color: isBoundary ? colors.primary : colors.textPrimary,
                      fontWeight: isBoundary ? "900" : "800",
                    },
                  ]}
                >
                  {n}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Wicket */}
        <TouchableOpacity
          testID="wicket-button"
          onPress={onWicket}
          disabled={freeHitArmed}
          activeOpacity={0.85}
          style={[
            styles.wicketBtn,
            {
              backgroundColor: colors.dangerMuted,
              borderColor: colors.danger,
              opacity: freeHitArmed ? 0.35 : 1,
            },
          ]}
        >
          <Ionicons name="alert-circle" size={20} color={colors.danger} />
          <Text style={[styles.wicketText, { color: colors.danger }]}>WICKET</Text>
        </TouchableOpacity>
      </View>

      {/* New Batsman Modal */}
      <PickerModal
        visible={batsmanModal}
        title="New Batsman"
        subtitle="Select from yet-to-bat"
        options={innings.yetToBat.map((idx) => ({
          idx,
          label: battingTeam.players[idx] ?? `Player ${idx + 1}`,
        }))}
        onPick={onPickNewBatsman}
        onClose={() => {}}
        colors={colors}
        testPrefix="newbat"
      />

      {/* New Bowler Modal */}
      <PickerModal
        visible={bowlerModal}
        title="New Bowler"
        subtitle="Pick from bowling side"
        options={bowlingTeam.players
          .map((name, idx) => ({ idx, label: name || `Player ${idx + 1}` }))
          .filter((o) => o.idx !== innings.previousBowlerIdx)}
        onPick={onPickNewBowler}
        onClose={() => {}}
        colors={colors}
        testPrefix="newbowl"
      />

      {/* Innings Break */}
      <InningsBreakModal
        visible={inningsBreakOpen}
        match={match}
        onStart={startInnings2}
        colors={colors}
      />

      {/* End match */}
      <Modal visible={endModal} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="trophy" size={42} color={colors.primary} />
            <Text style={[styles.modalTitle, { color: colors.textPrimary, marginTop: 8 }]}>
              Match Over
            </Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary, textAlign: "center" }]}>
              {match.resultText ?? "Match completed"}
            </Text>
            <TouchableOpacity
              testID="view-result-button"
              onPress={async () => {
                await setCurrentMatchId(null);
                setEndModal(false);
                router.replace({ pathname: "/result", params: { id: match.id } });
              }}
              style={[styles.primaryBtn, { backgroundColor: colors.primary, marginTop: 18 }]}
            >
              <Text style={[styles.primaryBtnText, { color: colors.onPrimary }]}>
                View Result
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Exit confirm */}
      <Modal visible={exitConfirm} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              Exit Live Scoring?
            </Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary, textAlign: "center" }]}>
              Match is saved. You can resume from the dashboard.
            </Text>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 18, width: "100%" }}>
              <TouchableOpacity
                testID="exit-cancel"
                onPress={() => setExitConfirm(false)}
                style={[styles.secondaryBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
              >
                <Text style={[styles.primaryBtnText, { color: colors.textPrimary }]}>Stay</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="exit-confirm"
                onPress={() => {
                  setExitConfirm(false);
                  router.replace("/");
                }}
                style={[styles.primaryBtn, { backgroundColor: colors.danger, flex: 1 }]}
              >
                <Text style={[styles.primaryBtnText, { color: "#fff" }]}>Exit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ---- Subcomponents ----

function BatsmanRow({
  colors,
  name,
  stat,
  isStriker,
  testID,
}: {
  colors: Palette;
  name?: string;
  stat: { runs: number; balls: number; fours: number; sixes: number };
  isStriker: boolean;
  testID: string;
}) {
  const sr = stat.balls === 0 ? 0 : (stat.runs / stat.balls) * 100;
  return (
    <View style={styles.batsmanRow} testID={testID}>
      <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
        <Text
          style={[
            styles.batsmanName,
            { color: colors.textPrimary, fontWeight: isStriker ? "800" : "600" },
          ]}
          numberOfLines={1}
        >
          {name ?? "—"}
        </Text>
        {isStriker && (
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: colors.primary,
              marginLeft: 8,
            }}
          />
        )}
      </View>
      <Text style={[styles.batsmanStats, { color: colors.textPrimary }]}>
        {String(stat.runs).padStart(2, " ")} {String(stat.balls).padStart(2, " ")}  {stat.fours} {stat.sixes} {sr.toFixed(0)}
      </Text>
    </View>
  );
}

function BowlerRow({
  colors,
  name,
  stat,
}: {
  colors: Palette;
  name?: string;
  stat: { legalBalls: number; runs: number; wickets: number };
}) {
  const overs = formatOvers(stat.legalBalls).text;
  const econ =
    stat.legalBalls === 0 ? 0 : (stat.runs / stat.legalBalls) * 6;
  return (
    <View style={styles.batsmanRow} testID="bowler-row">
      <Text style={[styles.batsmanName, { color: colors.textPrimary, flex: 1 }]} numberOfLines={1}>
        {name ?? "—"}
      </Text>
      <Text style={[styles.batsmanStats, { color: colors.textPrimary }]}>
        {overs}  {stat.runs} {stat.wickets} {econ.toFixed(1)}
      </Text>
    </View>
  );
}

function BallChip({ ball, colors }: { ball: Ball; colors: Palette }) {
  const label = describeBall(ball);
  let bg = colors.surfaceElevated;
  let fg = colors.textPrimary;
  let border = colors.border;
  if (ball.wicket) {
    bg = colors.danger;
    fg = "#fff";
    border = colors.danger;
  } else if (ball.runs === 4 || ball.runs === 6) {
    if (ball.extra === null) {
      bg = colors.primary;
      fg = colors.onPrimary;
      border = colors.primary;
    }
  } else if (ball.extra) {
    bg = colors.warningMuted;
    fg = colors.warning;
    border = colors.warning;
  }
  return (
    <View
      style={{
        minWidth: 38,
        height: 38,
        paddingHorizontal: 10,
        borderRadius: 19,
        borderWidth: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: bg,
        borderColor: border,
        flexShrink: 0,
      }}
    >
      <Text style={{ color: fg, fontWeight: "800", fontSize: 13 }}>{label}</Text>
    </View>
  );
}

function PickerModal({
  visible,
  title,
  subtitle,
  options,
  onPick,
  colors,
  testPrefix,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  options: { idx: number; label: string }[];
  onPick: (idx: number) => void;
  onClose: () => void;
  colors: Palette;
  testPrefix: string;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalBackdrop}>
        <View
          style={[
            styles.bottomSheet,
            { backgroundColor: colors.background },
          ]}
        >
          <View style={styles.modalHandle} />
          <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{title}</Text>
          {subtitle && (
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
              {subtitle}
            </Text>
          )}
          <ScrollView
            style={{ maxHeight: 320, marginTop: 12 }}
            contentContainerStyle={{ gap: 8, paddingBottom: 20 }}
          >
            {options.length === 0 && (
              <Text style={[styles.placeholder, { color: colors.textMuted }]}>
                No players available.
              </Text>
            )}
            {options.map((o) => (
              <TouchableOpacity
                key={o.idx}
                testID={`${testPrefix}-${o.idx}`}
                onPress={() => onPick(o.idx)}
                style={[
                  styles.pickerRow,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.pickerRowText, { color: colors.textPrimary }]}>
                  {o.label}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function InningsBreakModal({
  visible,
  match,
  onStart,
  colors,
}: {
  visible: boolean;
  match: Match;
  onStart: (s: number, n: number, b: number) => void;
  colors: Palette;
}) {
  const insets = useSafeAreaInsets();
  const [striker, setStriker] = useState(0);
  const [nonStriker, setNonStriker] = useState(1);
  const [bowler, setBowler] = useState(0);

  const target = match.innings1.score + 1;
  const secondBattingIdx = (1 - match.firstBattingIdx) as 0 | 1;
  const battingTeam = match.teams[secondBattingIdx];
  const bowlingTeam = match.teams[match.firstBattingIdx];

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalBackdrop}>
        <View
          style={[
            styles.bottomSheet,
            { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 },
          ]}
        >
          <View style={styles.modalHandle} />
          <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
            Innings Break
          </Text>
          <View
            style={[
              styles.targetBox,
              { backgroundColor: colors.accentBlue + "22", borderColor: colors.accentBlue },
            ]}
          >
            <Text style={[styles.targetLabel, { color: colors.accentBlue }]}>TARGET</Text>
            <Text style={[styles.targetValue, { color: colors.textPrimary }]}>
              {target}
            </Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
              {battingTeam.name} need {target} from {match.oversTotal * 6} balls
            </Text>
          </View>

          <ScrollView style={{ maxHeight: 280 }}>
            <PickerSection
              label="Striker"
              players={battingTeam.players}
              value={striker}
              onSelect={(i) => {
                setStriker(i);
                if (i === nonStriker) setNonStriker((i + 1) % match.playersPerSide);
              }}
              colors={colors}
              testPrefix="break-striker"
              disabledIdx={nonStriker}
            />
            <PickerSection
              label="Non-Striker"
              players={battingTeam.players}
              value={nonStriker}
              onSelect={(i) => {
                setNonStriker(i);
                if (i === striker) setStriker((i + 1) % match.playersPerSide);
              }}
              colors={colors}
              testPrefix="break-nonstriker"
              disabledIdx={striker}
            />
            <PickerSection
              label="Opening Bowler"
              players={bowlingTeam.players}
              value={bowler}
              onSelect={setBowler}
              colors={colors}
              testPrefix="break-bowler"
            />
          </ScrollView>

          <TouchableOpacity
            testID="start-innings2-button"
            onPress={() => onStart(striker, nonStriker, bowler)}
            style={[styles.primaryBtn, { backgroundColor: colors.primary, marginTop: 12 }]}
          >
            <Text style={[styles.primaryBtnText, { color: colors.onPrimary }]}>
              Start 2nd Innings
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function PickerSection({
  label,
  players,
  value,
  onSelect,
  colors,
  testPrefix,
  disabledIdx,
}: {
  label: string;
  players: string[];
  value: number;
  onSelect: (i: number) => void;
  colors: Palette;
  testPrefix: string;
  disabledIdx?: number;
}) {
  return (
    <View style={{ marginTop: 14 }}>
      <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "700" }}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingTop: 8 }}
      >
        {players.map((p, idx) => {
          const active = value === idx;
          const disabled = disabledIdx === idx;
          return (
            <TouchableOpacity
              key={idx}
              testID={`${testPrefix}-${idx}`}
              disabled={disabled}
              onPress={() => onSelect(idx)}
              style={{
                height: 40,
                paddingHorizontal: 14,
                borderRadius: 999,
                borderWidth: 1,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: active ? colors.primary : colors.surface,
                borderColor: active ? colors.primary : colors.border,
                opacity: disabled ? 0.35 : 1,
                flexShrink: 0,
              }}
            >
              <Text
                style={{
                  color: active ? colors.onPrimary : colors.textPrimary,
                  fontWeight: "700",
                  fontSize: 13,
                }}
              >
                {p || `Player ${idx + 1}`}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ---- Styles ----

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  inningsLabel: { fontSize: 11, fontWeight: "900", letterSpacing: 1.5 },
  battingTeamName: { fontSize: 16, fontWeight: "800", marginTop: 2 },
  scoreRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: 8,
  },
  scoreMain: { fontSize: 60, fontWeight: "900", letterSpacing: -2, lineHeight: 60 },
  scoreWickets: { fontSize: 30, fontWeight: "800" },
  metaTopLine: { fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  metaTopValue: { fontSize: 16, fontWeight: "800" },
  metaSub: { fontSize: 12, fontWeight: "700" },
  chaseBanner: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  chaseText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  cardLabel: { fontSize: 11, fontWeight: "900", letterSpacing: 1.2 },
  cardLabelMini: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5, fontVariant: ["tabular-nums"] },
  batsmanRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
  },
  batsmanName: { fontSize: 15 },
  batsmanStats: { fontSize: 13, fontWeight: "700", fontVariant: ["tabular-nums"] },
  placeholder: { fontSize: 13 },
  padContainer: {
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 12,
    gap: 10,
  },
  extrasRow: {
    flexDirection: "row",
    gap: 8,
  },
  extraBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  extraText: { fontSize: 14, fontWeight: "800" },
  runsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  runBtn: {
    width: "31.5%",
    height: 62,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  runBtnText: { fontSize: 26 },
  wicketBtn: {
    height: 56,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  wicketText: { fontSize: 16, fontWeight: "900", letterSpacing: 2 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  bottomSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingHorizontal: 20,
    paddingBottom: 24,
    maxHeight: "88%",
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignSelf: "center",
    marginBottom: 12,
  },
  modalTitle: { fontSize: 22, fontWeight: "900" },
  modalSubtitle: { fontSize: 13, fontWeight: "600", marginTop: 4 },
  modalCard: {
    marginHorizontal: 28,
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
  },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  pickerRowText: { fontSize: 15, fontWeight: "700" },
  primaryBtn: {
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
  },
  primaryBtnText: { fontSize: 16, fontWeight: "800" },
  secondaryBtn: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  targetBox: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    alignItems: "center",
  },
  targetLabel: { fontSize: 12, fontWeight: "900", letterSpacing: 1.5 },
  targetValue: { fontSize: 48, fontWeight: "900", letterSpacing: -1, marginTop: 4 },
});
