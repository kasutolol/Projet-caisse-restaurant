import { useEffect, useState, useRef, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Alert, Animated, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api, COLORS, CATEGORY_COLORS, fmtPrice } from "@/src/api";

type Choice = string;
type OptionGroup = { name: string; type: "single" | "multi"; required?: boolean; max?: number; choices: Choice[] };
type MenuItem = { id: string; name: string; price: number; unit?: string; option_groups?: OptionGroup[] };
type Category = { key: string; name: string; color: string; icon: string; items: MenuItem[] };
type OrderItem = {
  id: string; item_name: string; category_key: string; unit_price: number;
  quantity: number; options: { group: string; value: string }[]; course: number;
};
type Order = { id: string; items: OrderItem[]; total: number; next_course: number };

export default function MenuScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();
  const [menu, setMenu] = useState<Category[]>([]);
  const [activeCat, setActiveCat] = useState<string>("");
  const [selected, setSelected] = useState<{ cat: Category; item: MenuItem } | null>(null);
  const [optionValues, setOptionValues] = useState<Record<string, string[]>>({});
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showCart, setShowCart] = useState(false);
  const [flashId, setFlashId] = useState<string | null>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;

  const loadOrder = useCallback(async () => {
    if (!orderId) return;
    try { setOrder(await api(`/orders/${orderId}`)); } catch (e) {}
  }, [orderId]);

  useEffect(() => {
    api("/menu").then((m: Category[]) => {
      setMenu(m);
      if (m.length) setActiveCat(m[0].key);
    });
    loadOrder();
  }, [loadOrder]);

  const current = menu.find(c => c.key === activeCat);

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

  const triggerToast = (text: string, itemId: string) => {
    setToast(text);
    setFlashId(itemId);
    toastAnim.setValue(0);
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1100),
      Animated.timing(toastAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => setToast(null));
    setTimeout(() => setFlashId(null), 500);
  };

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
      if (cur.includes(choice)) return { ...prev, [group.name]: cur.filter(c => c !== choice) };
      if (group.max && cur.length >= group.max) return prev;
      return { ...prev, [group.name]: [...cur, choice] };
    });
  };

  const confirmAdd = () => {
    if (!selected) return;
    const { cat, item } = selected;
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
    triggerToast(`+1 ${item.name}`, item.id);
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
    loadOrder();
  };

  const addNextCourse = async () => {
    await api(`/orders/${orderId}/next-course`, { method: "POST" });
    triggerToast(`✓ Ligne "À SUIVRE" créée`, "next-course");
    loadOrder();
  };

  const removeItem = async (itemId: string) => {
    await api(`/orders/${orderId}/items/${itemId}`, { method: "DELETE" });
    loadOrder();
  };

  // Full order summary (all courses combined)
  const allItems = order?.items || [];
  const totalCount = allItems.reduce((s, i) => s + i.quantity, 0);
  const totalPrice = allItems.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  // Items in current active course only (for the "last added" hint)
  const currentCourseItems = allItems.filter(i => (i.course || 1) === (order?.next_course || 1));
  const lastItem = currentCourseItems[currentCourseItems.length - 1] || allItems[allItems.length - 1];
  // Group all items by course for the cart modal
  const allCourses = Array.from(new Set(allItems.map(i => i.course || 1))).sort((a, b) => a - b);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity testID="menu-back-btn" onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={28} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Menu</Text>
        <TouchableOpacity testID="menu-next-course-btn" style={styles.nextCourseHeaderBtn} onPress={addNextCourse}>
          <Ionicons name="arrow-forward-circle" size={18} color="#fff" />
          <Text style={styles.nextCourseHeaderBtnText}>À suivre</Text>
        </TouchableOpacity>
        <TouchableOpacity testID="view-order-btn" style={styles.viewOrderBtn} onPress={() => router.back()}>
          <Ionicons name="checkmark" size={18} color="#fff" />
          <Text style={styles.viewOrderBtnText}>Terminé</Text>
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

      <ScrollView contentContainerStyle={[styles.itemsGrid, { paddingBottom: 120 }]} keyboardShouldPersistTaps="handled">
        {isSearching ? (
          searchResults.length === 0 ? (
            <Text style={styles.noResults}>Aucun article ne correspond à "{search}"</Text>
          ) : (
            searchResults.map(({ cat, item: it }) => {
              const col = CATEGORY_COLORS[cat.color] || CATEGORY_COLORS.boissons;
              const hasOpts = it.option_groups && it.option_groups.length > 0;
              const isFlashing = flashId === it.id;
              return (
                <Pressable
                  testID={`search-item-${it.id}`}
                  key={it.id}
                  style={({ pressed }) => [
                    styles.itemCard,
                    { borderTopColor: col.border },
                    pressed && styles.itemCardPressed,
                    isFlashing && styles.itemCardFlash,
                  ]}
                  onPress={() => openItem(cat, it)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName} numberOfLines={3}>{it.name}</Text>
                    <Text style={[styles.itemUnit, { color: col.text, fontWeight: "700" }]}>{cat.name}{it.unit ? ` · ${it.unit}` : ""}</Text>
                  </View>
                  <View style={styles.itemFoot}>
                    <Text style={styles.itemPrice}>{fmtPrice(it.price)}</Text>
                    {hasOpts && <Ionicons name="options-outline" size={14} color={COLORS.textSecondary} />}
                  </View>
                </Pressable>
              );
            })
          )
        ) : (
          current?.items.map(it => {
            const col = CATEGORY_COLORS[current.color] || CATEGORY_COLORS.boissons;
            const hasOpts = it.option_groups && it.option_groups.length > 0;
            const isFlashing = flashId === it.id;
            return (
              <Pressable
                testID={`item-${it.id}`}
                key={it.id}
                style={({ pressed }) => [
                  styles.itemCard,
                  { borderTopColor: col.border },
                  pressed && styles.itemCardPressed,
                  isFlashing && styles.itemCardFlash,
                ]}
                onPress={() => openItem(current, it)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName} numberOfLines={3}>{it.name}</Text>
                  {!!it.unit && <Text style={styles.itemUnit}>{it.unit}</Text>}
                </View>
                <View style={styles.itemFoot}>
                  <Text style={styles.itemPrice}>{fmtPrice(it.price)}</Text>
                  {hasOpts && <Ionicons name="options-outline" size={14} color={COLORS.textSecondary} />}
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      {/* Floating toast */}
      {toast && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.toast,
            {
              opacity: toastAnim,
              transform: [{
                translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }),
              }],
            },
          ]}
        >
          <Ionicons name="checkmark-circle" size={20} color="#fff" />
          <Text style={styles.toastText}>{toast}</Text>
        </Animated.View>
      )}

      {/* Sticky cart preview: shows FULL order live */}
      <TouchableOpacity
        testID="cart-preview-btn"
        activeOpacity={0.85}
        style={styles.cartBar}
        onPress={() => totalCount > 0 && setShowCart(true)}
      >
        <View style={styles.cartBadge}>
          <Text style={styles.cartBadgeText}>{totalCount}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.cartTitle}>
            {totalCount === 0 ? "Aucun article ajouté" : `Commande : ${fmtPrice(totalPrice)}`}
          </Text>
          <Text style={styles.cartSub} numberOfLines={1}>
            {totalCount === 0
              ? "Touchez un produit pour l'ajouter"
              : lastItem
                ? `Dernier : ${lastItem.item_name} · ${totalCount} art. · voir détail`
                : `${totalCount} articles`}
          </Text>
        </View>
        {totalCount > 0 && <Ionicons name="chevron-up" size={22} color="#fff" />}
      </TouchableOpacity>

      {/* Cart modal: shows ALL items grouped by course */}
      <Modal visible={showCart} transparent animationType="slide" onRequestClose={() => setShowCart(false)}>
        <View style={styles.modalBack}>
          <View style={styles.cartSheet}>
            <View style={styles.cartSheetHeader}>
              <View>
                <Text style={styles.cartSheetTitle}>Commande en cours</Text>
                <Text style={styles.cartSheetSub}>{totalCount} article{totalCount > 1 ? "s" : ""} · {fmtPrice(totalPrice)}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowCart(false)}>
                <Ionicons name="close" size={26} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 420 }}>
              {allCourses.map(c => {
                const itemsOfCourse = allItems.filter(i => (i.course || 1) === c);
                if (itemsOfCourse.length === 0) return null;
                const isActive = c === (order?.next_course || 1);
                const label = c === 1 ? "EN DIRECT" : `À SUIVRE ${c - 1}`;
                return (
                  <View key={c} style={styles.courseGroup}>
                    <View style={[styles.courseGroupHeader, isActive && styles.courseGroupHeaderActive]}>
                      <Ionicons name={c === 1 ? "flash" : "arrow-forward-circle"} size={14} color={isActive ? "#fff" : COLORS.text} />
                      <Text style={[styles.courseGroupLabel, isActive && { color: "#fff" }]}>{label}</Text>
                    </View>
                    {itemsOfCourse.map(it => {
                      const col = CATEGORY_COLORS[(menu.find(m => m.key === it.category_key)?.color) || "boissons"] || CATEGORY_COLORS.boissons;
                      return (
                        <View key={it.id} style={[styles.cartItem, { borderLeftColor: col.border }]}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.cartItemName}>{it.quantity}× {it.item_name}</Text>
                            {it.options.map((o, i) => (
                              <Text key={i} style={styles.cartItemOpt}>· {o.group}: {o.value}</Text>
                            ))}
                          </View>
                          <Text style={styles.cartItemPrice}>{fmtPrice(it.unit_price * it.quantity)}</Text>
                          <TouchableOpacity onPress={() => removeItem(it.id)} style={styles.cartRemove}>
                            <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                );
              })}
            </ScrollView>
            <View style={styles.cartTotalRow}>
              <Text style={styles.cartTotalLabel}>TOTAL</Text>
              <Text style={styles.cartTotalValue}>{fmtPrice(totalPrice)}</Text>
            </View>
            <TouchableOpacity style={styles.cartCloseBtn} onPress={() => setShowCart(false)}>
              <Text style={styles.cartCloseBtnText}>Continuer à commander</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.cartCloseBtn, styles.cartDoneBtn]} onPress={() => { setShowCart(false); router.back(); }}>
              <Text style={styles.cartDoneBtnText}>✓ Terminé, voir la commande</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Options sheet */}
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
  nextCourseHeaderBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.primary, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 10 },
  nextCourseHeaderBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  viewOrderBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: COLORS.success, paddingHorizontal: 10, paddingVertical: 10, borderRadius: 10 },
  viewOrderBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  catBar: { maxHeight: 60, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  searchInput: { flex: 1, fontSize: 15, color: COLORS.text, fontWeight: "600", paddingVertical: 6 },
  clearBtn: { padding: 2 },
  noResults: { width: "100%", textAlign: "center", color: COLORS.textSecondary, padding: 40, fontStyle: "italic" },
  catBtn: { paddingHorizontal: 16, height: 44, borderRadius: 22, borderWidth: 2, alignItems: "center", justifyContent: "center", alignSelf: "center" },
  catBtnText: { fontWeight: "800", fontSize: 14 },
  itemsGrid: { padding: 10, flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 8 },
  itemCard: { width: "48.5%", minHeight: 100, backgroundColor: COLORS.surface, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, borderTopWidth: 4, padding: 10, justifyContent: "space-between" },
  itemCardPressed: { transform: [{ scale: 0.96 }], opacity: 0.85 },
  itemCardFlash: { backgroundColor: COLORS.successBg, borderColor: COLORS.success, borderWidth: 2 },
  itemName: { fontSize: 13, fontWeight: "700", color: COLORS.text, lineHeight: 17 },
  itemUnit: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  itemFoot: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
  itemPrice: { fontWeight: "900", fontSize: 14, color: COLORS.text },
  // Toast
  toast: { position: "absolute", alignSelf: "center", bottom: 95, backgroundColor: COLORS.success, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 24, flexDirection: "row", alignItems: "center", gap: 8, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  toastText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  // Cart bar
  cartBar: { position: "absolute", left: 0, right: 0, bottom: 0, backgroundColor: COLORS.text, padding: 14, paddingBottom: 22, flexDirection: "row", alignItems: "center" },
  cartBadge: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  cartBadgeText: { color: "#fff", fontWeight: "900", fontSize: 16 },
  cartTitle: { color: "#fff", fontWeight: "800", fontSize: 14 },
  cartSub: { color: "#A1A1AA", fontSize: 12, marginTop: 2 },
  // Cart sheet
  cartSheet: { backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "85%" },
  cartSheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  cartSheetTitle: { fontSize: 20, fontWeight: "900", color: COLORS.text },
  cartSheetSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  courseGroup: { marginBottom: 10 },
  courseGroupHeader: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: COLORS.bg, borderRadius: 6, marginBottom: 4 },
  courseGroupHeaderActive: { backgroundColor: COLORS.primary },
  courseGroupLabel: { fontSize: 11, fontWeight: "900", letterSpacing: 0.8, color: COLORS.text },
  cartItem: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingLeft: 10, borderLeftWidth: 4, marginBottom: 6, gap: 8 },
  cartItemName: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  cartItemOpt: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  cartItemPrice: { fontSize: 14, fontWeight: "800", color: COLORS.text },
  cartRemove: { padding: 6 },
  cartTotalRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  cartTotalLabel: { fontSize: 14, fontWeight: "800", color: COLORS.textSecondary, letterSpacing: 0.5 },
  cartTotalValue: { fontSize: 22, fontWeight: "900", color: COLORS.text },
  cartCloseBtn: { backgroundColor: COLORS.bg, padding: 16, borderRadius: 12, alignItems: "center", marginTop: 10 },
  cartCloseBtnText: { fontWeight: "800", color: COLORS.text, fontSize: 15 },
  cartDoneBtn: { backgroundColor: COLORS.success },
  cartDoneBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  // Options modal
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
