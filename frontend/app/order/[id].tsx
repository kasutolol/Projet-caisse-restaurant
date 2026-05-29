import { useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { api, COLORS, CATEGORY_COLORS, fmtPrice } from "@/src/api";

type OrderItem = {
  id: string; item_name: string; category_key: string; unit_price: number;
  quantity: number; options: { group: string; value: string }[]; note: string; sent: boolean;
  course: number;
};
type Order = {
  id: string; table_number: number; covers: number; status: string;
  items: OrderItem[]; total: number; next_course: number;
};

// Catégorie key -> color group (must match menu seed)
const CAT_TO_COLOR_GROUP: Record<string, string> = {
  aperitifs: "aperitifs_tapas",
  tapas: "aperitifs_tapas",
  entrees: "entrees",
  plats: "plats",
  desserts: "desserts",
  boissons_fraiches: "boissons",
  boissons_chaudes: "cafes_digestifs",
  vins_verre: "vins",
  vins_rouge: "vins",
  vins_blanc: "vins",
  vins_rose: "vins",
  champagnes: "vins",
  digestifs: "cafes_digestifs",
};
const itemColor = (key: string) => CATEGORY_COLORS[CAT_TO_COLOR_GROUP[key] || "boissons"];

export default function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);
  const [closeModal, setCloseModal] = useState(false);
  const [coversModal, setCoversModal] = useState(false);
  const [newCovers, setNewCovers] = useState("2");
  const [moveItem, setMoveItem] = useState<OrderItem | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
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

  const addNextCourse = async () => {
    await api(`/orders/${id}/next-course`, { method: "POST" });
    setFeedback("✓ Nouvelle ligne 'À SUIVRE' créée");
    setTimeout(() => setFeedback(null), 1500);
    load();
  };

  const moveItemToCourse = async (course: number) => {
    if (!moveItem) return;
    await api(`/orders/${id}/items/${moveItem.id}/course?course=${course}`, { method: "PUT" });
    setMoveItem(null);
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

  // Group by course, then by category within each course
  const courses = Array.from(new Set(order.items.map(i => i.course || 1))).sort((a, b) => a - b);
  // Always include the active "next_course" so the empty round is visible
  if (!courses.includes(order.next_course)) courses.push(order.next_course);
  courses.sort((a, b) => a - b);

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
        {courses.map(c => {
          const itemsOfCourse = order.items.filter(i => (i.course || 1) === c);
          const isActive = c === order.next_course;
          const label = c === 1 ? "EN DIRECT" : `À SUIVRE ${c - 1}`;
          const isDropTarget = !!draggingId;
          return (
            <View key={c} style={styles.courseBlock}>
              <Pressable
                onPress={() => isDropTarget && moveItemToCourse(c)}
                style={[
                  styles.courseHeader,
                  isActive && styles.courseHeaderActive,
                  isDropTarget && styles.courseHeaderDrop,
                ]}
              >
                <Ionicons
                  name={isDropTarget ? "download" : c === 1 ? "flash" : "arrow-forward-circle"}
                  size={16}
                  color={isDropTarget ? COLORS.primary : isActive ? "#fff" : COLORS.text}
                />
                <Text style={[
                  styles.courseLabel,
                  isActive && styles.courseLabelActive,
                  isDropTarget && styles.courseLabelDrop,
                ]}>
                  {isDropTarget ? `↓ Déposer dans "${label}"` : label}
                </Text>
                {isActive && !isDropTarget && <Text style={styles.courseTag}>articles ajoutés ici</Text>}
              </Pressable>
              {itemsOfCourse.length === 0 ? (
                <Text style={styles.coursePlaceholder}>(vide — les prochains articles iront ici)</Text>
              ) : (
                itemsOfCourse.map(it => {
                  const col = itemColor(it.category_key);
                  const isDragging = draggingId === it.id;
                  return (
                    <Pressable
                      key={it.id}
                      testID={`order-item-${it.id}`}
                      onLongPress={() => setDraggingId(it.id)}
                      onPress={() => isDragging && setDraggingId(null)}
                      delayLongPress={400}
                      style={[
                        styles.item,
                        { borderLeftColor: col.border, borderLeftWidth: 5, backgroundColor: col.bg },
                        !it.sent && styles.itemPending,
                        isDragging && styles.itemDragging,
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.itemName, { color: col.text }]}>{it.item_name}</Text>
                        {it.options.map((o, i) => (
                          <Text key={i} style={[styles.opt, { color: col.text, opacity: 0.75 }]}>· {o.group}: {o.value}</Text>
                        ))}
                        {!!it.note && <Text style={styles.note}>Note: {it.note}</Text>}
                        {isDragging ? (
                          <Text style={styles.draggingTag}>✋ MAINTENU — touchez une ligne pour déposer</Text>
                        ) : (
                          !it.sent && <Text style={styles.pendingTag}>NOUVEAU</Text>
                        )}
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
                      <Text style={[styles.price, { color: col.text }]}>{fmtPrice(it.unit_price * it.quantity)}</Text>
                    </Pressable>
                  );
                })
              )}
            </View>
          );
        })}

        <TouchableOpacity testID="next-course-btn" style={styles.nextCourseBtn} onPress={addNextCourse}>
          <Ionicons name="add-circle" size={20} color={COLORS.primary} />
          <Text style={styles.nextCourseText}>+ Nouvelle ligne "À SUIVRE"</Text>
        </TouchableOpacity>
      </ScrollView>

      {feedback && (
        <View style={styles.feedback}><Text style={styles.feedbackText}>{feedback}</Text></View>
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

      {/* Move item modal - kept as fallback */}
      <Modal visible={!!moveItem} transparent animationType="fade" onRequestClose={() => setMoveItem(null)}>
        <View style={styles.modalBack}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Déplacer l'article</Text>
            <Text style={styles.modalText} numberOfLines={2}>{moveItem?.item_name}</Text>
            <Text style={styles.modalLabel}>Vers quelle ligne ?</Text>
            <View style={styles.courseChips}>
              {courses.map(c => (
                <TouchableOpacity
                  key={c}
                  testID={`move-to-${c}`}
                  style={[styles.courseChip, moveItem?.course === c && styles.courseChipCurrent]}
                  onPress={() => moveItemToCourse(c)}
                >
                  <Text style={styles.courseChipText}>{c === 1 ? "EN DIRECT" : `À suivre ${c - 1}`}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={[styles.mBtn, styles.btnSecondary, { marginTop: 14 }]} onPress={() => setMoveItem(null)}>
              <Text style={styles.btnSecondaryText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Close modal */}
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
  empty: { alignItems: "center", marginTop: 60, gap: 12 },
  emptyText: { color: COLORS.textSecondary, textAlign: "center", paddingHorizontal: 40 },
  courseBlock: { marginBottom: 14 },
  courseHeader: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: COLORS.bg, borderRadius: 8, borderLeftWidth: 4, borderLeftColor: COLORS.text, marginBottom: 6 },
  courseHeaderActive: { backgroundColor: COLORS.primary, borderLeftColor: COLORS.primaryDark },
  courseHeaderDrop: { backgroundColor: "#FEF3C7", borderLeftColor: COLORS.warning, borderWidth: 2, borderColor: COLORS.warning, paddingVertical: 14 },
  courseLabel: { fontSize: 12, fontWeight: "900", letterSpacing: 1, color: COLORS.text, flex: 1 },
  courseLabelActive: { color: "#fff" },
  courseLabelDrop: { color: COLORS.primary, fontSize: 13 },
  courseTag: { fontSize: 10, fontWeight: "700", color: "#fff", opacity: 0.85 },
  coursePlaceholder: { fontSize: 12, color: COLORS.textSecondary, fontStyle: "italic", paddingHorizontal: 12, paddingVertical: 8 },
  item: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 12, marginBottom: 6, gap: 8, borderWidth: 1, borderColor: COLORS.border },
  itemPending: { borderColor: COLORS.primary, borderWidth: 2 },
  itemDragging: { borderColor: COLORS.warning, borderWidth: 3, transform: [{ scale: 1.02 }], shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  draggingTag: { fontSize: 10, fontWeight: "900", color: COLORS.warning, marginTop: 4, letterSpacing: 0.5 },
  itemName: { fontSize: 15, fontWeight: "700", color: COLORS.text },
  opt: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  note: { fontSize: 12, color: COLORS.warning, marginTop: 2, fontStyle: "italic" },
  pendingTag: { fontSize: 10, fontWeight: "800", color: COLORS.primary, marginTop: 4, letterSpacing: 0.5 },
  qtyBox: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.bg, borderRadius: 10 },
  qBtn: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  qty: { fontWeight: "800", fontSize: 14, width: 20, textAlign: "center" },
  price: { fontWeight: "800", fontSize: 13, color: COLORS.text },
  moveBtn: { flexDirection: "row", alignItems: "center", gap: 2, marginTop: 4, paddingVertical: 2 },
  moveBtnText: { fontSize: 10, fontWeight: "700", color: COLORS.primary },
  nextCourseBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 14, borderRadius: 12, borderWidth: 2, borderStyle: "dashed", borderColor: COLORS.primary, backgroundColor: "#F0F5FF", marginTop: 4 },
  nextCourseText: { fontWeight: "800", color: COLORS.primary, fontSize: 14 },
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
  modalText: { fontSize: 14, color: COLORS.textSecondary, marginTop: 8, marginBottom: 14, textAlign: "center", lineHeight: 20 },
  modalLabel: { fontSize: 12, fontWeight: "800", color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10, marginTop: 4 },
  courseChips: { gap: 8 },
  courseChip: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, borderWidth: 2, borderColor: COLORS.border, alignItems: "center" },
  courseChipCurrent: { backgroundColor: COLORS.successBg, borderColor: COLORS.success },
  courseChipText: { fontWeight: "800", color: COLORS.text, fontSize: 15 },
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
ve: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontWeight: "800", color: COLORS.text },
  chipTextActive: { color: "#fff" },
});
