"""Tests for restaurant ordering API (no auth)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL", "https://cafe-menu-mobile-1.preview.emergentagent.com").rstrip("/")
API = BASE_URL + "/api"


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---------- Menu ----------
class TestMenu:
    def test_menu_returns_13_categories(self, session):
        r = session.get(f"{API}/menu", timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) == 13, f"Expected 13 categories, got {len(data)}"
        keys = {c["key"] for c in data}
        assert {"aperitifs", "tapas", "entrees", "plats", "desserts",
                "boissons_fraiches", "boissons_chaudes", "vins_verre",
                "vins_rouge", "vins_blanc", "vins_rose", "champagnes", "digestifs"}.issubset(keys)

    def test_items_have_ids_and_option_groups(self, session):
        cats = session.get(f"{API}/menu").json()
        plats = next(c for c in cats if c["key"] == "plats")
        entrecote = next(i for i in plats["items"] if "Entrecôte" in i["name"])
        assert "id" in entrecote
        assert entrecote["price"] == 28.0
        og = entrecote["option_groups"][0]
        assert og["name"] == "Cuisson"
        assert "Saignant" in og["choices"]
        moules = next(i for i in plats["items"] if i["name"] == "Moules")
        assert moules["option_groups"][0]["name"] == "Sauce"


# ---------- Tables ----------
class TestTables:
    def test_list_12_tables_free(self, session):
        r = session.get(f"{API}/tables")
        assert r.status_code == 200
        tables = r.json()
        assert len(tables) >= 12
        nums = sorted([t["number"] for t in tables])[:12]
        assert nums == list(range(1, 13))


# ---------- Full Order Flow ----------
class TestOrderFlow:
    @pytest.fixture(scope="class")
    def ctx(self, session):
        # Find a free table
        tables = session.get(f"{API}/tables").json()
        free = next((t for t in tables if t["status"] == "free"), None)
        assert free, "No free table available for test"
        return {"table": free, "session": session}

    def test_01_open_order(self, ctx):
        s = ctx["session"]
        t = ctx["table"]
        r = s.post(f"{API}/tables/{t['id']}/order?covers=4")
        assert r.status_code == 200, r.text
        order = r.json()
        assert order["status"] == "open"
        assert order["covers"] == 4
        assert order["table_number"] == t["number"]
        ctx["order_id"] = order["id"]
        # verify table now occupied
        tt = next(x for x in s.get(f"{API}/tables").json() if x["id"] == t["id"])
        assert tt["status"] == "occupied"
        assert tt["current_order_id"] == order["id"]

    def test_02_add_item_entrecote(self, ctx):
        s = ctx["session"]
        body = {
            "item_name": "Entrecôte beurre ail estragon",
            "category_key": "plats",
            "unit_price": 28.0,
            "quantity": 1,
            "options": [{"group": "Cuisson", "value": "Saignant"}],
        }
        r = s.post(f"{API}/orders/{ctx['order_id']}/items", json=body)
        assert r.status_code == 200, r.text
        item = r.json()
        assert item["item_name"] == "Entrecôte beurre ail estragon"
        ctx["item_id"] = item["id"]
        # verify via GET
        o = s.get(f"{API}/orders/{ctx['order_id']}").json()
        assert o["total"] == 28.0
        assert len(o["items"]) == 1

    def test_03_update_quantity(self, ctx):
        s = ctx["session"]
        r = s.put(f"{API}/orders/{ctx['order_id']}/items/{ctx['item_id']}/quantity?quantity=2")
        assert r.status_code == 200
        o = s.get(f"{API}/orders/{ctx['order_id']}").json()
        assert o["items"][0]["quantity"] == 2
        assert o["total"] == 56.0

    def test_04_send_marks_sent(self, ctx):
        s = ctx["session"]
        r = s.post(f"{API}/orders/{ctx['order_id']}/send")
        assert r.status_code == 200
        o = s.get(f"{API}/orders/{ctx['order_id']}").json()
        assert all(i["sent"] is True for i in o["items"])

    def test_05_list_orders_filter(self, ctx):
        s = ctx["session"]
        opened = s.get(f"{API}/orders?status=open").json()
        assert any(o["id"] == ctx["order_id"] for o in opened)
        closed = s.get(f"{API}/orders?status=closed").json()
        assert all(o["status"] == "closed" for o in closed)

    def test_06_delete_item(self, ctx):
        s = ctx["session"]
        # add a second item to delete
        body = {"item_name": "Frites maison", "category_key": "tapas", "unit_price": 5.30, "quantity": 1}
        item = s.post(f"{API}/orders/{ctx['order_id']}/items", json=body).json()
        r = s.delete(f"{API}/orders/{ctx['order_id']}/items/{item['id']}")
        assert r.status_code == 200
        o = s.get(f"{API}/orders/{ctx['order_id']}").json()
        assert all(i["id"] != item["id"] for i in o["items"])

    def test_07_close_order_frees_table(self, ctx):
        s = ctx["session"]
        r = s.post(f"{API}/orders/{ctx['order_id']}/close")
        assert r.status_code == 200
        o = s.get(f"{API}/orders/{ctx['order_id']}").json()
        assert o["status"] == "closed"
        assert o.get("closed_at") is not None
        tt = next(x for x in s.get(f"{API}/tables").json() if x["id"] == ctx["table"]["id"])
        assert tt["status"] == "free"
        assert tt["current_order_id"] is None
        assert tt["covers"] == 0


class TestErrors:
    def test_open_order_unknown_table(self, session):
        r = session.post(f"{API}/tables/unknown-id/order?covers=2")
        assert r.status_code == 404

    def test_get_unknown_order(self, session):
        r = session.get(f"{API}/orders/unknown-id")
        assert r.status_code == 404
