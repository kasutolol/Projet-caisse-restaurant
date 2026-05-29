import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Modal, TextInput, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { api, COLORS, fmtPrice } from "@/src/api";

type Table = { id: string; number: number; covers: number; status: string; current_order_id?: string };

export default function Index() {
  const router = useRouter();
  const [tables, setTables] = useState<Table[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [tableNum, setTableNum] = useState("");
  const [coversModal, setCoversModal] = useState<{ number: number } | null>(null);
  const [covers, setCovers] = useState("2");

  const load = useCallback(async () => {
    try {
      const t = await api("/tables");
      setTables(t);
    } catch (e: any) { console.log(e.message); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openTableByNumber = async () => {
    const n = parseInt(tableNum, 10);
    if (!n || n < 1) {
      Alert.alert("Numéro invalide", "Entrez un numéro de table valide.");
      return;
    }
    // Cherche table existante occupée
    const existing = tables.find(t => t.number === n);
    if (existing && existing.status === "occupied" && existing.current_order_id) {
      setTableNum("");
      router.push(`/order/${existing.current_order_id}`);
      return;
    }
    setCoversModal({ number: n });
    setCovers("2");
  };

  const confirmOpen = async () => {
    if (!coversModal) return;
    const c = parseInt(covers, 10) || 1;
    try {
      const res = await api("/tables/open-by-number", {
        method: "POST",
        body: JSON.stringify({ number: coversModal.number, covers: c }),
      });
      setCoversModal(null);
      setTableNum("");
      router.push(`/order/${res.order.id}`);
    } catch (e: any) {
      Alert.alert("Erreur", e.message);
    }
  };

  const openExisting = (t: Table) => {
    if (t.current_order_id) router.push(`/order/${t.current_order_id}`);
  };

  const occupied = tables.filter(t => t.status === "occupied").sort((a, b) => a.number - b.number);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Service</Text>
            <Text style={styles.subtitle}>{occupied.length} table{occupied.length > 1 ? "s" : ""} en cours</Text>
          </View>
          <TouchableOpacity testID="orders-btn" style={styles.headerBtn} onPress={() => router.push("/orders")}>
            <Ionicons name="receipt-outline" size={22} color={COLORS.text} />
            <Text style={styles.headerBtnText}>Historique</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        >
          <View style={styles.openBox}>
            <Text style={styles.openBoxLabel}>Ouvrir / Reprendre une table</Text>
            <TextInput
              testID="table-number-input"
              style={styles.tableInput}
              value={tableNum}
              onChangeText={setTableNum}
              placeholder="N°"
              placeholderTextColor="#A1A1AA"
              keyboardType="number-pad"
              returnKeyType="go"
              onSubmitEditing={openTableByNumber}
              maxLength={4}
            />
            <TouchableOpacity testID="open-table-btn" style={styles.openBtn} onPress={openTableByNumber} activeOpacity={0.8}>
              <Ionicons name="arrow-forward" size={22} color="#fff" />
              <Text style={styles.openBtnText}>Ouvrir la table</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>Tables en cours</Text>
          {occupied.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="restaurant-outline" size={48} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>Aucune table en cours.{"\n"}Saisissez un numéro pour démarrer.</Text>
            </View>
          ) : (
            <View style={styles.grid}>
              {occupied.map(t => (
                <TouchableOpacity
                  testID={`table-card-${t.number}`}
                  key={t.id}
                  style={styles.card}
                  onPress={() => openExisting(t)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cardNum}>{t.number}</Text>
                  <View style={styles.coversRow}>
                    <Ionicons name="people" size={16} color="#78350F" />
                    <Text style={styles.coversTxt}>{t.covers} couv.</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={!!coversModal} transparent animationType="fade" onRequestClose={() => setCoversModal(null)}>
        <View style={styles.modalBack}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Table {coversModal?.number}</Text>
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
              <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={() => setCoversModal(null)}>
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
  scroll: { padding: 14, paddingBottom: 40 },
  openBox: { backgroundColor: COLORS.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, marginBottom: 22 },
  openBoxLabel: { fontSize: 12, fontWeight: "800", color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 },
  openRow: { flexDirection: "row", gap: 8 },
  tableInput: { borderWidth: 2, borderColor: COLORS.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 16, fontSize: 32, fontWeight: "900", color: COLORS.text, textAlign: "center" },
  openBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: 14, marginTop: 10 },
  openBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  sectionTitle: { fontSize: 13, fontWeight: "800", color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 },
  empty: { alignItems: "center", marginTop: 30, gap: 10, padding: 20 },
  emptyText: { color: COLORS.textSecondary, textAlign: "center", lineHeight: 20 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 12 },
  card: { width: "31.5%", aspectRatio: 1, borderRadius: 16, borderWidth: 2, alignItems: "center", justifyContent: "center", padding: 8, backgroundColor: "#FEF3C7", borderColor: "#F59E0B" },
  cardNum: { fontSize: 42, fontWeight: "900", letterSpacing: -1, color: "#78350F" },
  coversRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  coversTxt: { fontSize: 13, fontWeight: "700", color: "#78350F" },
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
