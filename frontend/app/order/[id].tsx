import { useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { api, COLORS, fmtPrice } from "@/src/api";

type OrderItem = {
  id: string; item_name: string; category_key: string; unit_price: number;
  quantity: number; options: { group: string; value: string }[]; note: string; sent: boolean;
};
type Order = { id: string; table_number: number; covers: number; status: string; items: OrderItem[]; total: number };

export default function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [closeModal, setCloseModal] = useState(false);
  const [coversModal, setCoversModal] = useState(false);
  const [newCovers, setNewCovers] = useState("2");
  const [feedback, setFeedback] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setOrder(await api(`/orders/${id}`)); } catch (e: any) { console.log(e.message); }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const updateQty = async (itemId: string, q: number) => {
    await api(`/orders/${id}/items/${itemId}/quantity?quantity=${q}`, { method: "PUT" });
    load();
  };

  const sendOrder = async () => {
    await api(`/orders/${id}/send`, { method: "POST" });
    setFeedback("✓ Commande envoyée");
    setTimeout(() => setFeedback(null), 1500);
    load();
  };

  const doClose = async () => {
    setCloseModal(false);
    await api(`/orders/${id}/close`, { method: "POST" });
    router.replace("/");
  };

  const openCoversEdit = () => {
    setNewCovers(String(order?.covers || 1));
    setCoversModal(true);
  };

  const saveCovers = async () => {
    const c = parseInt(newCovers, 10) || 1;
    await api(`/orders/${id}/covers?covers=${c}`, { method: "PUT" });
    setCoversModal(false);
    load();
  };

  if (!order) {
    return <SafeAreaView style={styles.safe}><Text style={styles.loading}>Chargement…</Text></SafeAreaView>;
  }

  const grouped: Record<string, OrderItem[]> = {};
  order.items.forEach(it => {
    grouped[it.category_key] = grouped[it.category_key] || [];
    grouped[it.category_key].push(it);
  });

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity testID="back-btn" onPress={() => router.replace("/")} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={COLORS.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Table {order.table_number}</Text>
          <TouchableOpacity testID="edit-covers-btn" onPress={openCoversEdit} style={styles.subRow}>
            <Ionicons name="people" size={14} color={COLORS.textSecondary} />
            <Text style={styles.subtitle}>{order.covers} couverts</Text>
            <Ionicons name="pencil" size={12} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity testID="add-btn" style={styles.addBtn} onPress={() => router.push(`/menu?orderId=${order.id}`)}>
          <Ionicons name="add" size={24} color="#fff" />
          <Text style={styles.addBtnText}>Ajouter</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {order.items.length === 0 && (
          <View style={styles.empty}>
            <Ionicons name="restaurant-outline" size={56} color={COLORS.textSecondary} />
            <Text style={styles.emptyText}>Aucun article. Touchez "Ajouter" pour commencer.</Text>
          </View>
        )}
        {Object.keys(grouped).map(catKey => {
          const items = grouped[catKey];
          return (
            <View key={catKey} style={styles.group}>
              {items.map(it => (
                <View key={it.id} testID={`order-item-${it.id}`} style={[styles.item, !it.sent && styles.itemPending]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{it.item_name}</Text>
                    {it.options.map((o, i) => (
                      <Text key={i} style={styles.opt}>· {o.group}: {o.value}</Text>
                    ))}
                    {!!it.note && <Text style={styles.note}>Note: {it.note}</Text>}
                    {!it.sent && <Text style={styles.pendingTag}>NOUVEAU</Text>}
                  </View>
                  <View style={styles.qtyBox}>
                    <TouchableOpacity onPress={() => updateQty(it.id, it.quantity - 1)} style={styles.qBtn}>
                      <Ionicons name="remove" size={18} color={COLORS.text} />
                    </TouchableOpacity>
                    <Text style={styles.qty}>{it.quantity}</Text>
                    <TouchableOpacity onPress={() => updateQty(it.id, it.quantity + 1)} style={styles.qBtn}>
                      <Ionicons name="add" size={18} color={COLORS.text} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.price}>{fmtPrice(it.unit_price * it.quantity)}</Text>
                </View>
              ))}
            </View>
          );
        })}
      </ScrollView>

      {feedback && (
        <View style={styles.feedback}>
          <Text style={styles.feedbackText}>{feedback}</Text>
        </View>
      )}

      <View style={styles.footer}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>TOTAL</Text>
          <Text testID="order-total" style={styles.totalValue}>{fmtPrice(order.total)}</Text>
        </View>
        <View style={styles.footerBtns}>
          <TouchableOpacity testID="send-btn" style={[styles.btn, styles.btnGhost]} onPress={sendOrder}>
            <Ionicons name="send-outline" size={18} color={COLORS.text} />
            <Text style={styles.btnGhostText}>Envoyer</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="close-btn" style={[styles.btn, styles.btnDanger]} onPress={() => setCloseModal(true)}>
            <Ionicons name="checkmark-done" size={18} color="#fff" />
            <Text style={styles.btnDangerText}>Clôturer</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Close confirmation modal (custom, works on all platforms) */}
      <Modal visible={closeModal} transparent animationType="fade" onRequestClose={() => setCloseModal(false)}>
        <View style={styles.modalBack}>
          <View style={styles.modalCard}>
            <Ionicons name="alert-circle" size={42} color={COLORS.warning} style={{ alignSelf: "center" }} />
            <Text style={styles.modalTitle}>Clôturer la table ?</Text>
            <Text style={styles.modalText}>
              {order.items.length === 0
                ? "Cette table ne contient aucune commande. Elle sera libérée."
                : `Total : ${fmtPrice(order.total)} · ${order.items.length} article${order.items.length > 1 ? "s" : ""}`}
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.mBtn, styles.btnSecondary]} onPress={() => setCloseModal(false)}>
                <Text style={styles.btnSecondaryText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="confirm-close-btn" style={[styles.mBtn, styles.btnDanger]} onPress={doClose}>
                <Text style={styles.btnDangerText}>Clôturer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit covers modal */}
      <Modal visible={coversModal} transparent animationType="fade" onRequestClose={() => setCoversModal(false)}>
        <View style={styles.modalBack}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Modifier les couverts</Text>
            <TextInput
              testID="new-covers-input"
              style={styles.input}
              value={newCovers}
              onChangeText={setNewCovers}
              keyboardType="number-pad"
              autoFocus
            />
            <View style={styles.coverChips}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                <TouchableOpacity key={n} style={[styles.chip, newCovers === String(n) && styles.chipActive]} onPress={() => setNewCovers(String(n))}>
                  <Text style={[styles.chipText, newCovers === String(n) && styles.chipTextActive]}>{n}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.mBtn, styles.btnSecondary]} onPress={() => setCoversModal(false)}>
                <Text style={styles.btnSecondaryText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="save-covers-btn" style={[styles.mBtn, styles.btnPrimary]} onPress={saveCovers}>
                <Text style={styles.btnPrimaryText}>Enregistrer</Text>
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
  loading: { textAlign: "center", marginTop: 40, color: COLORS.textSecondary },
  header: { flexDirection: "row", alignItems: "center", padding: 10, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 6 },
  backBtn: { padding: 4 },
  title: { fontSize: 20, fontWeight: "900", color: COLORS.text },
  subRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  subtitle: { fontSize: 12, color: COLORS.textSecondary },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  addBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  list: { padding: 12, paddingBottom: 30 },
  empty: { alignItems: "center", marginTop: 80, gap: 12 },
  emptyText: { color: COLORS.textSecondary, textAlign: "center", paddingHorizontal: 40 },
  group: { marginBottom: 8 },
  item: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.surface, padding: 12, borderRadius: 12, marginBottom: 6, gap: 10, borderWidth: 1, borderColor: COLORS.border },
  itemPending: { borderColor: COLORS.primary, borderWidth: 2 },
  itemName: { fontSize: 15, fontWeight: "700", color: COLORS.text },
  opt: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  note: { fontSize: 12, color: COLORS.warning, marginTop: 2, fontStyle: "italic" },
  pendingTag: { fontSize: 10, fontWeight: "800", color: COLORS.primary, marginTop: 4, letterSpacing: 0.5 },
  qtyBox: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.bg, borderRadius: 10 },
  qBtn: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  qty: { fontWeight: "800", fontSize: 15, width: 22, textAlign: "center" },
  price: { fontWeight: "800", fontSize: 14, color: COLORS.text, minWidth: 60, textAlign: "right" },
  feedback: { position: "absolute", alignSelf: "center", bottom: 130, backgroundColor: "#14532D", paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12 },
  feedbackText: { color: "#fff", fontWeight: "800" },
  footer: { padding: 14, backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  totalLabel: { fontSize: 13, fontWeight: "800", color: COLORS.textSecondary, letterSpacing: 1 },
  totalValue: { fontSize: 28, fontWeight: "900", color: COLORS.text },
  footerBtns: { flexDirection: "row", gap: 10 },
  btn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 14, borderRadius: 12 },
  btnGhost: { backgroundColor: COLORS.bg },
  btnGhostText: { fontWeight: "800", color: COLORS.text },
  btnDanger: { backgroundColor: COLORS.text },
  btnDangerText: { fontWeight: "800", color: "#fff" },
  modalBack: { flex: 1, backgroundColor: "rgba(9,9,11,0.6)", justifyContent: "center", padding: 20 },
  modalCard: { backgroundColor: COLORS.surface, borderRadius: 20, padding: 22 },
  modalTitle: { fontSize: 22, fontWeight: "900", color: COLORS.text, marginTop: 8, textAlign: "center" },
  modalText: { fontSize: 14, color: COLORS.textSecondary, marginTop: 8, marginBottom: 18, textAlign: "center", lineHeight: 20 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 12 },
  mBtn: { flex: 1, paddingVertical: 16, borderRadius: 12, alignItems: "center" },
  btnPrimary: { backgroundColor: COLORS.primary },
  btnPrimaryText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  btnSecondary: { backgroundColor: COLORS.bg },
  btnSecondaryText: { color: COLORS.text, fontWeight: "700", fontSize: 16 },
  input: { borderWidth: 2, borderColor: COLORS.border, borderRadius: 12, padding: 14, fontSize: 18, fontWeight: "700", color: COLORS.text, marginTop: 14 },
  coverChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  chip: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: COLORS.border, alignItems: "center", justifyContent: "center" },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontWeight: "800", color: COLORS.text },
  chipTextActive: { color: "#fff" },
});
