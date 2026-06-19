import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useTheme } from "@/src/theme/ThemeContext";
import {
  deleteTeam,
  loadSavedTeams,
  newTeamId,
  SavedTeam,
  upsertTeam,
} from "@/src/storage/teams";
import { suggestPlayers } from "@/src/storage/players_pool";

export default function ManageTeamsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [teams, setTeams] = useState<SavedTeam[]>([]);
  const [editing, setEditing] = useState<SavedTeam | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftPlayers, setDraftPlayers] = useState<string[]>([]);
  const [playerInput, setPlayerInput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [captainIdx, setCaptainIdx] = useState(0);

  const load = useCallback(async () => {
    setTeams(await loadSavedTeams());
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const excluded = new Set(draftPlayers.map((p) => p.trim().toLowerCase()));
      const list = await suggestPlayers(playerInput, excluded, 14);
      if (!cancelled) setSuggestions(list.map((p) => p.name));
    })();
    return () => { cancelled = true; };
  }, [playerInput, draftPlayers]);

  const openNew = () => {
    setEditing({
      id: newTeamId(), name: "", players: [], captainIdx: 0, updatedAt: "",
    });
    setDraftName("");
    setDraftPlayers([]);
    setCaptainIdx(0);
    setPlayerInput("");
  };

  const openEdit = (t: SavedTeam) => {
    setEditing(t);
    setDraftName(t.name);
    setDraftPlayers([...t.players]);
    setCaptainIdx(t.captainIdx);
    setPlayerInput("");
  };

  const onAddPlayer = (name: string) => {
    const n = name.trim();
    if (!n) return;
    const key = n.toLowerCase();
    if (draftPlayers.some((p) => p.trim().toLowerCase() === key)) return;
    setDraftPlayers((arr) => [...arr, n]);
    setPlayerInput("");
  };

  const onRemove = (idx: number) => {
    setDraftPlayers((arr) => arr.filter((_, i) => i !== idx));
    if (captainIdx >= draftPlayers.length - 1) setCaptainIdx(0);
  };

  const onSave = async () => {
    if (!editing) return;
    const team: SavedTeam = {
      ...editing,
      name: draftName.trim(),
      players: draftPlayers,
      captainIdx,
      updatedAt: new Date().toISOString(),
    };
    if (!team.name || team.players.length === 0) return;
    await upsertTeam(team);
    setEditing(null);
    await load();
  };

  const onDelete = async (id: string) => {
    await deleteTeam(id);
    await load();
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          testID="teams-back-button"
          onPress={() => router.back()}
          style={[styles.iconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Manage Teams</Text>
        <TouchableOpacity
          testID="teams-add-button"
          onPress={openNew}
          style={[styles.iconBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
        >
          <Ionicons name="add" size={22} color={colors.onPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 24, gap: 10 }}>
        {teams.length === 0 && (
          <View testID="teams-empty" style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="people-outline" size={32} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>No saved teams</Text>
            <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
              Save reusable team rosters once — pick them in any future match.
            </Text>
          </View>
        )}
        {teams.map((t) => (
          <TouchableOpacity
            key={t.id}
            testID={`team-card-${t.id}`}
            onPress={() => openEdit(t)}
            activeOpacity={0.85}
            style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]} numberOfLines={1}>{t.name}</Text>
              <Text style={[styles.rowSub, { color: colors.textSecondary }]} numberOfLines={2}>
                {t.players.length} players • Captain: {t.players[t.captainIdx] ?? "—"}
              </Text>
            </View>
            <TouchableOpacity testID={`team-delete-${t.id}`} hitSlop={10} onPress={(e) => { e.stopPropagation?.(); onDelete(t.id); }}>
              <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: insets.bottom + 16 }]}>
            <View style={styles.handle} />
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {editing?.updatedAt ? "Edit Team" : "New Team"}
            </Text>

            <Text style={[styles.label, { color: colors.textSecondary, marginTop: 12 }]}>Team name</Text>
            <TextInput
              testID="team-edit-name"
              value={draftName}
              onChangeText={setDraftName}
              placeholder="e.g., Mohalla XI"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary }]}
            />

            <View style={styles.addRow}>
              <TextInput
                testID="team-edit-player-input"
                value={playerInput}
                onChangeText={setPlayerInput}
                onSubmitEditing={() => onAddPlayer(playerInput)}
                placeholder="Add player name"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, { flex: 1, backgroundColor: colors.surface, borderColor: colors.border, color: colors.textPrimary, marginTop: 0 }]}
              />
              <TouchableOpacity
                testID="team-edit-player-add"
                onPress={() => onAddPlayer(playerInput)}
                disabled={!playerInput.trim()}
                style={[styles.addBtn, { backgroundColor: playerInput.trim() ? colors.primary : colors.surfaceElevated, borderColor: playerInput.trim() ? colors.primary : colors.border }]}
              >
                <Ionicons name="add" size={22} color={playerInput.trim() ? colors.onPrimary : colors.textMuted} />
              </TouchableOpacity>
            </View>

            {suggestions.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 8 }} keyboardShouldPersistTaps="handled">
                {suggestions.map((s, idx) => (
                  <TouchableOpacity
                    key={`${s}-${idx}`}
                    onPress={() => onAddPlayer(s)}
                    style={[styles.chip, { backgroundColor: colors.primaryMuted, borderColor: colors.primary }]}
                  >
                    <Ionicons name="add" size={12} color={colors.primary} />
                    <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 12 }}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <ScrollView style={{ maxHeight: 240, marginTop: 6 }} contentContainerStyle={{ gap: 6 }}>
              {draftPlayers.map((p, idx) => (
                <View key={`${p}-${idx}`} style={[styles.playerRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={{ color: colors.textMuted, width: 22, fontWeight: "700" }}>{idx + 1}.</Text>
                  <Text style={{ flex: 1, color: colors.textPrimary, fontWeight: "700", fontSize: 14 }}>{p}</Text>
                  <TouchableOpacity onPress={() => setCaptainIdx(idx)} style={[styles.captainBadge, { backgroundColor: captainIdx === idx ? colors.warningMuted : "transparent", borderColor: captainIdx === idx ? colors.warning : colors.border }]}>
                    <Text style={{ color: captainIdx === idx ? colors.warning : colors.textMuted, fontWeight: "800", fontSize: 12 }}>C</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => onRemove(idx)} hitSlop={10}>
                    <Ionicons name="close-circle" size={20} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                testID="team-edit-cancel"
                onPress={() => setEditing(null)}
                style={[styles.cta, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderWidth: 1, flex: 1 }]}
              >
                <Text style={{ color: colors.textPrimary, fontWeight: "800" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="team-edit-save"
                onPress={onSave}
                disabled={!draftName.trim() || draftPlayers.length === 0}
                style={[styles.cta, { backgroundColor: draftName.trim() && draftPlayers.length > 0 ? colors.primary : colors.surfaceElevated, flex: 2 }]}
              >
                <Text style={{ color: draftName.trim() && draftPlayers.length > 0 ? colors.onPrimary : colors.textMuted, fontWeight: "800" }}>
                  Save Team
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 12 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  headerTitle: { fontSize: 18, fontWeight: "800" },
  empty: { borderWidth: 1, borderRadius: 16, padding: 24, alignItems: "center", gap: 4 },
  emptyTitle: { fontSize: 16, fontWeight: "800", marginTop: 4 },
  emptyDesc: { fontSize: 13, textAlign: "center" },
  row: { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: 1, padding: 14, gap: 10 },
  rowTitle: { fontSize: 15, fontWeight: "800" },
  rowSub: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12, paddingHorizontal: 20, paddingBottom: 24, maxHeight: "92%" },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.15)", alignSelf: "center", marginBottom: 12 },
  modalTitle: { fontSize: 20, fontWeight: "900" },
  label: { fontSize: 13, fontWeight: "700" },
  input: { height: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, fontSize: 15, fontWeight: "600", marginTop: 6 },
  addRow: { flexDirection: "row", gap: 8, marginTop: 10, alignItems: "center" },
  addBtn: { width: 48, height: 48, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, height: 30, borderRadius: 999, borderWidth: 1, flexShrink: 0 },
  playerRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1, gap: 8 },
  captainBadge: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  cta: { height: 50, borderRadius: 14, alignItems: "center", justifyContent: "center" },
});
