import React, { useMemo, useState } from "react";
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
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { useTheme } from "@/src/theme/ThemeContext";
import { Team } from "@/src/types/cricket";
import { createMatch } from "@/src/logic/cricket";
import { setCurrentMatchId, upsertMatch } from "@/src/storage/matches";

const PLAYER_PRESETS = [5, 7, 10, 11];
const OVER_PRESETS = [2, 5, 10, 20];

function emptyTeam(name: string): Team {
  return { name, players: [], captainIdx: 0 };
}

export default function SetupScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [playersPerSide, setPlayersPerSide] = useState<number>(7);
  const [playersCustom, setPlayersCustom] = useState<string>("");
  const [overs, setOvers] = useState<number>(5);
  const [oversCustom, setOversCustom] = useState<string>("");

  const [teamA, setTeamA] = useState<Team>(emptyTeam("Mohalla XI"));
  const [teamB, setTeamB] = useState<Team>(emptyTeam("Galli Tigers"));

  const [tossWinnerIdx, setTossWinnerIdx] = useState<0 | 1>(0);
  const [tossDecision, setTossDecision] = useState<"bat" | "bowl">("bat");
  const [tossFlipMsg, setTossFlipMsg] = useState<string | null>(null);

  const [openersModal, setOpenersModal] = useState(false);
  const [strikerIdx, setStrikerIdx] = useState<number>(0);
  const [nonStrikerIdx, setNonStrikerIdx] = useState<number>(1);
  const [bowlerIdx, setBowlerIdx] = useState<number>(0);

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

  const updatePlayerName = (which: "A" | "B", idx: number, name: string) => {
    if (which === "A") {
      const players = [...teamA.players];
      players[idx] = name;
      setTeamA({ ...teamA, players });
    } else {
      const players = [...teamB.players];
      players[idx] = name;
      setTeamB({ ...teamB, players });
    }
  };

  const ensurePlayerArrayLength = (t: Team): Team => {
    const players = [...t.players];
    while (players.length < playersPerSide) players.push("");
    players.length = playersPerSide;
    return { ...t, players, captainIdx: Math.min(t.captainIdx, playersPerSide - 1) };
  };

  const teamAReady = ensurePlayerArrayLength(teamA);
  const teamBReady = ensurePlayerArrayLength(teamB);

  const playersFilled = (t: Team): boolean =>
    t.players.length >= playersPerSide &&
    t.players.slice(0, playersPerSide).every((p) => p.trim().length > 0);

  const canStart =
    teamA.name.trim().length > 0 &&
    teamB.name.trim().length > 0 &&
    playersFilled(teamAReady) &&
    playersFilled(teamBReady);

  const onStartTap = () => {
    if (!canStart) return;
    // default openers
    setStrikerIdx(0);
    setNonStrikerIdx(1 % playersPerSide);
    setBowlerIdx(0);
    setOpenersModal(true);
  };

  const onConfirmOpeners = async () => {
    const match = createMatch({
      teams: [teamAReady, teamBReady],
      oversTotal: finalOvers,
      playersPerSide,
      tossWinnerIdx,
      tossDecision,
      strikerIdx,
      nonStrikerIdx,
      bowlerIdx,
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
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          New Match
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 120,
        }}
      >
        {/* Format */}
        <Section title="Format" colors={colors}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Players per side
          </Text>
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
              if (Number.isFinite(n) && n >= 2 && n <= 22) {
                setPlayersPerSide(n);
              }
            }}
            placeholder="Custom players (2 – 22)"
            keyboardType="number-pad"
            placeholderTextColor={colors.textMuted}
            style={[
              styles.input,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: colors.textPrimary,
                marginTop: 12,
              },
            ]}
            testID="players-custom-input"
          />

          <Text style={[styles.label, { color: colors.textSecondary, marginTop: 16 }]}>
            Overs
          </Text>
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
            placeholder="Custom (e.g., 8)"
            keyboardType="number-pad"
            placeholderTextColor={colors.textMuted}
            style={[
              styles.input,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: colors.textPrimary,
                marginTop: 12,
              },
            ]}
            testID="overs-custom-input"
          />
        </Section>

        {/* Teams */}
        <Section title="Team A" colors={colors}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Team Name
          </Text>
          <TextInput
            value={teamA.name}
            onChangeText={(name) => setTeamA({ ...teamA, name })}
            placeholder="e.g., Mohalla XI"
            placeholderTextColor={colors.textMuted}
            style={[
              styles.input,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: colors.textPrimary,
                marginTop: 6,
              },
            ]}
            testID="team-a-name-input"
          />
          <PlayerList
            team={teamAReady}
            count={playersPerSide}
            onChange={(idx, name) => updatePlayerName("A", idx, name)}
            onSelectCaptain={(idx) => setTeamA({ ...teamAReady, captainIdx: idx })}
            colors={colors}
            testPrefix="team-a"
          />
        </Section>

        <Section title="Team B" colors={colors}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            Team Name
          </Text>
          <TextInput
            value={teamB.name}
            onChangeText={(name) => setTeamB({ ...teamB, name })}
            placeholder="e.g., Galli Tigers"
            placeholderTextColor={colors.textMuted}
            style={[
              styles.input,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                color: colors.textPrimary,
                marginTop: 6,
              },
            ]}
            testID="team-b-name-input"
          />
          <PlayerList
            team={teamBReady}
            count={playersPerSide}
            onChange={(idx, name) => updatePlayerName("B", idx, name)}
            onSelectCaptain={(idx) => setTeamB({ ...teamBReady, captainIdx: idx })}
            colors={colors}
            testPrefix="team-b"
          />
        </Section>

        {/* Toss */}
        <Section title="Toss" colors={colors}>
          {/* Virtual coin flip */}
          <TouchableOpacity
            testID="coin-flip-button"
            activeOpacity={0.85}
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              const winner = (Math.random() < 0.5 ? 0 : 1) as 0 | 1;
              setTossWinnerIdx(winner);
              const teamName =
                winner === 0
                  ? (teamA.name.trim() || "Team A")
                  : (teamB.name.trim() || "Team B");
              setTossFlipMsg(`${teamName} won the toss`);
            }}
            style={[
              styles.coinBtn,
              { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
            ]}
          >
            <Ionicons name="ellipse" size={20} color={colors.warning} />
            <Text style={[styles.coinBtnText, { color: colors.textPrimary }]}>
              Flip Coin (Virtual)
            </Text>
          </TouchableOpacity>
          {tossFlipMsg && (
            <View
              testID="coin-flip-result"
              style={[
                styles.coinResult,
                { backgroundColor: colors.primaryMuted, borderColor: colors.primary },
              ]}
            >
              <Text style={[styles.coinResultText, { color: colors.primary }]}>
                {tossFlipMsg}
              </Text>
            </View>
          )}

          <Text style={[styles.label, { color: colors.textSecondary, marginTop: 14 }]}>
            Won by
          </Text>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
            {[teamA.name, teamB.name].map((name, idx) => (
              <TouchableOpacity
                key={idx}
                testID={`toss-winner-${idx}`}
                onPress={() => {
                  setTossWinnerIdx(idx as 0 | 1);
                  setTossFlipMsg(null);
                }}
                style={[
                  styles.bigPill,
                  {
                    backgroundColor:
                      tossWinnerIdx === idx ? colors.primary : colors.surface,
                    borderColor:
                      tossWinnerIdx === idx ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.bigPillText,
                    {
                      color:
                        tossWinnerIdx === idx
                          ? colors.onPrimary
                          : colors.textPrimary,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {name || `Team ${idx === 0 ? "A" : "B"}`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { color: colors.textSecondary, marginTop: 16 }]}>
            Chose to
          </Text>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
            {(["bat", "bowl"] as const).map((d) => (
              <TouchableOpacity
                key={d}
                testID={`toss-decision-${d}`}
                onPress={() => setTossDecision(d)}
                style={[
                  styles.bigPill,
                  {
                    backgroundColor:
                      tossDecision === d ? colors.primary : colors.surface,
                    borderColor:
                      tossDecision === d ? colors.primary : colors.border,
                  },
                ]}
              >
                <Ionicons
                  name={d === "bat" ? "tennisball-outline" : "hand-right-outline"}
                  size={18}
                  color={tossDecision === d ? colors.onPrimary : colors.textPrimary}
                />
                <Text
                  style={[
                    styles.bigPillText,
                    {
                      color:
                        tossDecision === d
                          ? colors.onPrimary
                          : colors.textPrimary,
                    },
                  ]}
                >
                  {d === "bat" ? "Bat First" : "Bowl First"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Section>
      </ScrollView>

      {/* Sticky CTA */}
      <View
        style={[
          styles.footer,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            paddingBottom: insets.bottom + 12,
          },
        ]}
      >
        <TouchableOpacity
          testID="start-match-button"
          disabled={!canStart}
          onPress={onStartTap}
          activeOpacity={0.9}
          style={[
            styles.startBtn,
            {
              backgroundColor: canStart ? colors.primary : colors.surfaceElevated,
            },
          ]}
        >
          <Ionicons
            name="play-circle"
            size={22}
            color={canStart ? colors.onPrimary : colors.textMuted}
          />
          <Text
            style={[
              styles.startBtnText,
              { color: canStart ? colors.onPrimary : colors.textMuted },
            ]}
          >
            Start Match
          </Text>
        </TouchableOpacity>
      </View>

      {/* Openers Modal */}
      <Modal visible={openersModal} transparent animationType="slide" onRequestClose={() => setOpenersModal(false)}>
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalSheet,
              { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 },
            ]}
          >
            <View style={styles.modalHandle} />
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              Opening Players
            </Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
              {battingTeam.name} batting vs {bowlingTeam.name}
            </Text>

            <PickerList
              label="Striker"
              players={battingTeam.players}
              selectedIdx={strikerIdx}
              onSelect={(i) => {
                setStrikerIdx(i);
                if (i === nonStrikerIdx) {
                  setNonStrikerIdx((i + 1) % playersPerSide);
                }
              }}
              colors={colors}
              testPrefix="striker"
              disabledIdx={nonStrikerIdx}
            />
            <PickerList
              label="Non-Striker"
              players={battingTeam.players}
              selectedIdx={nonStrikerIdx}
              onSelect={(i) => {
                setNonStrikerIdx(i);
                if (i === strikerIdx) {
                  setStrikerIdx((i + 1) % playersPerSide);
                }
              }}
              colors={colors}
              testPrefix="nonstriker"
              disabledIdx={strikerIdx}
            />
            <PickerList
              label="Opening Bowler"
              players={bowlingTeam.players}
              selectedIdx={bowlerIdx}
              onSelect={(i) => setBowlerIdx(i)}
              colors={colors}
              testPrefix="bowler"
            />

            <TouchableOpacity
              testID="confirm-openers-button"
              onPress={onConfirmOpeners}
              style={[styles.startBtn, { backgroundColor: colors.primary, marginTop: 16 }]}
              activeOpacity={0.9}
            >
              <Text style={[styles.startBtnText, { color: colors.onPrimary }]}>
                Start Scoring
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ---- Subcomponents ----

interface ColorsProp { colors: ReturnType<typeof useTheme>["colors"]; }

function Section({ title, colors, children }: ColorsProp & { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: 18 }}>
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{title}</Text>
      <View style={{ marginTop: 8, gap: 4 }}>{children}</View>
    </View>
  );
}

function ChipRow<T extends string | number>({
  options,
  value,
  onSelect,
  testIDPrefix,
  colors,
}: ColorsProp & {
  options: { value: T; label: string }[];
  value: T | null;
  onSelect: (v: T) => void;
  testIDPrefix: string;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
    >
      {options.map((o) => {
        const active = value === o.value;
        return (
          <TouchableOpacity
            key={String(o.value)}
            testID={`${testIDPrefix}-${o.value}`}
            onPress={() => onSelect(o.value)}
            style={{
              height: 40,
              minWidth: 56,
              paddingHorizontal: 16,
              borderRadius: 999,
              borderWidth: 1,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: active ? colors.primary : colors.surface,
              borderColor: active ? colors.primary : colors.border,
              flexShrink: 0,
            }}
          >
            <Text
              style={{
                color: active ? colors.onPrimary : colors.textPrimary,
                fontWeight: "800",
                fontSize: 14,
              }}
            >
              {o.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function PlayerList({
  team,
  count,
  onChange,
  onSelectCaptain,
  colors,
  testPrefix,
}: ColorsProp & {
  team: Team;
  count: number;
  onChange: (idx: number, name: string) => void;
  onSelectCaptain: (idx: number) => void;
  testPrefix: string;
}) {
  return (
    <View style={{ gap: 8, marginTop: 8 }}>
      {Array.from({ length: count }).map((_, idx) => (
        <View
          key={idx}
          style={[
            styles.playerRow,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.playerIdx, { color: colors.textMuted }]}>
            {idx + 1}.
          </Text>
          <TextInput
            value={team.players[idx] ?? ""}
            onChangeText={(t) => onChange(idx, t)}
            placeholder={`Player ${idx + 1}`}
            placeholderTextColor={colors.textMuted}
            style={[styles.playerInput, { color: colors.textPrimary }]}
            testID={`${testPrefix}-player-${idx}-input`}
          />
          <TouchableOpacity
            onPress={() => onSelectCaptain(idx)}
            testID={`${testPrefix}-captain-${idx}`}
            style={[
              styles.captainBadge,
              {
                backgroundColor:
                  team.captainIdx === idx ? colors.warningMuted : "transparent",
                borderColor:
                  team.captainIdx === idx ? colors.warning : colors.border,
              },
            ]}
          >
            <Text
              style={{
                color:
                  team.captainIdx === idx ? colors.warning : colors.textMuted,
                fontWeight: "800",
                fontSize: 12,
              }}
            >
              C
            </Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

function PickerList({
  label,
  players,
  selectedIdx,
  onSelect,
  colors,
  testPrefix,
  disabledIdx,
}: ColorsProp & {
  label: string;
  players: string[];
  selectedIdx: number;
  onSelect: (i: number) => void;
  testPrefix: string;
  disabledIdx?: number;
}) {
  return (
    <View style={{ marginTop: 14 }}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingTop: 8, paddingBottom: 4 }}
      >
        {players.map((p, idx) => {
          const active = selectedIdx === idx;
          const disabled = disabledIdx === idx;
          return (
            <TouchableOpacity
              key={idx}
              testID={`${testPrefix}-${idx}`}
              disabled={disabled}
              onPress={() => onSelect(idx)}
              style={{
                paddingHorizontal: 14,
                height: 40,
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
  sectionTitle: { fontSize: 18, fontWeight: "800" },
  label: { fontSize: 13, fontWeight: "700", letterSpacing: 0.3 },
  input: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: "600",
  },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
  },
  playerIdx: { fontSize: 14, fontWeight: "700", width: 24 },
  playerInput: { flex: 1, fontSize: 15, fontWeight: "600", paddingVertical: 8 },
  captainBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  bigPill: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  bigPillText: { fontSize: 15, fontWeight: "800" },
  coinBtn: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 14,
  },
  coinBtnText: { fontSize: 15, fontWeight: "800" },
  coinResult: {
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  coinResultText: { fontSize: 14, fontWeight: "800" },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 12,
    paddingHorizontal: 20,
    borderTopWidth: 1,
  },
  startBtn: {
    height: 56,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  startBtnText: { fontSize: 17, fontWeight: "800", letterSpacing: 0.3 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "85%",
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignSelf: "center",
    marginBottom: 12,
  },
  modalTitle: { fontSize: 22, fontWeight: "900", letterSpacing: -0.4 },
  modalSubtitle: { fontSize: 13, fontWeight: "600", marginTop: 4 },
});
