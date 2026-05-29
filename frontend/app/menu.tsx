import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api, COLORS, CATEGORY_COLORS, fmtPrice } from "@/src/api";

type Choice = string;
type OptionGroup = { name: string; type: "single" | "multi"; required?: boolean; max?: number; choices: Choice[] };
type MenuItem = { id: string; name: string; price: number; unit?: string; option_groups?: OptionGroup[] };
type Category = { key: string; name: string; color: string; icon: string; items: MenuItem[] };

export default function MenuScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const [menu, setMenu] = useState<Category[]>([]);
  const [activeCat, setActiveCat] = useState<string>("");
  const [selected, setSelected] = useState<{ cat: Category; item: MenuItem } | null>(null);
  const [optionValues, setOptionValues] = useState<Record<string, string[]>>({});
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    api("/menu").then((m: Category[]) => {
      setMenu(m);
      if (m.length) setActiveCat(m[0].key);
    });
  }, []);

  const current = menu.find(c => c.key === activeCat);

  // Search across all items (normalized, accent-insensitive)
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const searchResults: { cat: Category; item: MenuItem }[] = [];
  if (search.trim().length > 0) {
    const q = norm(search.trim());
    for (const c of menu) {
      for (const it of c.items) {
        if (norm(it.name).includes(q)) searchResults.push({ cat: c, item: it });
      }
    }
  }
  const isSearching = search.trim().length > 0;

  const openItem = (cat: Category, item: MenuItem) => {
    if (!item.option_groups || item.option_groups.length === 0) {
      addItem(cat, item, [], "");
      return;
    }
    setSelected({ cat, item });
    setOptionValues({});
    setNote("");
  };

  const toggleOption = (group: OptionGroup, choice: string) => {
    setOptionValues(prev => {
      const cur = prev[group.name] || [];
      if (group.type === "single") return { ...prev, [group.name]: [choice] };
      // multi
      if (cur.includes(choice)) return { ...prev, [group.name]: cur.filter(c => c !== choice) };
      if (group.max && cur.length >= group.max) return prev;
      return { ...prev, [group.name]: [...cur, choice] };
    });
  };

  const confirmAdd = () => {
    if (!selected) return;
    const { cat, item } = selected;
    // validate required
    for (const g of item.option_groups || []) {
      if (g.required && (!optionValues[g.name] || optionValues[g.name].length === 0)) {
        Alert.alert("Choix obligatoire", `Sélectionnez : ${g.name}`);
        return;
      }
    }
    const opts = (item.option_groups || [])
      .map(g => ({ group: g.name, values: optionValues[g.name] || [] }))
      .filter(o => o.values.length > 0)
      .map(o => ({ group: o.group, value: o.values.join(", ") }));
    addItem(cat, item, opts, note);
    setSelected(null);
  };

  const addItem = async (cat: Category, item: MenuItem, options: any[], n: string) => {
    await api(`/orders/${orderId}/items`, {
      method: "POST",
      body: JSON.stringify({
        item_name: item.name,
        category_key: cat.key,
        unit_price: item.price,
        quantity: 1,
        options,
        note: n,
      }),
    });
    // give haptic-like feedback: brief flash via Alert? Skip - just return.
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity testID="menu-back-btn" onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Menu</Text>
        <TouchableOpacity testID="view-order-btn" style={styles.viewOrderBtn} onPress={() => router.back()}>
          <Ionicons name="receipt" size={18} color="#fff" />
          <Text style={styles.viewOrderBtnText}>Commande</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={COLORS.textSecondary} />
        <TextInput
          testID="search-input"
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher un article..."
          placeholderTextColor={COLORS.textSecondary}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {!!search && (
          <TouchableOpacity testID="search-clear" onPress={() => setSearch("")} style={styles.clearBtn}>
            <Ionicons name="close-circle" size={20} color={COLORS.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {!isSearching && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catBar} contentContainerStyle={{ paddingHorizontal: 10, gap: 8 }}>
          {menu.map(c => {
            const col = CATEGORY_COLORS[c.color] || CATEGORY_COLORS.boissons;
            const isActive = activeCat === c.key;
            return (
              <TouchableOpacity
                testID={`cat-${c.key}`}
                key={c.key}
                onPress={() => setActiveCat(c.key)}
                style={[styles.catBtn, { backgroundColor: isActive ? col.bg : COLORS.surface, borderColor: isActive ? col.border : COLORS.border }]}
              >
                <Text style={[styles.catBtnText, { color: isActive ? col.text : COLORS.textSecondary }]}>{c.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <ScrollView contentContainerStyle={styles.itemsGrid} keyboardShouldPersistTaps="handled">
        {isSearching ? (
          searchResults.length === 0 ? (
            <Text style={styles.noResults}>Aucun article ne correspond à "{search}"</Text>
          ) : (
            searchResults.map(({ cat, item: it }) => {
              const col = CATEGORY_COLORS[cat.color] || CATEGORY_COLORS.boissons;
              const hasOpts = it.option_groups && it.option_groups.length > 0;
              return (
                <TouchableOpacity
                  testID={`search-item-${it.id}`}
                  key={it.id}
                  style={[styles.itemCard, { borderTopColor: col.border }]}
                  onPress={() => openItem(cat, it)}
                  activeOpacity={0.7}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName} numberOfLines={3}>{it.name}</Text>
                    <Text style={[styles.itemUnit, { color: col.text, fontWeight: "700" }]}>{cat.name}{it.unit ? ` · ${it.unit}` : ""}</Text>
                  </View>
                  <View style={styles.itemFoot}>
                    <Text style={styles.itemPrice}>{fmtPrice(it.price)}</Text>
                    {hasOpts && <Ionicons name="options-outline" size={14} color={COLORS.textSecondary} />}
                  </View>
                </TouchableOpacity>
              );
            })
          )
        ) : (
          current?.items.map(it => {
            const col = CATEGORY_COLORS[current.color] || CATEGORY_COLORS.boissons;
            const hasOpts = it.option_groups && it.option_groups.length > 0;
            return (
              <TouchableOpacity
                testID={`item-${it.id}`}
                key={it.id}
                style={[styles.itemCard, { borderTopColor: col.border }]}
                onPress={() => openItem(current, it)}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName} numberOfLines={3}>{it.name}</Text>
                  {!!it.unit && <Text style={styles.itemUnit}>{it.unit}</Text>}
                </View>
                <View style={styles.itemFoot}>
                  <Text style={styles.itemPrice}>{fmtPrice(it.price)}</Text>
                  {hasOpts && <Ionicons name="options-outline" size={14} color={COLORS.textSecondary} />}
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <Modal visible={!!selected} transparent animationType="slide" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalBack}>
          <View style={styles.sheet}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.sheetTitle}>{selected?.item.name}</Text>
              <Text style={styles.sheetPrice}>{selected && fmtPrice(selected.item.price)}</Text>

              {selected?.item.option_groups?.map(g => (
                <View key={g.name} style={styles.optGroup}>
                  <Text style={styles.optGroupLabel}>
                    {g.name} {g.required ? "*" : ""} {g.type === "multi" && g.max ? `(max ${g.max})` : ""}
                  </Text>
                  <View style={styles.chipsWrap}>
                    {g.choices.map(c => {
                      const active = (optionValues[g.name] || []).includes(c);
                      return (
                        <TouchableOpacity
                          testID={`opt-${g.name}-${c}`}
                          key={c}
                          style={[styles.optChip, active && styles.optChipActive]}
                          onPress={() => toggleOption(g, c)}
                        >
                          <Text style={[styles.optChipText, active && styles.optChipTextActive]}>{c}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              ))}

              <Text style={styles.optGroupLabel}>Note</Text>
              <TextInput
                style={styles.noteInput}
                placeholder="Ex: sans oignon, allergies..."
                placeholderTextColor={COLORS.textSecondary}
                value={note}
                onChangeText={setNote}
                multiline
              />
            </ScrollView>

            <View style={styles.sheetActions}>
              <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={() => setSelected(null)}>
                <Text style={styles.btnGhostText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity testID="validate-options-btn" style={[styles.btn, styles.btnPrimary]} onPress={confirmAdd}>
                <Ionicons name="add-circle" size={18} color="#fff" />
                <Text style={styles.btnPrimaryText}>Ajouter</Text>
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
  header: { flexDirection: "row", alignItems: "center", padding: 12, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 8 },
  backBtn: { padding: 4 },
  title: { flex: 1, fontSize: 22, fontWeight: "900", color: COLORS.text },
  viewOrderBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: COLORS.text, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  viewOrderBtnText: { color: "#fff", fontWeight: "800" },
  catBar: { maxHeight: 60, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  searchInput: { flex: 1, fontSize: 15, color: COLORS.text, fontWeight: "600", paddingVertical: 6 },
  clearBtn: { padding: 2 },
  noResults: { width: "100%", textAlign: "center", color: COLORS.textSecondary, padding: 40, fontStyle: "italic" },
  catBtn: { paddingHorizontal: 16, height: 44, borderRadius: 22, borderWidth: 2, alignItems: "center", justifyContent: "center", alignSelf: "center" },
  catBtnText: { fontWeight: "800", fontSize: 14 },
  itemsGrid: { padding: 10, flexDirection: "row", flexWrap: "wrap", gap: 8, paddingBottom: 40 },
  itemCard: { width: "48.5%", minHeight: 100, backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, borderTopWidth: 4, padding: 10, justifyContent: "space-between" },
  itemName: { fontSize: 13, fontWeight: "700", color: COLORS.text, lineHeight: 17 },
  itemUnit: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  itemFoot: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
  itemPrice: { fontWeight: "900", fontSize: 14, color: COLORS.text },
  modalBack: { flex: 1, backgroundColor: "rgba(9,9,11,0.6)", justifyContent: "flex-end" },
  sheet: { backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "90%" },
  sheetTitle: { fontSize: 22, fontWeight: "900", color: COLORS.text },
  sheetPrice: { fontSize: 18, fontWeight: "800", color: COLORS.primary, marginTop: 4, marginBottom: 14 },
  optGroup: { marginBottom: 14 },
  optGroupLabel: { fontSize: 12, fontWeight: "800", color: COLORS.textSecondary, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  optChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 22, borderWidth: 2, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  optChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  optChipText: { fontWeight: "700", color: COLORS.text, fontSize: 13 },
  optChipTextActive: { color: "#fff" },
  noteInput: { borderWidth: 2, borderColor: COLORS.border, borderRadius: 12, padding: 12, minHeight: 60, fontSize: 14, color: COLORS.text, textAlignVertical: "top" },
  sheetActions: { flexDirection: "row", gap: 10, marginTop: 16 },
  btn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 16, borderRadius: 12 },
  btnGhost: { backgroundColor: COLORS.bg },
  btnGhostText: { fontWeight: "800", color: COLORS.text },
  btnPrimary: { backgroundColor: COLORS.primary },
  btnPrimaryText: { fontWeight: "800", color: "#fff" },
});
