import { useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { api, COLORS, CATEGORY_COLORS, fmtPrice } from "@/src/api";

type OrderItem = {
  id: string; item_name: string; category_key: string; unit_price: number;
  quantity: number; options: { group: string; value: string }[]; note: string; sent: boolean;
};
type Order = { id: string; table_number: number; covers: number; status: string; items: OrderItem[]; total: number };

export default function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<Order | null>(null);

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
    Alert.alert("Envoyé", "Commande marquée comme envoyée en cuisine/bar.");
    load();
  };

  const closeOrder = () => {
    Alert.alert("Clôturer la table ?", `Total : ${fmtPrice(order?.total || 0)}`, [
      { text: "Annuler", style: "cancel" },
      { text: "Clôturer", style: "destructive", onPress: async () => {
        await api(`/orders/${id}/close`, { method: "POST" });
        router.replace("/");
      }},
    ]);
  };

  if (!order) {
    return <SafeAreaView style={styles.safe}><Text style={styles.loading}>Chargement…</Text></SafeAreaView>;
  }

  // Group items by category
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
          <Text style={styles.subtitle}>{order.covers} couverts · {order.items.length} articles</Text>
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
          const cat = items[0];
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
          <TouchableOpacity testID="close-btn" style={[styles.btn, styles.btnDanger]} onPress={closeOrder}>
            <Ionicons name="checkmark-done" size={18} color="#fff" />
            <Text style={styles.btnDangerText}>Clôturer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  loading: { textAlign: "center", marginTop: 40, color: COLORS.textSecondary },
  header: { flexDirection: "row", alignItems: "center", padding: 12, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 8 },
  backBtn: { padding: 4 },
  title: { fontSize: 22, fontWeight: "900", color: COLORS.text },
  subtitle: { fontSize: 12, color: COLORS.textSecondary },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12 },
  addBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
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
});
