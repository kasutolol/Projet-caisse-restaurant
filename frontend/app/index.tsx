import { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Alert, Modal, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { api, COLORS, fmtPrice } from "@/src/api";

type Table = { id: string; number: number; covers: number; status: string; current_order_id?: string };

export default function Index() {
  const router = useRouter();
  const [tables, setTables] = useState<Table[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [openModal, setOpenModal] = useState<Table | null>(null);
  const [covers, setCovers] = useState("2");

  const load = useCallback(async () => {
    try {
      const t = await api("/tables");
      setTables(t);
    } catch (e: any) {
      console.log(e.message);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openTable = async (t: Table) => {
    if (t.status === "occupied" && t.current_order_id) {
      router.push(`/order/${t.current_order_id}`);
    } else {
      setOpenModal(t);
      setCovers("2");
    }
  };

  const confirmOpen = async () => {
    if (!openModal) return;
    const c = parseInt(covers, 10) || 1;
    const order = await api(`/tables/${openModal.id}/order?covers=${c}`, { method: "POST" });
    setOpenModal(null);
    router.push(`/order/${order.id}`);
  };

  const freeCount = tables.filter(t => t.status === "free").length;
  const occCount = tables.length - freeCount;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Tables</Text>
          <Text style={styles.subtitle}>{freeCount} libres · {occCount} occupées</Text>
        </View>
        <TouchableOpacity testID="orders-btn" style={styles.headerBtn} onPress={() => router.push("/orders")}>
          <Ionicons name="receipt-outline" size={22} color={COLORS.text} />
          <Text style={styles.headerBtnText}>Historique</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.grid}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        {tables.map(t => {
          const occ = t.status === "occupied";
          return (
            <TouchableOpacity
              testID={`table-card-${t.number}`}
              key={t.id}
              style={[styles.card, { backgroundColor: occ ? "#FEF3C7" : "#DCFCE7", borderColor: occ ? "#F59E0B" : "#22C55E" }]}
              onPress={() => openTable(t)}
              activeOpacity={0.7}
            >
              <Text style={[styles.cardNum, { color: occ ? "#78350F" : "#14532D" }]}>{t.number}</Text>
              <View style={styles.coversRow}>
                <Ionicons name="people" size={16} color={occ ? "#78350F" : "#14532D"} />
                <Text style={[styles.coversTxt, { color: occ ? "#78350F" : "#14532D" }]}>
                  {occ ? `${t.covers} couv.` : "Libre"}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Modal visible={!!openModal} transparent animationType="fade" onRequestClose={() => setOpenModal(null)}>
        <View style={styles.modalBack}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Table {openModal?.number}</Text>
            <Text style={styles.modalLabel}>Nombre de couverts</Text>
            <TextInput
              testID="covers-input"
              style={styles.input}
              value={covers}
              onChangeText={setCovers}
              keyboardType="number-pad"
              autoFocus
            />
            <View style={styles.coverChips}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                <TouchableOpacity key={n} style={[styles.chip, covers === String(n) && styles.chipActive]} onPress={() => setCovers(String(n))}>
                  <Text style={[styles.chipText, covers === String(n) && styles.chipTextActive]}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={() => setOpenModal(null)}>
                <Text style={styles.btnSecondaryText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="confirm-open-btn" style={[styles.btn, styles.btnPrimary]} onPress={confirmOpen}>
                <Text style={styles.btnPrimaryText}>Ouvrir</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { paddingHorizontal: 16, paddingVertical: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  title: { fontSize: 28, fontWeight: "900", color: COLORS.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  headerBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: COLORS.bg, borderRadius: 10 },
  headerBtnText: { fontWeight: "700", color: COLORS.text },
  grid: { padding: 14, flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: { width: "31%", aspectRatio: 1, borderRadius: 16, borderWidth: 2, alignItems: "center", justifyContent: "center", padding: 8 },
  cardNum: { fontSize: 42, fontWeight: "900", letterSpacing: -1 },
  coversRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  coversTxt: { fontSize: 13, fontWeight: "700" },
  modalBack: { flex: 1, backgroundColor: "rgba(9,9,11,0.6)", justifyContent: "center", padding: 20 },
  modalCard: { backgroundColor: COLORS.surface, borderRadius: 20, padding: 22 },
  modalTitle: { fontSize: 24, fontWeight: "900", color: COLORS.text, marginBottom: 16 },
  modalLabel: { fontSize: 13, fontWeight: "700", color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  input: { borderWidth: 2, borderColor: COLORS.border, borderRadius: 12, padding: 14, fontSize: 18, fontWeight: "700", color: COLORS.text },
  coverChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  chip: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontWeight: "800", color: COLORS.text },
  chipTextActive: { color: "#fff" },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 22 },
  btn: { flex: 1, paddingVertical: 16, borderRadius: 12, alignItems: "center" },
  btnPrimary: { backgroundColor: COLORS.primary },
  btnPrimaryText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  btnSecondary: { backgroundColor: COLORS.bg },
  btnSecondaryText: { color: COLORS.text, fontWeight: "700", fontSize: 16 },
});
