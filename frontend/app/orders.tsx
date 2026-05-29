import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { api, COLORS, fmtPrice } from "@/src/api";

type Order = {
  id: string; table_number: number; covers: number; status: string;
  items: { item_name: string; quantity: number; unit_price: number }[];
  total: number; created_at: string; closed_at?: string;
};

export default function Orders() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [tab, setTab] = useState<"open" | "closed">("open");

  useEffect(() => { api(`/orders?status=${tab}`).then(setOrders); }, [tab]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity testID="orders-back-btn" onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Commandes</Text>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, tab === "open" && styles.tabActive]} onPress={() => setTab("open")}>
          <Text style={[styles.tabText, tab === "open" && styles.tabTextActive]}>En cours</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === "closed" && styles.tabActive]} onPress={() => setTab("closed")}>
          <Text style={[styles.tabText, tab === "closed" && styles.tabTextActive]}>Clôturées</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {orders.length === 0 && <Text style={styles.empty}>Aucune commande</Text>}
        {orders.map(o => (
          <TouchableOpacity
            key={o.id}
            testID={`order-${o.id}`}
            style={styles.card}
            onPress={() => o.status === "open" && router.push(`/order/${o.id}`)}
          >
            <View style={styles.rowBetween}>
              <Text style={styles.cardTable}>Table {o.table_number}</Text>
              <Text style={styles.cardTotal}>{fmtPrice(o.total)}</Text>
            </View>
            <Text style={styles.cardMeta}>{o.covers} couverts · {o.items.length} articles · {new Date(o.created_at).toLocaleString("fr-FR")}</Text>
            <View style={styles.itemsList}>
              {o.items.slice(0, 4).map((it, i) => (
                <Text key={i} style={styles.itemLine}>{it.quantity}× {it.item_name}</Text>
              ))}
              {o.items.length > 4 && <Text style={styles.itemLine}>+ {o.items.length - 4} autres…</Text>}
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: { flexDirection: "row", alignItems: "center", padding: 12, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 8 },
  backBtn: { padding: 4 },
  title: { fontSize: 22, fontWeight: "900", color: COLORS.text },
  tabs: { flexDirection: "row", padding: 10, gap: 8, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tab: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center", backgroundColor: COLORS.bg },
  tabActive: { backgroundColor: COLORS.text },
  tabText: { fontWeight: "800", color: COLORS.textSecondary },
  tabTextActive: { color: "#fff" },
  list: { padding: 12, paddingBottom: 40 },
  empty: { textAlign: "center", marginTop: 60, color: COLORS.textSecondary },
  card: { backgroundColor: COLORS.surface, padding: 14, borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTable: { fontSize: 18, fontWeight: "900", color: COLORS.text },
  cardTotal: { fontSize: 18, fontWeight: "900", color: COLORS.primary },
  cardMeta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
  itemsList: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: COLORS.border, gap: 3 },
  itemLine: { fontSize: 13, color: COLORS.text },
});
