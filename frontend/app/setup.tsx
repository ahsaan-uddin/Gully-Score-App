import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Switch,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/src/theme/ThemeContext";
import { DEFAULT_RULES, MatchRules, Team, WideMode } from "@/src/types/cricket";
import { createMatch } from "@/src/logic/cricket";
import { setCurrentMatchId, upsertMatch } from "@/src/storage/matches";
import {
  normalizeKey,
  SavedPlayer,
  suggestPlayers,
} from "@/src/storage/players_pool";
import { getSeries } from "@/src/storage/series";
import { Palette } from "@/src/theme/tokens";

const PLAYER_PRESETS = [5, 7, 10, 11];
const OVER_PRESETS = [2, 5, 10, 20];

function emptyTeam(name: string): Team {
  return { name, players: [], captainIdx: 0 };
}

export default function SetupScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ seriesId?: string }>();

  const [playersPerSide, setPlayersPerSide] = useState<number>(7);
  const [playersCustom, setPlayersCustom] = useState<string>("");
  const [overs, setOvers] = useState<number>(5);
  const [oversCustom, setOversCustom] = useState<string>("");

  const [teamA, setTeamA] = useState<Team>(emptyTeam("Team A"));
  const [teamB, setTeamB] = useState<Team>(emptyTeam("Team B"));

  const [tossWinnerIdx, setTossWinnerIdx] = useState<0 | 1>(0);
  const [tossDecision, setTossDecision] = useState<"bat" | "bowl">("bat");
  const [tossFlipMsg, setTossFlipMsg] = useState<string | null>(null);
  const [tossMode, setTossMode] = useState<"virtual" | "pitch">("virtual");

  const [rules, setRules] = useState<MatchRules>(DEFAULT_RULES);

  const [jokerName, setJokerName] = useState<string | null>(null);
  const [jokerPickerOpen, setJokerPickerOpen] = useState(false);

  const [openersModal, setOpenersModal] = useState(false);
  const [strikerIdx, setStrikerIdx] = useState<number>(0);
  const [nonStrikerIdx, setNonStrikerIdx] = useState<number>(1);
  const [bowlerIdx, setBowlerIdx] = useState<number>(0);

  const [seriesName, setSeriesName] = useState<string | null>(null);

  // Load series context (if any) and lock team names.
  useEffect(() => {
    (async () => {
      if (!params.seriesId) return;
      const s = await getSeries(params.seriesId);
      if (!s) return;
      setSeriesName(s.name);
      setTeamA((t) => ({ ...t, name: s.teamA }));
      setTeamB((t) => ({ ...t, name: s.teamB }));
    })();
  }, [params.seriesId]);

  // ---- Derived values ----
  const finalOvers = useMemo(() => {
    if (oversCustom) {
      const n = parseInt(oversCustom, 10);
      if (Number.isFinite(n) && n > 0 && n <= 50) return n;
    }
    return overs;
  }, [overs, oversCustom]);

  const firstBattingIdx: 0 | 1 =
    tossDecision === "bat" ? tossWinnerIdx : ((1 - tossWinnerIdx) as 0 | 1);
  const battingTeam = firstBattingIdx === 0 ? teamA : teamB;
  const bowlingTeam = firstBattingIdx === 0 ? teamB : teamA;

  const totalAdded = teamA.players.length + teamB.players.length;
  const allAddedNames = useMemo(
    () => [...teamA.players, ...teamB.players],
    [teamA.players, teamB.players],
  );
  const allAddedKeys = useMemo(
    () => new Set(allAddedNames.map(normalizeKey)),
    [allAddedNames],
  );
  const needJoker = totalAdded > 0 && totalAdded % 2 === 1;

  // Allow start once each team has enough to bowl & bat (2 batsmen / 1 batsman in single-batter, plus at least 1 bowler on the other side).
  const minBatPerTeam = rules.singleBatter ? 1 : 2;
  const aReady = teamA.players.length >= minBatPerTeam;
  const bReady = teamB.players.length >= minBatPerTeam;
  const teamAName = teamA.name.trim().length > 0;
  const teamBName = teamB.name.trim().length > 0;
  const canStart =
    teamAName && teamBName && aReady && bReady && (!needJoker || jokerName);

  // Friendly reason why Start is disabled.
  const missingReason: string | null = (() => {
    if (!teamAName) return "Add Team A name";
    if (!teamBName) return "Add Team B name";
    if (!aReady) return `Add ${minBatPerTeam - teamA.players.length} more player(s) to ${teamA.name}`;
    if (!bReady) return `Add ${minBatPerTeam - teamB.players.length} more player(s) to ${teamB.name}`;
    if (needJoker && !jokerName) return "Pick a Joker (odd number of players)";
    return null;
  })();

  // ---- Players handlers ----
  const addPlayerToTeam = useCallback(
    (whichIdx: 0 | 1, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return false;
      const key = normalizeKey(trimmed);
      if (allAddedKeys.has(key)) return false; // dedupe across both teams
      const setter = whichIdx === 0 ? setTeamA : setTeamB;
      setter((t) => {
        if (t.players.length >= playersPerSide) return t;
        return { ...t, players: [...t.players, trimmed] };
      });
      return true;
    },
    [allAddedKeys, playersPerSide],
  );

  const removePlayerFromTeam = (whichIdx: 0 | 1, playerIdx: number) => {
    const setter = whichIdx === 0 ? setTeamA : setTeamB;
    setter((t) => {
      const players = t.players.filter((_, i) => i !== playerIdx);
      const captainIdx =
        t.captainIdx >= players.length ? Math.max(0, players.length - 1) : t.captainIdx;
      return { ...t, players, captainIdx };
    });
  };

  const setCaptain = (whichIdx: 0 | 1, playerIdx: number) => {
    const setter = whichIdx === 0 ? setTeamA : setTeamB;
    setter((t) => ({ ...t, captainIdx: playerIdx }));
  };

  const autoSplitTeams = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const all = [...teamA.players, ...teamB.players];
    if (all.length < 2) return;
    // Fisher–Yates shuffle.
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    const half = Math.ceil(all.length / 2);
    const a = all.slice(0, half).slice(0, playersPerSide);
    const b = all.slice(half).slice(0, playersPerSide);
    setTeamA((t) => ({ ...t, players: a, captainIdx: 0 }));
    setTeamB((t) => ({ ...t, players: b, captainIdx: 0 }));
    setJokerName(null);
  };

  const pickRandomJoker = () => {
    Haptics.selectionAsync().catch(() => {});
    const all = allAddedNames;
    if (all.length === 0) return;
    const pick = all[Math.floor(Math.random() * all.length)];
    setJokerName(pick);
  };

  const onStartTap = () => {
    if (!canStart) return;
    setStrikerIdx(0);
    setNonStrikerIdx(rules.singleBatter ? 0 : 1 % playersPerSide);
    setBowlerIdx(0);
    setOpenersModal(true);
  };

  const onConfirmOpeners = async () => {
    const match = createMatch({
      teams: [teamA, teamB],
      oversTotal: finalOvers,
      playersPerSide,
      tossWinnerIdx,
      tossDecision,
      strikerIdx,
      nonStrikerIdx: rules.singleBatter ? strikerIdx : nonStrikerIdx,
      bowlerIdx,
      rules,
      jokerPlayerName: jokerName ?? undefined,
      seriesId: params.seriesId ?? undefined,
    });
    await upsertMatch(match);
    await setCurrentMatchId(match.id);
    setOpenersModal(false);
    router.replace("/live");
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
          testID="setup-back-button"
        >
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={{ alignItems: "center" }}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            {seriesName ? "Series Match" : "New Match"}
          </Text>
          {seriesName && (
            <Text style={[styles.headerSub, { color: colors.primary }]} numberOfLines={1}>
              {seriesName}
            </Text>
          )}
        </View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 120 }}
      >
        {/* Format */}
        <Section title="Format" colors={colors}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Players per side</Text>
          <ChipRow
            options={PLAYER_PRESETS.map((n) => ({ value: n, label: `${n}` }))}
            value={playersCustom ? -1 : playersPerSide}
            onSelect={(v) => {
              setPlayersPerSide(v as number);
              setPlayersCustom("");
            }}
            testIDPrefix="players-chip"
            colors={colors}
          />
          <TextInput
            value={playersCustom}
            onChangeText={(t) => {
              const cleaned = t.replace(/[^0-9]/g, "").slice(0, 2);
              setPlayersCustom(cleaned);
              const n = parseInt(cleaned, 10);
              if (Number.isFinite(n) && n >= 2 && n <= 22) setPlayersPerSide(n);
            }}
            placeholder="Custom players (2 – 22)"
            keyboardType="number-pad"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary, marginTop: 12 }]}
            testID="players-custom-input"
          />

          <Text style={[styles.label, { color: colors.textSecondary, marginTop: 16 }]}>Overs</Text>
          <ChipRow
            options={OVER_PRESETS.map((n) => ({ value: n, label: `${n}` }))}
            value={oversCustom ? -1 : overs}
            onSelect={(v) => {
              setOvers(v as number);
              setOversCustom("");
            }}
            testIDPrefix="overs-chip"
            colors={colors}
          />
          <TextInput
            value={oversCustom}
            onChangeText={(t) => setOversCustom(t.replace(/[^0-9]/g, "").slice(0, 2))}
            placeholder="Custom overs (1 – 50)"
            keyboardType="number-pad"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary, marginTop: 12 }]}
            testID="overs-custom-input"
          />
        </Section>

        {/* Team A */}
        <TeamCard
          colors={colors}
          team={teamA}
          teamIdx={0}
          playersPerSide={playersPerSide}
          excludeKeys={allAddedKeys}
          onRenameTeam={(name) => setTeamA((t) => ({ ...t, name }))}
          onAddPlayer={(n) => addPlayerToTeam(0, n)}
          onRemovePlayer={(idx) => removePlayerFromTeam(0, idx)}
          onSetCaptain={(idx) => setCaptain(0, idx)}
          testPrefix="team-a"
          locked={!!seriesName}
        />

        {/* Team B */}
        <TeamCard
          colors={colors}
          team={teamB}
          teamIdx={1}
          playersPerSide={playersPerSide}
          excludeKeys={allAddedKeys}
          onRenameTeam={(name) => setTeamB((t) => ({ ...t, name }))}
          onAddPlayer={(n) => addPlayerToTeam(1, n)}
          onRemovePlayer={(idx) => removePlayerFromTeam(1, idx)}
          onSetCaptain={(idx) => setCaptain(1, idx)}
          testPrefix="team-b"
          locked={!!seriesName}
        />

        {/* Auto-split */}
        {totalAdded >= 2 && (
          <TouchableOpacity
            testID="auto-split-button"
            activeOpacity={0.85}
            onPress={autoSplitTeams}
            style={[styles.utilBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
          >
            <Ionicons name="shuffle" size={18} color={colors.primary} />
            <Text style={[styles.utilBtnText, { color: colors.textPrimary }]}>
              Auto-split players into 2 teams
            </Text>
          </TouchableOpacity>
        )}

        {/* Joker */}
        {needJoker && (
          <View
            testID="joker-section"
            style={[styles.jokerCard, { borderColor: colors.warning, backgroundColor: colors.warningMuted }]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Ionicons name="happy-outline" size={22} color={colors.warning} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.jokerTitle, { color: colors.warning }]}>Joker needed</Text>
                <Text style={[styles.jokerDesc, { color: colors.textSecondary }]}>
                  Odd number of players ({totalAdded}). One player will play for both teams.
                </Text>
              </View>
            </View>
            {jokerName ? (
              <View style={[styles.jokerPickedRow, { borderColor: colors.warning }]}>
                <Ionicons name="checkmark-circle" size={18} color={colors.warning} />
                <Text style={[styles.jokerPickedName, { color: colors.textPrimary }]}>
                  Joker: <Text style={{ fontWeight: "900" }}>{jokerName}</Text>
                </Text>
                <TouchableOpacity testID="joker-clear" onPress={() => setJokerName(null)}>
                  <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            ) : null}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
              <TouchableOpacity
                testID="joker-pick-button"
                onPress={() => setJokerPickerOpen(true)}
                style={[styles.jokerBtn, { backgroundColor: colors.surface, borderColor: colors.warning }]}
              >
                <Ionicons name="person-outline" size={16} color={colors.warning} />
                <Text style={[styles.jokerBtnText, { color: colors.warning }]}>Pick Joker</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="joker-random-button"
                onPress={pickRandomJoker}
                style={[styles.jokerBtn, { backgroundColor: colors.warning, borderColor: colors.warning }]}
              >
                <Ionicons name="dice-outline" size={16} color="#fff" />
                <Text style={[styles.jokerBtnText, { color: "#fff" }]}>Random Joker</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Match Rules */}
        <Section title="Match Rules" colors={colors}>
          <RuleRow
            colors={colors}
            label="Single Batter Mode"
            sub="One batter at a time, no strike rotation"
            value={rules.singleBatter}
            onChange={(v) => setRules((r) => ({ ...r, singleBatter: v }))}
            testID="rule-single-batter"
          />
          <RuleSegmented
            colors={colors}
            label="Wide Ball"
            value={rules.wideMode}
            options={[
              { id: "run_and_reball", label: "1 run + reball" },
              { id: "reball_only", label: "Reball only" },
            ]}
            onChange={(v) => setRules((r) => ({ ...r, wideMode: v as WideMode }))}
            testPrefix="rule-wide"
          />
          <RuleRow
            colors={colors}
            label="Free Hit on No Ball"
            sub="Next ball is a free hit (no wicket allowed)"
            value={rules.freeHit}
            onChange={(v) => setRules((r) => ({ ...r, freeHit: v }))}
            testID="rule-free-hit"
          />
          <RuleRow
            colors={colors}
            label="Allow Byes"
            value={rules.allowByes}
            onChange={(v) => setRules((r) => ({ ...r, allowByes: v }))}
            testID="rule-byes"
          />
          <RuleRow
            colors={colors}
            label="Allow Leg Byes"
            value={rules.allowLegByes}
            onChange={(v) => setRules((r) => ({ ...r, allowLegByes: v }))}
            testID="rule-leg-byes"
          />
        </Section>

        {/* Toss */}
        <Section title="Toss" colors={colors}>
          <View style={[styles.segmented, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {([
              { id: "virtual" as const, label: "Virtual Toss", icon: "ellipse-outline" as const },
              { id: "pitch" as const, label: "Pitch Toss", icon: "people-outline" as const },
            ]).map((m) => {
              const active = tossMode === m.id;
              return (
                <TouchableOpacity
                  key={m.id}
                  testID={`toss-mode-${m.id}`}
                  onPress={() => { setTossMode(m.id); setTossFlipMsg(null); }}
                  style={[styles.segmentedItem, { backgroundColor: active ? colors.primary : "transparent" }]}
                >
                  <Ionicons name={m.icon} size={16} color={active ? colors.onPrimary : colors.textSecondary} />
                  <Text style={[styles.segmentedText, { color: active ? colors.onPrimary : colors.textSecondary }]}>{m.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {tossMode === "virtual" ? (
            <>
              <TouchableOpacity
                testID="coin-flip-button"
                activeOpacity={0.85}
                onPress={() => {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                  const winner = (Math.random() < 0.5 ? 0 : 1) as 0 | 1;
                  setTossWinnerIdx(winner);
                  const teamName = winner === 0 ? (teamA.name.trim() || "Team A") : (teamB.name.trim() || "Team B");
                  setTossFlipMsg(`${teamName} won the toss`);
                }}
                style={[styles.coinBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, marginTop: 12 }]}
              >
                <Ionicons name="ellipse" size={20} color={colors.warning} />
                <Text style={[styles.coinBtnText, { color: colors.textPrimary }]}>Flip Coin</Text>
              </TouchableOpacity>
              {tossFlipMsg && (
                <View testID="coin-flip-result" style={[styles.coinResult, { backgroundColor: colors.primaryMuted, borderColor: colors.primary }]}>
                  <Text style={[styles.coinResultText, { color: colors.primary }]}>{tossFlipMsg}</Text>
                </View>
              )}
            </>
          ) : (
            <Text testID="pitch-toss-hint" style={[styles.pitchHint, { color: colors.textMuted }]}>
              Flipped a coin on the ground? Just tap the team that won below.
            </Text>
          )}

          <Text style={[styles.label, { color: colors.textSecondary, marginTop: 14 }]}>Won by</Text>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
            {[teamA.name, teamB.name].map((name, idx) => (
              <TouchableOpacity
                key={idx}
                testID={`toss-winner-${idx}`}
                onPress={() => { setTossWinnerIdx(idx as 0 | 1); setTossFlipMsg(null); }}
                style={[styles.bigPill, { backgroundColor: tossWinnerIdx === idx ? colors.primary : colors.surface, borderColor: tossWinnerIdx === idx ? colors.primary : colors.border }]}
              >
                <Text style={[styles.bigPillText, { color: tossWinnerIdx === idx ? colors.onPrimary : colors.textPrimary }]} numberOfLines={1}>
                  {name || `Team ${idx === 0 ? "A" : "B"}`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { color: colors.textSecondary, marginTop: 16 }]}>Chose to</Text>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
            {(["bat", "bowl"] as const).map((d) => (
              <TouchableOpacity
                key={d}
                testID={`toss-decision-${d}`}
                onPress={() => setTossDecision(d)}
                style={[styles.bigPill, { backgroundColor: tossDecision === d ? colors.primary : colors.surface, borderColor: tossDecision === d ? colors.primary : colors.border }]}
              >
                <Ionicons name={d === "bat" ? "tennisball-outline" : "hand-right-outline"} size={18} color={tossDecision === d ? colors.onPrimary : colors.textPrimary} />
                <Text style={[styles.bigPillText, { color: tossDecision === d ? colors.onPrimary : colors.textPrimary }]}>
                  {d === "bat" ? "Bat First" : "Bowl First"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Section>
      </ScrollView>

      {/* Sticky CTA */}
      <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: insets.bottom + 12 }]}>
        {missingReason && (
          <Text testID="start-disabled-reason" style={[styles.missingHint, { color: colors.textMuted }]}>
            {missingReason}
          </Text>
        )}
        <TouchableOpacity
          testID="start-match-button"
          disabled={!canStart}
          onPress={onStartTap}
          activeOpacity={0.9}
          style={[styles.startBtn, { backgroundColor: canStart ? colors.primary : colors.surfaceElevated }]}
        >
          <Ionicons name="play-circle" size={22} color={canStart ? colors.onPrimary : colors.textMuted} />
          <Text style={[styles.startBtnText, { color: canStart ? colors.onPrimary : colors.textMuted }]}>
            Start Match
          </Text>
        </TouchableOpacity>
      </View>

      {/* Openers Modal */}
      <Modal visible={openersModal} transparent animationType="slide" onRequestClose={() => setOpenersModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Opening Players</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
              {battingTeam.name} batting vs {bowlingTeam.name}
            </Text>

            <ScrollView style={{ maxHeight: 360 }}>
              <PickerSection
                label="Striker"
                players={battingTeam.players}
                value={strikerIdx}
                onSelect={(i) => {
                  setStrikerIdx(i);
                  if (!rules.singleBatter && i === nonStrikerIdx) setNonStrikerIdx((i + 1) % playersPerSide);
                }}
                colors={colors}
                testPrefix="striker"
                disabledIdx={rules.singleBatter ? undefined : nonStrikerIdx}
              />
              {!rules.singleBatter && (
                <PickerSection
                  label="Non-Striker"
                  players={battingTeam.players}
                  value={nonStrikerIdx}
                  onSelect={(i) => {
                    setNonStrikerIdx(i);
                    if (i === strikerIdx) setStrikerIdx((i + 1) % playersPerSide);
                  }}
                  colors={colors}
                  testPrefix="nonstriker"
                  disabledIdx={strikerIdx}
                />
              )}
              <PickerSection
                label="Opening Bowler"
                players={bowlingTeam.players}
                value={bowlerIdx}
                onSelect={setBowlerIdx}
                colors={colors}
                testPrefix="bowler"
              />
            </ScrollView>

            <TouchableOpacity
              testID="confirm-openers-button"
              onPress={onConfirmOpeners}
              style={[styles.startBtn, { backgroundColor: colors.primary, marginTop: 16 }]}
              activeOpacity={0.9}
            >
              <Text style={[styles.startBtnText, { color: colors.onPrimary }]}>Start Scoring</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Joker picker */}
      <Modal visible={jokerPickerOpen} transparent animationType="slide" onRequestClose={() => setJokerPickerOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Pick Joker</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
              Joker plays for both teams. Choose any added player.
            </Text>
            <ScrollView style={{ maxHeight: 360, marginTop: 14 }} contentContainerStyle={{ gap: 8, paddingBottom: 8 }}>
              {allAddedNames.map((n, idx) => (
                <TouchableOpacity
                  key={`${n}-${idx}`}
                  testID={`joker-pick-${idx}`}
                  onPress={() => { setJokerName(n); setJokerPickerOpen(false); }}
                  style={[styles.pickerRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <Text style={{ color: colors.textPrimary, fontWeight: "700", fontSize: 15 }}>{n}</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ---- Subcomponents ----

interface ColorsProp { colors: Palette; }

function Section({ title, colors, children }: ColorsProp & { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 18 }}>
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{title}</Text>
      <View style={{ marginTop: 8 }}>{children}</View>
    </View>
  );
}

function ChipRow<T extends string | number>({
  options, value, onSelect, testIDPrefix, colors,
}: ColorsProp & {
  options: { value: T; label: string }[];
  value: T | null;
  onSelect: (v: T) => void;
  testIDPrefix: string;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
      {options.map((o) => {
        const active = value === o.value;
        return (
          <TouchableOpacity
            key={String(o.value)}
            testID={`${testIDPrefix}-${o.value}`}
            onPress={() => onSelect(o.value)}
            style={{
              height: 40, minWidth: 56, paddingHorizontal: 16, borderRadius: 999,
              borderWidth: 1, alignItems: "center", justifyContent: "center",
              backgroundColor: active ? colors.primary : colors.surface,
              borderColor: active ? colors.primary : colors.border,
              flexShrink: 0,
            }}
          >
            <Text style={{ color: active ? colors.onPrimary : colors.textPrimary, fontWeight: "800", fontSize: 14 }}>
              {o.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function TeamCard({
  colors, team, teamIdx, playersPerSide, excludeKeys,
  onRenameTeam, onAddPlayer, onRemovePlayer, onSetCaptain,
  testPrefix, locked,
}: ColorsProp & {
  team: Team;
  teamIdx: 0 | 1;
  playersPerSide: number;
  excludeKeys: Set<string>;
  onRenameTeam: (name: string) => void;
  onAddPlayer: (name: string) => boolean;
  onRemovePlayer: (idx: number) => void;
  onSetCaptain: (idx: number) => void;
  testPrefix: string;
  locked?: boolean;
}) {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState<SavedPlayer[]>([]);

  const refreshSuggestions = useCallback(async () => {
    const list = await suggestPlayers(input, excludeKeys, 16);
    setSuggestions(list);
  }, [input, excludeKeys]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await suggestPlayers(input, excludeKeys, 16);
      if (!cancelled) setSuggestions(list);
    })();
    return () => { cancelled = true; };
  }, [input, excludeKeys]);

  const teamFull = team.players.length >= playersPerSide;

  const submitInput = () => {
    if (!input.trim()) return;
    if (onAddPlayer(input)) {
      setInput("");
      Haptics.selectionAsync().catch(() => {});
      refreshSuggestions();
    }
  };

  return (
    <Section title={team.name || `Team ${teamIdx === 0 ? "A" : "B"}`} colors={colors}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>Team Name</Text>
      <TextInput
        value={team.name}
        onChangeText={onRenameTeam}
        editable={!locked}
        placeholder={teamIdx === 0 ? "e.g., Mohalla XI" : "e.g., Galli Tigers"}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, {
          backgroundColor: colors.surface, borderColor: colors.border,
          color: locked ? colors.textMuted : colors.textPrimary, marginTop: 6,
        }]}
        testID={`${testPrefix}-name-input`}
      />

      <View style={styles.addRow}>
        <TextInput
          value={input}
          onChangeText={setInput}
          onSubmitEditing={submitInput}
          returnKeyType="done"
          placeholder={teamFull ? `${team.name || "Team"} is full` : "Add player name"}
          editable={!teamFull}
          placeholderTextColor={colors.textMuted}
          style={[
            styles.addInput,
            { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary },
          ]}
          testID={`${testPrefix}-add-input`}
        />
        <TouchableOpacity
          testID={`${testPrefix}-add-button`}
          onPress={submitInput}
          disabled={teamFull || !input.trim()}
          style={[
            styles.addBtn,
            {
              backgroundColor: !teamFull && input.trim() ? colors.primary : colors.surfaceElevated,
              borderColor: !teamFull && input.trim() ? colors.primary : colors.border,
            },
          ]}
        >
          <Ionicons name="add" size={22} color={!teamFull && input.trim() ? colors.onPrimary : colors.textMuted} />
        </TouchableOpacity>
      </View>

      <Text style={[styles.counter, { color: colors.textMuted }]}>
        {team.players.length} / {playersPerSide} added
      </Text>

      {/* Suggestion chips */}
      {!teamFull && suggestions.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingVertical: 6 }}
          keyboardShouldPersistTaps="handled"
        >
          {suggestions.map((s) => (
            <TouchableOpacity
              key={s.key}
              testID={`${testPrefix}-suggest-${s.key}`}
              onPress={() => {
                if (onAddPlayer(s.name)) {
                  Haptics.selectionAsync().catch(() => {});
                  setInput("");
                }
              }}
              activeOpacity={0.8}
              style={[styles.suggestChip, { backgroundColor: colors.primaryMuted, borderColor: colors.primary }]}
            >
              <Ionicons name="add-circle-outline" size={14} color={colors.primary} />
              <Text style={[styles.suggestText, { color: colors.primary }]}>{s.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Added players */}
      <View style={{ gap: 8, marginTop: 10 }}>
        {team.players.map((p, idx) => (
          <View
            key={`${p}-${idx}`}
            style={[styles.playerRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={[styles.playerIdx, { color: colors.textMuted }]}>{idx + 1}.</Text>
            <Text
              style={[styles.playerName, { color: colors.textPrimary }]}
              numberOfLines={1}
              testID={`${testPrefix}-player-${idx}`}
            >
              {p}
            </Text>
            <TouchableOpacity
              onPress={() => onSetCaptain(idx)}
              testID={`${testPrefix}-captain-${idx}`}
              style={[styles.captainBadge, {
                backgroundColor: team.captainIdx === idx ? colors.warningMuted : "transparent",
                borderColor: team.captainIdx === idx ? colors.warning : colors.border,
              }]}
            >
              <Text style={{ color: team.captainIdx === idx ? colors.warning : colors.textMuted, fontWeight: "800", fontSize: 12 }}>C</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onRemovePlayer(idx)}
              testID={`${testPrefix}-remove-${idx}`}
              hitSlop={10}
            >
              <Ionicons name="close-circle" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </Section>
  );
}

function RuleRow({
  colors, label, sub, value, onChange, testID,
}: ColorsProp & {
  label: string; sub?: string; value: boolean;
  onChange: (v: boolean) => void; testID: string;
}) {
  return (
    <View style={[styles.ruleRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={[styles.ruleLabel, { color: colors.textPrimary }]}>{label}</Text>
        {sub && <Text style={[styles.ruleSub, { color: colors.textSecondary }]}>{sub}</Text>}
      </View>
      <Switch
        testID={testID}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.surfaceElevated, true: colors.primary }}
        thumbColor="#fff"
      />
    </View>
  );
}

function RuleSegmented({
  colors, label, value, options, onChange, testPrefix,
}: ColorsProp & {
  label: string; value: string;
  options: { id: string; label: string }[];
  onChange: (v: string) => void; testPrefix: string;
}) {
  return (
    <View style={[styles.ruleRow, { backgroundColor: colors.surface, borderColor: colors.border, alignItems: "stretch" }]}>
      <Text style={[styles.ruleLabel, { color: colors.textPrimary, marginBottom: 8 }]}>{label}</Text>
      <View style={[styles.segmented, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, marginTop: 4 }]}>
        {options.map((o) => {
          const active = value === o.id;
          return (
            <TouchableOpacity
              key={o.id}
              testID={`${testPrefix}-${o.id}`}
              onPress={() => onChange(o.id)}
              style={[styles.segmentedItem, { backgroundColor: active ? colors.primary : "transparent" }]}
            >
              <Text style={[styles.segmentedText, { color: active ? colors.onPrimary : colors.textSecondary }]}>{o.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function PickerSection({
  label, players, value, onSelect, colors, testPrefix, disabledIdx,
}: ColorsProp & {
  label: string; players: string[]; value: number;
  onSelect: (i: number) => void; testPrefix: string; disabledIdx?: number;
}) {
  return (
    <View style={{ marginTop: 14 }}>
      <Text style={{ color: colors.textSecondary, fontSize: 13, fontWeight: "700" }}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 8 }}>
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
                height: 40, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1,
                alignItems: "center", justifyContent: "center",
                backgroundColor: active ? colors.primary : colors.surface,
                borderColor: active ? colors.primary : colors.border,
                opacity: disabled ? 0.35 : 1, flexShrink: 0,
              }}
            >
              <Text style={{ color: active ? colors.onPrimary : colors.textPrimary, fontWeight: "700", fontSize: 13 }}>
                {p || `Player ${idx + 1}`}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 12,
  },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: "800" },
  headerSub: { fontSize: 12, fontWeight: "700", marginTop: 2 },
  sectionTitle: { fontSize: 18, fontWeight: "800" },
  label: { fontSize: 13, fontWeight: "700", letterSpacing: 0.3 },
  input: { height: 50, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, fontSize: 15, fontWeight: "600" },
  addRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  addInput: { flex: 1, height: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, fontSize: 14, fontWeight: "600" },
  addBtn: { width: 48, height: 48, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  counter: { fontSize: 12, fontWeight: "700", marginTop: 6 },
  suggestChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 12, height: 34, borderRadius: 999, borderWidth: 1, flexShrink: 0,
  },
  suggestText: { fontSize: 13, fontWeight: "700" },
  playerRow: {
    flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 10, gap: 8,
  },
  playerIdx: { fontSize: 13, fontWeight: "700", width: 22 },
  playerName: { flex: 1, fontSize: 15, fontWeight: "700" },
  captainBadge: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  utilBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    height: 50, borderRadius: 14, borderWidth: 1, marginTop: 16,
  },
  utilBtnText: { fontSize: 14, fontWeight: "800" },
  jokerCard: {
    borderWidth: 1, borderRadius: 16, padding: 14, marginTop: 16, gap: 8,
  },
  jokerTitle: { fontSize: 15, fontWeight: "900", letterSpacing: 0.3 },
  jokerDesc: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  jokerBtn: {
    flex: 1, height: 44, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, borderRadius: 12, borderWidth: 1,
  },
  jokerBtnText: { fontSize: 13, fontWeight: "800" },
  jokerPickedRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, marginTop: 4,
  },
  jokerPickedName: { flex: 1, fontSize: 13, fontWeight: "700" },
  ruleRow: {
    flexDirection: "row", alignItems: "center", borderRadius: 12, borderWidth: 1,
    padding: 12, marginTop: 8,
  },
  ruleLabel: { fontSize: 14, fontWeight: "800" },
  ruleSub: { fontSize: 12, fontWeight: "500", marginTop: 2 },
  segmented: {
    flexDirection: "row", borderRadius: 12, borderWidth: 1, padding: 4, gap: 4,
  },
  segmentedItem: {
    flex: 1, height: 38, borderRadius: 8, flexDirection: "row",
    alignItems: "center", justifyContent: "center", gap: 6,
  },
  segmentedText: { fontSize: 12, fontWeight: "800" },
  coinBtn: {
    height: 52, borderRadius: 14, borderWidth: 1, flexDirection: "row",
    alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 14,
  },
  coinBtnText: { fontSize: 15, fontWeight: "800" },
  coinResult: { marginTop: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  coinResultText: { fontSize: 14, fontWeight: "800" },
  pitchHint: { fontSize: 13, fontWeight: "600", marginTop: 12, paddingHorizontal: 4 },
  bigPill: {
    flex: 1, height: 52, borderRadius: 14, borderWidth: 1, flexDirection: "row",
    alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 12,
  },
  bigPillText: { fontSize: 15, fontWeight: "800" },
  footer: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    paddingTop: 12, paddingHorizontal: 20, borderTopWidth: 1,
  },
  startBtn: {
    height: 56, borderRadius: 16, flexDirection: "row",
    alignItems: "center", justifyContent: "center", gap: 8,
  },
  startBtnText: { fontSize: 17, fontWeight: "800", letterSpacing: 0.3 },
  missingHint: { fontSize: 12, fontWeight: "700", textAlign: "center", marginBottom: 8 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  modalSheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "88%",
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.15)",
    alignSelf: "center", marginBottom: 12,
  },
  modalTitle: { fontSize: 22, fontWeight: "900", letterSpacing: -0.4 },
  modalSubtitle: { fontSize: 13, fontWeight: "600", marginTop: 4 },
  pickerRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 14,
  },
});
