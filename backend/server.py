from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone

from menu_seed import MENU

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")


# ============ Models ============
class Table(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    number: int
    covers: int = 0
    status: str = "free"  # free | occupied
    current_order_id: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class TableUpdate(BaseModel):
    covers: Optional[int] = None
    status: Optional[str] = None
    current_order_id: Optional[str] = None


class OrderItemOption(BaseModel):
    group: str
    value: str  # for multi: comma joined


class OrderItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    item_name: str
    category_key: str
    unit_price: float
    quantity: int = 1
    options: List[OrderItemOption] = []
    note: str = ""
    sent: bool = False  # marked sent to kitchen/bar
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Order(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    table_id: str
    table_number: int
    covers: int
    items: List[OrderItem] = []
    status: str = "open"  # open | closed
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    closed_at: Optional[datetime] = None

    @property
    def total(self) -> float:
        return round(sum(i.unit_price * i.quantity for i in self.items), 2)


class OrderItemCreate(BaseModel):
    item_name: str
    category_key: str
    unit_price: float
    quantity: int = 1
    options: List[OrderItemOption] = []
    note: str = ""


class TableCreate(BaseModel):
    number: int


# ============ Helpers ============
def clean(doc: dict) -> dict:
    if not doc:
        return doc
    doc.pop("_id", None)
    return doc


# ============ Startup seed ============
@app.on_event("startup")
async def startup():
    # Seed menu (always overwrite to keep latest)
    await db.menu.delete_many({})
    for cat in MENU:
        await db.menu.insert_one({
            **cat,
            "items": [{"id": str(uuid.uuid4()), **it} for it in cat["items"]],
        })

    # Seed tables 1..12 if none
    count = await db.tables.count_documents({})
    if count == 0:
        for n in range(1, 13):
            t = Table(number=n)
            await db.tables.insert_one(t.dict())
    logging.info("Seeded menu & tables")


# ============ Menu ============
@api_router.get("/menu")
async def get_menu():
    cats = await db.menu.find({}, {"_id": 0}).to_list(1000)
    return cats


# ============ Tables ============
@api_router.get("/tables")
async def list_tables():
    tables = await db.tables.find({}, {"_id": 0}).sort("number", 1).to_list(1000)
    return tables


@api_router.post("/tables", response_model=Table)
async def add_table(body: TableCreate):
    t = Table(number=body.number)
    await db.tables.insert_one(t.dict())
    return t


@api_router.put("/tables/{table_id}")
async def update_table(table_id: str, body: TableUpdate):
    update = {k: v for k, v in body.dict().items() if v is not None}
    if update:
        await db.tables.update_one({"id": table_id}, {"$set": update})
    t = await db.tables.find_one({"id": table_id}, {"_id": 0})
    if not t:
        raise HTTPException(404, "Table introuvable")
    return t


# ============ Orders ============
@api_router.post("/tables/{table_id}/order")
async def open_order(table_id: str, covers: int):
    table = await db.tables.find_one({"id": table_id}, {"_id": 0})
    if not table:
        raise HTTPException(404, "Table introuvable")
    order = Order(table_id=table_id, table_number=table["number"], covers=covers)
    await db.orders.insert_one(order.dict())
    await db.tables.update_one(
        {"id": table_id},
        {"$set": {"status": "occupied", "covers": covers, "current_order_id": order.id}},
    )
    return clean(order.dict())


@api_router.get("/orders/{order_id}")
async def get_order(order_id: str):
    o = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Commande introuvable")
    o["total"] = round(sum(i["unit_price"] * i["quantity"] for i in o["items"]), 2)
    return o


@api_router.post("/orders/{order_id}/items")
async def add_item(order_id: str, body: OrderItemCreate):
    item = OrderItem(**body.dict())
    await db.orders.update_one(
        {"id": order_id}, {"$push": {"items": item.dict()}}
    )
    return clean(item.dict())


@api_router.delete("/orders/{order_id}/items/{item_id}")
async def remove_item(order_id: str, item_id: str):
    await db.orders.update_one(
        {"id": order_id}, {"$pull": {"items": {"id": item_id}}}
    )
    return {"ok": True}


@api_router.put("/orders/{order_id}/items/{item_id}/quantity")
async def update_qty(order_id: str, item_id: str, quantity: int):
    if quantity <= 0:
        return await remove_item(order_id, item_id)
    await db.orders.update_one(
        {"id": order_id, "items.id": item_id},
        {"$set": {"items.$.quantity": quantity}},
    )
    return {"ok": True}


@api_router.post("/orders/{order_id}/send")
async def mark_sent(order_id: str):
    """Marque tous les articles non envoyés comme envoyés (en cuisine/bar)."""
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"items.$[elem].sent": True}},
        array_filters=[{"elem.sent": False}],
    )
    return {"ok": True}


@api_router.post("/orders/{order_id}/close")
async def close_order(order_id: str):
    o = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Commande introuvable")
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"status": "closed", "closed_at": datetime.now(timezone.utc)}},
    )
    await db.tables.update_one(
        {"id": o["table_id"]},
        {"$set": {"status": "free", "covers": 0, "current_order_id": None}},
    )
    return {"ok": True}


@api_router.get("/orders")
async def list_orders(status: Optional[str] = None, limit: int = 100):
    q = {}
    if status:
        q["status"] = status
    orders = await db.orders.find(q, {"_id": 0}).sort("created_at", -1).to_list(limit)
    for o in orders:
        o["total"] = round(sum(i["unit_price"] * i["quantity"] for i in o["items"]), 2)
    return orders


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
logging.basicConfig(level=logging.INFO)


@app.on_event("shutdown")
async def shutdown():
    client.close()
