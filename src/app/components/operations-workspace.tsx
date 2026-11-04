"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Icon } from "@/app/components/ui-icon";
import { OperationsProvider, useOperationsStore } from "@/app/components/operations-store";
import {
  guestRooms,
  type HousekeepingTask,
  type InventoryItem,
  type MenuItem,
  type OrderStatus,
  type RestaurantOrder,
  type StaffShift,
  type TaskStatus,
} from "@/lib/operations-data";

type ModuleName = "housekeeping" | "inventory" | "restaurant";
type Props = { module: ModuleName; roleName: string; userName: string; asOfDate: string };
type Tab = { id: string; label: string };

const taskStatuses: TaskStatus[] = ["Pending", "Assigned", "In Progress", "Completed", "Inspected", "Cancelled"];
const orderStatuses: OrderStatus[] = ["New Order", "Confirmed", "Preparing", "Ready", "Served", "Completed", "Cancelled"];
const menuCategories = ["Breakfast", "Lunch", "Dinner", "Main Courses", "Appetizers", "Desserts", "Beverages", "Snacks"];
const currency = (amount: number) => new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR", maximumFractionDigits: 0 }).format(amount);

function Badge({ children }: { children: ReactNode }) {
  const label = String(children);
  return <span className={`ops-badge ops-badge-${label.toLowerCase().replaceAll(" ", "-")}`}>{children}</span>;
}

function Metric({ label, value, detail, icon }: { label: string; value: string | number; detail: string; icon: "users" | "building" | "check" | "alert" | "wallet" | "activity" }) {
  return <article className="ops-metric"><span className="ops-metric-icon"><Icon name={icon} size={18} /></span><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

function PanelHeading({ eyebrow, title, detail, action }: { eyebrow: string; title: string; detail?: string; action?: ReactNode }) {
  return <div className="ops-panel-heading"><div><span className="panel-overline">{eyebrow}</span><h2>{title}</h2>{detail && <p>{detail}</p>}</div>{action}</div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="ops-field"><span>{label}</span>{children}</label>;
}

function shiftsOverlap(startA: string, endA: string, startB: string, endB: string) {
  const minutes = (value: string) => {
    const [hours, mins] = value.split(":").map(Number);
    return hours * 60 + mins;
  };
  const segments = (start: string, end: string) => {
    const from = minutes(start);
    const to = minutes(end);
    return to > from ? [[from, to]] : [[from, 1440], [0, to]];
  };
  return segments(startA, endA).some(([fromA, toA]) =>
    segments(startB, endB).some(([fromB, toB]) => fromA < toB && fromB < toA),
  );
}

function requiredIngredients(lines: RestaurantOrder["items"], menu: MenuItem[]) {
  const amounts = new Map<string, number>();
  for (const line of lines) {
    const dish = menu.find((entry) => entry.id === line.menuItemId);
    for (const ingredient of dish?.ingredients ?? []) {
      amounts.set(ingredient.itemId, (amounts.get(ingredient.itemId) ?? 0) + ingredient.quantity * line.quantity);
    }
  }
  return [...amounts].map(([itemId, amount]) => ({ itemId, amount }));
}

function RoomServiceContent({ notify }: { notify: (message: string) => void }) {
  const { inventory, menu, orders, setOrders, roomBalances, setRoomBalances } = useOperationsStore();
  const [room, setRoom] = useState(guestRooms[0].room);
  const [itemId, setItemId] = useState(menu[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [cart, setCart] = useState<{ menuItemId: string; quantity: number }[]>([]);
  const [instructions, setInstructions] = useState("");
  const [billing, setBilling] = useState<"Charge to room" | "Direct payment">("Charge to room");
  const guest = guestRooms.find((entry) => entry.room === room) ?? guestRooms[0];
  const item = menu.find((entry) => entry.id === itemId);
  const isAvailable = (entry: MenuItem) => entry.available && entry.ingredients.every(({ itemId: ingredientId, quantity: required }) => {
    const stock = inventory.find(({ id }) => id === ingredientId)?.quantity ?? 0;
    return stock >= required;
  });
  const roomOrders = orders.filter((order) => order.type === "Room service").sort((a, b) => b.id.localeCompare(a.id));

  function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const required = requiredIngredients(cart, menu);
    if (!cart.length || cart.some((line) => !menu.find((entry) => entry.id === line.menuItemId)?.available) ||
      required.some(({ itemId, amount }) => (inventory.find((entry) => entry.id === itemId)?.quantity ?? 0) < amount)) {
      notify("Add available menu items to the order before submitting.");
      return;
    }
    const total = cart.reduce((sum, line) => sum + (menu.find((entry) => entry.id === line.menuItemId)?.price ?? 0) * line.quantity, 0);
    const id = `ORD-${Date.now().toString().slice(-5)}`;
    const order: RestaurantOrder = {
      id, type: "Room service", guest: guest.guest, room: guest.room,
      items: cart, instructions: instructions.trim(),
      total, createdAt: new Intl.DateTimeFormat("en-LK", { hour: "2-digit", minute: "2-digit" }).format(new Date()),
      status: "New Order", deliveryStatus: "Waiting", billing, reservation: guest.reservation,
    };
    setOrders((current) => [order, ...current]);
    if (billing === "Charge to room") {
      setRoomBalances((current) => ({ ...current, [guest.room]: (current[guest.room] ?? guest.balance) + total }));
    }
    setInstructions("");
    setQuantity(1);
    setCart([]);
    notify(`Room service order ${id} sent to the kitchen.`);
  }

  return (
    <div className="ops-content-grid">
      <section className="panel ops-panel">
        <PanelHeading eyebrow="RECEPTION ORDER ENTRY" title="Create room service order" detail="Guest and active reservation details are filled from the selected room." />
        <form className="ops-form-grid" onSubmit={submitOrder}>
          <Field label="Guest room"><select value={room} onChange={(event) => setRoom(event.target.value)}>{guestRooms.map((entry) => <option key={entry.room} value={entry.room}>Room {entry.room}</option>)}</select></Field>
          <Field label="Guest"><input value={guest.guest} readOnly /></Field>
          <Field label="Reservation"><input value={guest.reservation} readOnly /></Field>
          <Field label="Outstanding balance"><input value={currency(roomBalances[guest.room] ?? guest.balance)} readOnly /></Field>
          <Field label="Menu item"><select value={itemId} onChange={(event) => setItemId(event.target.value)}>{menu.map((entry) => <option key={entry.id} value={entry.id} disabled={!isAvailable(entry)}>{entry.name} · {currency(entry.price)}{!isAvailable(entry) ? " · unavailable" : ""}</option>)}</select></Field>
          <Field label="Quantity"><input type="number" min="1" max="20" value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value)))} required /></Field>
          <button type="button" className="outline-button ops-add-cart" disabled={!item || !isAvailable(item)} onClick={() => {
            if (!item) return;
            setCart((current) => {
              const found = current.find((line) => line.menuItemId === item.id);
              return found
                ? current.map((line) => line.menuItemId === item.id ? { ...line, quantity: line.quantity + quantity } : line)
                : [...current, { menuItemId: item.id, quantity }];
            });
          }}>Add item</button>
          <div className="ops-cart-lines">{cart.map((line) => <div key={line.menuItemId}><span>{menu.find((entry) => entry.id === line.menuItemId)?.name} × {line.quantity}</span><button type="button" aria-label="Remove item" onClick={() => setCart((current) => current.filter((entry) => entry.menuItemId !== line.menuItemId))}>Remove</button></div>)}</div>
          <Field label="Billing method"><select value={billing} onChange={(event) => setBilling(event.target.value as typeof billing)}><option>Charge to room</option><option>Direct payment</option></select></Field>
          <Field label="Special instructions"><input value={instructions} onChange={(event) => setInstructions(event.target.value)} placeholder="Allergies, no onions, extra sauce..." /></Field>
          <div className="ops-form-footer"><strong>Order total <span>{currency(cart.reduce((sum, line) => sum + (menu.find((entry) => entry.id === line.menuItemId)?.price ?? 0) * line.quantity, 0))}</span></strong><button className="primary-button" type="submit" disabled={!cart.length}><Icon name="check" size={15} /> Send to kitchen</button></div>
          {billing === "Charge to room" && cart.length > 0 && <p className="ops-helper ops-full">This adds {currency(cart.reduce((sum, line) => sum + (menu.find((entry) => entry.id === line.menuItemId)?.price ?? 0) * line.quantity, 0))} to reservation {guest.reservation}.</p>}
        </form>
      </section>
      <section className="panel ops-panel">
        <PanelHeading eyebrow="LIVE ORDER TRACKING" title="Room service orders" detail={`${roomOrders.length} order${roomOrders.length === 1 ? "" : "s"} in this demo workspace`} />
        <div className="ops-order-list">{roomOrders.map((order) => (
          <article className="ops-order-card" key={order.id}>
            <div className="ops-order-top"><div><strong>{order.id}</strong><span>Room {order.room} · {order.guest}</span></div><Badge>{order.deliveryStatus ?? "Waiting"}</Badge></div>
            <p>{order.items.map((line) => `${menu.find((entry) => entry.id === line.menuItemId)?.name ?? "Menu item"} × ${line.quantity}`).join(", ")}</p>
            {order.instructions && <small>Note: {order.instructions}</small>}
            <div className="ops-order-bottom"><span>{currency(order.total)} · {order.billing ?? "Direct payment"} · {order.createdAt}</span><span className="ops-delivery-flow">{order.status}</span></div>
          </article>
        ))}</div>
        <p className="ops-helper">Kitchen and delivery updates appear here as soon as staff change the order status.</p>
      </section>
    </div>
  );
}

export function RoomServiceWorkspace() {
  const [toast, setToast] = useState("");
  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  }
  return <><RoomServiceContent notify={notify} />{toast && <div className="room-toast" role="status"><Icon name="check" size={16} /><span>{toast}</span><button aria-label="Dismiss notification" onClick={() => setToast("")}><Icon name="close" size={14} /></button></div>}</>;
}

export function OperationsWorkspace({ module, roleName, userName, asOfDate }: Props) {
  const { rooms, reservations, setRooms, employees, setEmployees, tasks, setTasks, shifts, setShifts, inventory, setInventory, requests, setRequests, movements, setMovements, menu, setMenu, orders, setOrders } = useOperationsStore();
  const isManager = ["Hotel Manager", "Super Admin", "Housekeeping Manager", "Inventory Manager", "Restaurant Manager"].includes(roleName);
  const housekeepingTabs: Tab[] = isManager
    ? [{ id: "dashboard", label: "Dashboard" }, { id: "tasks", label: "Cleaning tasks" }, { id: "staff", label: "Staff & shifts" }, { id: "inspections", label: "Inspections" }, { id: "my-work", label: "My workspace" }]
    : [{ id: "my-work", label: "My tasks" }, { id: "tasks", label: "Task board" }, { id: "staff", label: "My shifts" }];
  const inventoryTabs: Tab[] = [{ id: "dashboard", label: "Dashboard" }, { id: "items", label: "All inventory" }, { id: "requests", label: "Stock requests" }, { id: "movements", label: "Stock movements" }];
  const restaurantTabs: Tab[] = [{ id: "dashboard", label: "Dashboard" }, { id: "menu", label: "Menu management" }, { id: "orders", label: "Orders" }, { id: "kitchen", label: "Kitchen display" }, { id: "delivery", label: "Room service delivery" }];
  const tabs = module === "housekeeping" ? housekeepingTabs : module === "inventory" ? inventoryTabs : restaurantTabs;
  const allowedTaskStatuses = isManager ? taskStatuses : taskStatuses.filter((status) => ["Assigned", "In Progress", "Completed"].includes(status));
  const [tab, setTab] = useState(tabs[0].id);
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("All departments");
  const [categoryFilter, setCategoryFilter] = useState("All categories");
  const [toast, setToast] = useState("");
  const [taskDraft, setTaskDraft] = useState({ room: "", description: "", assignee: "", priority: "Normal" as HousekeepingTask["priority"], dueTime: "" });
  const [shiftDraft, setShiftDraft] = useState({ employee: employees[0]?.name ?? "", date: new Date().toISOString().slice(0, 10), start: "06:00", end: "14:00", breakMinutes: 30 });
  const [shiftPeriod, setShiftPeriod] = useState<"Daily" | "Weekly" | "Monthly">("Weekly");
  const [requestDraft, setRequestDraft] = useState({ itemId: inventory[0]?.id ?? "", quantity: 1, reason: "" });
  const [itemDraft, setItemDraft] = useState({ name: "", category: "Cleaning Supplies", department: "Hotel", quantity: 0, unit: "pieces", minimum: 5, maximum: 100, unitCost: 0, supplier: "New supplier", expiryDate: "", location: "Hotel store" });
  const [editingInventoryId, setEditingInventoryId] = useState<string | null>(null);
  const [itemFormOpen, setItemFormOpen] = useState(false);
  const [menuDraft, setMenuDraft] = useState({ name: "", category: "Main Courses", price: 0, minutes: 15, description: "" });
  const [menuIngredients, setMenuIngredients] = useState<MenuItem["ingredients"]>([
    { itemId: inventory.find((entry) => entry.department === "Restaurant")?.id ?? "", quantity: 0.1 },
  ]);
  const [editingMenuId, setEditingMenuId] = useState<string | null>(null);
  const [menuFormOpen, setMenuFormOpen] = useState(false);
  const [orderDraft, setOrderDraft] = useState({ menuItemId: menu[0]?.id ?? "", quantity: 1, type: "Dine-in" as RestaurantOrder["type"], guest: "", room: "", table: "", instructions: "" });
  const [allowStockOverride, setAllowStockOverride] = useState(false);
  const [staffName, setStaffName] = useState("");
  const [issueDraft, setIssueDraft] = useState({ room: "", description: "" });

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  };
  const pendingTasks = tasks.filter((task) => ["Pending", "Assigned", "In Progress"].includes(task.status));
  const lowStock = inventory.filter((item) => item.quantity <= item.minimum);
  const restaurantLowStock = lowStock.filter((item) => item.department === "Restaurant");
  const expiryCutoff = Date.parse(`${asOfDate}T00:00:00Z`) + 30 * 86_400_000;
  const nearExpiry = inventory.filter((item) => item.expiryDate && Date.parse(`${item.expiryDate}T00:00:00Z`) <= expiryCutoff);
  const pendingRequests = requests.filter((request) => request.status === "Pending");
  const todayOrders = orders.filter((order) => order.status !== "Cancelled");
  const availableMenu = (item: MenuItem) => item.available && item.ingredients.every((ingredient) =>
    (inventory.find((stock) => stock.id === ingredient.itemId)?.quantity ?? 0) >= ingredient.quantity,
  );
  const filteredTasks = tasks.filter((task) => `${task.id} ${task.room} ${task.assignee} ${task.description}`.toLowerCase().includes(query.toLowerCase()));
  const filteredInventory = inventory.filter((item) =>
    `${item.id} ${item.name} ${item.category} ${item.supplier}`.toLowerCase().includes(query.toLowerCase()) &&
    (department === "All departments" || item.department === department) &&
    (categoryFilter === "All categories" || item.category === categoryFilter),
  );
  const requestDetails = (requestId: string) => requests.find((entry) => entry.id === requestId);
  const taskId = () => `HK-T${Date.now().toString().slice(-4)}`;

  function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const task: HousekeepingTask = {
      id: taskId(), room: taskDraft.room.trim(), roomType: "Guest room", description: taskDraft.description.trim(),
      assignee: taskDraft.assignee || "Unassigned", priority: taskDraft.priority,
      createdAt: new Intl.DateTimeFormat("en-LK", { hour: "2-digit", minute: "2-digit" }).format(new Date()),
      dueTime: taskDraft.dueTime || "5:00 PM", status: taskDraft.assignee ? "Assigned" : "Pending",
    };
    setTasks((current) => [task, ...current]);
    setTaskDraft({ room: "", description: "", assignee: "", priority: "Normal", dueTime: "" });
    notify(`Cleaning task ${task.id} created.`);
  }

  function reportRoomIssue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const room = issueDraft.room.trim();
    if (!room || !issueDraft.description.trim()) {
      notify("Enter a room number and describe the damaged item or maintenance issue.");
      return;
    }
    const task: HousekeepingTask = {
      id: taskId(), room, roomType: rooms.find((entry) => entry.number === room)?.type ?? "Guest room",
      description: `Maintenance report: ${issueDraft.description.trim()}`, assignee: "Unassigned",
      priority: "High", createdAt: new Intl.DateTimeFormat("en-LK", { hour: "2-digit", minute: "2-digit" }).format(new Date()),
      dueTime: "5:00 PM", status: "Pending",
    };
    setTasks((current) => [task, ...current]);
    setRooms((current) => current.map((entry) => entry.number === room ? { ...entry, status: "Maintenance" } : entry));
    setIssueDraft({ room: "", description: "" });
    notify(`Maintenance request ${task.id} reported for room ${room}.`);
  }

  function createShift(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const overlaps = shifts.some((shift) => shift.employee === shiftDraft.employee && shift.date === shiftDraft.date && shift.status !== "Off" &&
      shiftsOverlap(shiftDraft.start, shiftDraft.end, shift.start, shift.end));
    if (overlaps) {
      notify("This employee already has an overlapping shift on that date.");
      return;
    }
    const shift: StaffShift = { ...shiftDraft, id: `SH-${Date.now().toString().slice(-5)}`, status: "Scheduled" };
    setShifts((current) => [shift, ...current]);
    notify(`Shift scheduled for ${shift.employee}.`);
  }

  function updateShift(shift: StaffShift, changes: Partial<StaffShift>) {
    const updated = { ...shift, ...changes };
    const conflict = shifts.some((other) => other.id !== shift.id && other.employee === updated.employee &&
      other.date === updated.date && other.status !== "Off" && updated.status !== "Off" &&
      shiftsOverlap(updated.start, updated.end, other.start, other.end));
    if (conflict) {
      notify(`${updated.employee} already has an overlapping shift on ${updated.date}.`);
      return;
    }
    setShifts((current) => current.map((entry) => entry.id === shift.id ? updated : entry));
  }

  function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const item = inventory.find((entry) => entry.id === requestDraft.itemId);
    if (!item || requestDraft.quantity < 1 || !requestDraft.reason.trim()) {
      notify("Choose an item, quantity, and reason for the request.");
      return;
    }
    setRequests((current) => [{
      id: `SR-${Date.now().toString().slice(-4)}`, department: item.department,
      requestedBy: userName,
      itemId: item.id, quantity: Number(requestDraft.quantity), reason: requestDraft.reason.trim(), status: "Pending",
    }, ...current]);
    setRequestDraft({ ...requestDraft, reason: "", quantity: 1 });
    notify("Stock request sent to the inventory manager.");
  }

  function updateRequest(requestId: string, action: "Approved" | "Rejected" | "Issued" | "Completed") {
    const request = requestDetails(requestId);
    if (!request) return;
    if (action === "Issued") {
      const item = inventory.find((entry) => entry.id === request.itemId);
      if (!item || item.quantity < request.quantity) {
        notify("Not enough stock is available to issue this request.");
        return;
      }
      setInventory((current) => current.map((entry) => entry.id === item.id ? { ...entry, quantity: entry.quantity - request.quantity } : entry));
      setMovements((current) => [{
        id: `MOV-${Date.now().toString().slice(-5)}`, itemId: item.id, type: "Issued",
        quantity: request.quantity, detail: `Stock request ${request.id} · ${request.requestedBy}`,
        occurredAt: new Intl.DateTimeFormat("en-LK", { hour: "2-digit", minute: "2-digit" }).format(new Date()),
      }, ...current]);
    }
    setRequests((current) => current.map((entry) => entry.id === requestId ? { ...entry, status: action } : entry));
    notify(`Request ${requestId} marked ${action.toLowerCase()}.`);
  }

  function addInventoryItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!itemDraft.name.trim() || itemDraft.quantity < 0 || itemDraft.minimum < 0 || itemDraft.maximum < itemDraft.minimum || itemDraft.unitCost < 0) {
      notify("Enter a name and valid stock values; maximum stock must be at least the minimum.");
      return;
    }
    const existing = inventory.find((item) => item.id === editingInventoryId);
    const nextItem: InventoryItem = {
      id: editingInventoryId ?? `INV-${Date.now().toString().slice(-4)}`,
      name: itemDraft.name.trim(),
      category: itemDraft.category,
      department: itemDraft.department as "Hotel" | "Restaurant",
      quantity: itemDraft.quantity,
      unit: itemDraft.unit,
      minimum: itemDraft.minimum,
      maximum: itemDraft.maximum,
      unitCost: itemDraft.unitCost,
      supplier: itemDraft.supplier.trim() || "New supplier",
      location: itemDraft.location.trim() || `${itemDraft.department} store`,
      ...(itemDraft.expiryDate ? { expiryDate: itemDraft.expiryDate } : {}),
    };
    if (editingInventoryId) {
      setInventory((current) => current.map((item) => item.id === editingInventoryId ? nextItem : item));
    } else {
      setInventory((current) => [nextItem, ...current]);
    }
    if (existing && existing.quantity !== nextItem.quantity) {
      setMovements((current) => [{
        id: `MOV-${Date.now().toString().slice(-5)}`, itemId: nextItem.id, type: "Adjustment",
        quantity: Math.abs(nextItem.quantity - existing.quantity), detail: "Item details updated",
        occurredAt: new Intl.DateTimeFormat("en-LK", { hour: "2-digit", minute: "2-digit" }).format(new Date()),
      }, ...current]);
    }
    setEditingInventoryId(null);
    setItemFormOpen(false);
    setItemDraft({ ...itemDraft, name: "", quantity: 0, expiryDate: "" });
    notify(existing ? "Inventory item updated." : "Inventory item added.");
  }

  function updateStock(itemId: string, amount: number) {
    setInventory((current) => current.map((item) => item.id === itemId ? { ...item, quantity: Math.max(0, item.quantity + amount) } : item));
    const item = inventory.find((entry) => entry.id === itemId);
    if (item && (amount > 0 || item.quantity > 0)) setMovements((current) => [{
      id: `MOV-${Date.now().toString().slice(-5)}`, itemId, type: amount > 0 ? "Received" : "Used",
      quantity: Math.abs(amount), detail: amount > 0 ? "Manual stock receipt" : "Manual stock usage",
      occurredAt: new Intl.DateTimeFormat("en-LK", { hour: "2-digit", minute: "2-digit" }).format(new Date()),
    }, ...current]);
  }

  function openItemEditor(item?: InventoryItem) {
    setEditingInventoryId(item?.id ?? null);
    setItemDraft(item ? {
      name: item.name, category: item.category, department: item.department,
      quantity: item.quantity, unit: item.unit, minimum: item.minimum, maximum: item.maximum,
      unitCost: item.unitCost, supplier: item.supplier, expiryDate: item.expiryDate ?? "", location: item.location,
    } : {
      name: "", category: "Cleaning Supplies", department: "Hotel",
      quantity: 0, unit: "pieces", minimum: 5, maximum: 100, unitCost: 0, supplier: "New supplier", expiryDate: "", location: "Hotel store",
    });
    setItemFormOpen(true);
  }

  function createMenuItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!menuDraft.name.trim() || menuDraft.price <= 0 || !menuIngredients.some((ingredient) => ingredient.itemId && ingredient.quantity > 0)) {
      notify("Add a menu name, selling price, and at least one required ingredient.");
      return;
    }
    const newItem: MenuItem = {
      id: editingMenuId ?? `MENU-${Date.now().toString().slice(-4)}`, name: menuDraft.name.trim(), category: menuDraft.category,
      description: menuDraft.description.trim(), price: menuDraft.price, minutes: menuDraft.minutes, available: true,
      ingredients: menuIngredients.filter((ingredient) => ingredient.itemId && ingredient.quantity > 0),
    };
    if (editingMenuId) {
      setMenu((current) => current.map((item) => item.id === editingMenuId ? { ...newItem, available: item.available } : item));
    } else {
      setMenu((current) => [newItem, ...current]);
    }
    setEditingMenuId(null);
    setMenuFormOpen(false);
    setMenuDraft({ ...menuDraft, name: "", description: "" });
    setMenuIngredients([{ itemId: inventory.find((entry) => entry.department === "Restaurant")?.id ?? "", quantity: 0.1 }]);
    notify(editingMenuId ? "Menu item updated." : "Menu item added.");
  }

  function createOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const item = menu.find((entry) => entry.id === orderDraft.menuItemId);
    const stockShort = item
      ? requiredIngredients([{ menuItemId: item.id, quantity: orderDraft.quantity }], menu)
        .some((ingredient) => (inventory.find((entry) => entry.id === ingredient.itemId)?.quantity ?? 0) < ingredient.amount)
      : false;
    if (!item || !item.available || (stockShort && !(isManager && allowStockOverride))) {
      notify("Order blocked: the selected menu item has insufficient ingredients.");
      return;
    }
    if (orderDraft.type === "Room service" && !orderDraft.room.trim()) {
      notify("Enter the guest room number for room service.");
      return;
    }
    const order: RestaurantOrder = {
      id: `ORD-${Date.now().toString().slice(-5)}`, type: orderDraft.type,
      guest: orderDraft.guest.trim() || (orderDraft.type === "Dine-in" ? `Walk-in · Table ${orderDraft.table || "—"}` : "Takeaway guest"),
      ...(orderDraft.type === "Dine-in" && orderDraft.table ? { table: orderDraft.table } : {}),
      ...(orderDraft.type === "Room service" ? { room: orderDraft.room, deliveryStatus: "Waiting" as const, billing: "Direct payment" as const } : {}),
      items: [{ menuItemId: item.id, quantity: orderDraft.quantity }], instructions: orderDraft.instructions.trim(),
      total: item.price * orderDraft.quantity, createdAt: new Intl.DateTimeFormat("en-LK", { hour: "2-digit", minute: "2-digit" }).format(new Date()), status: "New Order",
      stockOverride: stockShort && allowStockOverride,
    };
    setOrders((current) => [order, ...current]);
    notify(`Order ${order.id} sent to the kitchen.`);
  }

  function changeOrderStatus(order: RestaurantOrder, status: OrderStatus): boolean {
    if (status === "Completed" && !order.stockUsed) {
      const needs = requiredIngredients(order.items, menu);
      if (!order.stockOverride && needs.some((need) => (inventory.find((entry) => entry.id === need.itemId)?.quantity ?? 0) < need.amount)) {
        notify("Order completion blocked: ingredient stock is insufficient.");
        return false;
      }
      setInventory((current) => current.map((stock) => {
        const used = needs.filter((need) => need.itemId === stock.id).reduce((sum, need) => sum + need.amount, 0);
        return used ? { ...stock, quantity: order.stockOverride ? stock.quantity - used : Math.max(0, stock.quantity - used) } : stock;
      }));
      setMovements((current) => [...needs.map((need, index) => ({
        id: `MOV-${Date.now().toString().slice(-5)}-${index}`, itemId: need.itemId, type: "Used" as const,
        quantity: need.amount, detail: `Restaurant order ${order.id}`,
        occurredAt: new Intl.DateTimeFormat("en-LK", { hour: "2-digit", minute: "2-digit" }).format(new Date()),
      })), ...current]);
    }
    setOrders((current) => current.map((entry) => entry.id === order.id ? {
      ...entry, status, stockUsed: status === "Completed" ? true : entry.stockUsed,
      deliveryStatus: entry.type === "Room service" && status === "Ready" ? "Ready" : entry.deliveryStatus,
    } : entry));
    notify(`Order ${order.id} updated to ${status}.`);
    return true;
  }

  const housekeepingStats = useMemo(() => ({
    available: employees.filter((person) => person.availability === "Available" && person.status === "Active").length,
    onShift: shifts.filter((shift) => shift.status === "In progress").length,
    roomsToClean: new Set(pendingTasks.map((task) => task.room)).size,
    ready: tasks.filter((task) => task.status === "Inspected").length,
  }), [employees, pendingTasks, shifts, tasks]);

  const tabsForTitle = { housekeeping: "Housekeeping", inventory: "Central inventory", restaurant: "Restaurant" } as const;
  const descriptions = {
    housekeeping: "Coordinate room readiness, cleaning assignments, staff shifts and inspections.",
    inventory: "One stock room for hotel supplies and restaurant ingredients, requests and movements.",
    restaurant: "Manage the menu, guest orders, kitchen workflow and room service delivery.",
  } as const;

  return (
    <div className="ops-workspace">
      <div className="page-heading ops-heading">
        <div><div className="breadcrumb">Workspace <Icon name="chevron" size={14} /> Operations <Icon name="chevron" size={14} /> {tabsForTitle[module]}</div><h1>{tabsForTitle[module]}</h1><p>{descriptions[module]}</p></div>
        <span className="ops-demo-tag"><i /> FRONTEND DEMO · LOCAL STATE</span>
      </div>
      <nav className="ops-tabs" aria-label={`${tabsForTitle[module]} sections`}>
        {tabs.map((entry) => <button key={entry.id} className={entry.id === tab ? "active" : ""} onClick={() => setTab(entry.id)}>{entry.label}</button>)}
      </nav>

      {module === "housekeeping" && <>
        {tab === "dashboard" && <div className="ops-dashboard">
          <div className="ops-metric-grid">
            <Metric label="Housekeeping employees" value={employees.length} detail="Team members" icon="users" />
            <Metric label="Available now" value={housekeepingStats.available} detail="Ready to be assigned" icon="check" />
            <Metric label="On shift" value={housekeepingStats.onShift} detail="Scheduled today" icon="activity" />
            <Metric label="Pending tasks" value={pendingTasks.length} detail="Awaiting completion" icon="alert" />
            <Metric label="Completed today" value={tasks.filter((task) => task.status === "Completed" || task.status === "Inspected").length} detail="Includes inspected rooms" icon="check" />
            <Metric label="Rooms requiring cleaning" value={housekeepingStats.roomsToClean} detail="Unique room assignments" icon="building" />
            <Metric label="Ready for guests" value={housekeepingStats.ready} detail="Supervisor inspected" icon="building" />
            <Metric label="Maintenance flags" value={tasks.filter((task) => /damage|maintenance/i.test(task.description) && !["Completed", "Inspected", "Cancelled"].includes(task.status)).length} detail="Reported by housekeeping" icon="alert" />
          </div>
          <div className="ops-content-grid">
            <section className="panel ops-panel"><PanelHeading eyebrow="TEAM ACTIVITY" title="Today at a glance" detail="Operational progress across the housekeeping team." />
              <div className="ops-bars">{["Pending", "Assigned", "In Progress", "Completed", "Inspected"].map((status) => {
                const count = tasks.filter((task) => task.status === status).length;
                return <div key={status} className="ops-bar-row"><span>{status}</span><i><b style={{ width: `${Math.max(4, count / Math.max(1, tasks.length) * 100)}%` }} /></i><strong>{count}</strong></div>;
              })}</div>
            </section>
            <section className="panel ops-panel"><PanelHeading eyebrow="ROOMS NEEDING ATTENTION" title="Priority activity" />
              {tasks.filter((task) => task.status === "Pending" || task.priority === "Urgent").slice(0, 4).map((task) => <div className="ops-activity-row" key={task.id}><span className="ops-activity-icon"><Icon name="alert" size={15} /></span><div><strong>Room {task.room} · {task.priority} priority</strong><small>{task.description}</small></div><Badge>{task.status}</Badge></div>)}
            </section>
          </div>
        </div>}
        {(tab === "tasks" || tab === "my-work" || tab === "inspections") && <section className="panel ops-panel">
          <PanelHeading eyebrow={tab === "inspections" ? "SUPERVISOR APPROVAL" : "ROOM OPERATIONS"} title={tab === "my-work" ? "My assigned tasks" : tab === "inspections" ? "Cleaning inspections" : "Cleaning task board"} detail="Checkout and guest cleaning requests appear here; changes are held in local demo state."
            action={isManager && tab !== "inspections" ? <details className="ops-pop-form"><summary className="primary-button">+ New task</summary><form onSubmit={createTask} className="ops-form-grid">
              <Field label="Room number"><input required value={taskDraft.room} onChange={(event) => setTaskDraft({ ...taskDraft, room: event.target.value })} placeholder="e.g. 205" /></Field>
              <Field label="Assigned housekeeper"><select value={taskDraft.assignee} onChange={(event) => setTaskDraft({ ...taskDraft, assignee: event.target.value })}><option value="">Unassigned</option>{employees.map((person) => <option key={person.id}>{person.name}</option>)}</select></Field>
              <Field label="Priority"><select value={taskDraft.priority} onChange={(event) => setTaskDraft({ ...taskDraft, priority: event.target.value as HousekeepingTask["priority"] })}>{["Low", "Normal", "High", "Urgent"].map((priority) => <option key={priority}>{priority}</option>)}</select></Field>
              <Field label="Due by"><input type="time" value={taskDraft.dueTime} onChange={(event) => setTaskDraft({ ...taskDraft, dueTime: event.target.value })} /></Field>
              <Field label="Instructions"><input required value={taskDraft.description} onChange={(event) => setTaskDraft({ ...taskDraft, description: event.target.value })} placeholder="Cleaning instructions" /></Field>
              <button className="primary-button" type="submit">Create task</button>
            </form></details> : undefined} />
          <div className="ops-toolbar"><label className="ops-search"><Icon name="search" size={16} /><input placeholder="Search rooms, staff or tasks..." value={query} onChange={(event) => setQuery(event.target.value)} /></label><span>{filteredTasks.length} tasks</span></div>
          <div className="table-scroll"><table className="ops-table"><thead><tr><th>TASK / ROOM</th><th>INSTRUCTIONS</th><th>ASSIGNEE</th><th>PRIORITY</th><th>DUE</th><th>STATUS</th></tr></thead><tbody>
            {filteredTasks.filter((task) => isManager || task.assignee === userName).filter((task) => tab !== "my-work" || task.assignee === userName).filter((task) => tab !== "inspections" || task.status === "Completed" || task.status === "Inspected").map((task) => <tr key={task.id}>
              <td><strong>{task.id}</strong><small>Room {task.room} · {task.roomType}</small></td><td>{task.description}</td>
              <td>{isManager ? <select aria-label={`Assign ${task.id}`} value={task.assignee} onChange={(event) => setTasks((current) => current.map((entry) => entry.id === task.id ? { ...entry, assignee: event.target.value, status: entry.status === "Pending" ? "Assigned" : entry.status } : entry))}><option>Unassigned</option>{employees.map((person) => <option key={person.id}>{person.name}</option>)}</select> : task.assignee}</td>
              <td><Badge>{task.priority}</Badge></td><td>{task.dueTime}</td>
              <td>{!isManager && ["Inspected", "Cancelled"].includes(task.status) ? <Badge>{task.status}</Badge> : <select aria-label={`Update status for ${task.id}`} value={task.status} onChange={(event) => {
                const status = event.target.value as TaskStatus;
                setTasks((current) => current.map((entry) => entry.id === task.id ? { ...entry, status } : entry));
                if (status === "Inspected") {
                  const activeStay = reservations.find((entry) => entry.roomNumber === task.room && ["Confirmed", "Checked In"].includes(entry.status));
                  setRooms((current) => current.map((room) => room.number === task.room
                    ? { ...room, status: activeStay?.status === "Checked In" ? "Occupied" : activeStay ? "Reserved" : "Available" }
                    : room));
                } else if (status === "Completed" && /maintenance report|damaged|damage/i.test(task.description)) {
                  setRooms((current) => current.map((room) => room.number === task.room ? { ...room, status: "Maintenance" } : room));
                }
                notify(status === "Completed" ? `Room ${task.room} is ready for supervisor inspection.` : `Task ${task.id} updated.`);
              }}>{(tab === "inspections" ? ["Inspected", "Completed"] : allowedTaskStatuses).map((status) => <option key={status}>{status}</option>)}</select>}</td>
            </tr>)}
          </tbody></table></div>
          {tab === "my-work" && <form className="ops-inline-form" onSubmit={submitRequest}><strong>Request cleaning supplies</strong><select aria-label="Supply item" value={requestDraft.itemId} onChange={(event) => setRequestDraft({ ...requestDraft, itemId: event.target.value })}>{inventory.filter((item) => item.department === "Hotel").map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><input aria-label="Requested quantity" type="number" min="1" value={requestDraft.quantity} onChange={(event) => setRequestDraft({ ...requestDraft, quantity: Number(event.target.value) })} /><input aria-label="Reason" placeholder="Room / reason" required value={requestDraft.reason} onChange={(event) => setRequestDraft({ ...requestDraft, reason: event.target.value })} /><button className="outline-button" type="submit">Submit request</button></form>}
          {tab === "my-work" && <form className="ops-inline-form" onSubmit={reportRoomIssue}><strong>Report room damage or maintenance</strong><input aria-label="Room number for issue" required placeholder="Room" value={issueDraft.room} onChange={(event) => setIssueDraft({ ...issueDraft, room: event.target.value })} /><input aria-label="Describe room issue" required placeholder="Damaged item or issue" value={issueDraft.description} onChange={(event) => setIssueDraft({ ...issueDraft, description: event.target.value })} /><button className="outline-button" type="submit">Report issue</button></form>}
        </section>}
        {tab === "staff" && <div className="ops-dashboard">
          <section className="panel ops-panel"><PanelHeading eyebrow="HOUSEKEEPING TEAM" title={isManager ? "Staff management" : "My shift schedule"} detail={`${employees.length} employees · individual workloads update with task assignments`}
            action={isManager ? <details className="ops-pop-form"><summary className="primary-button">+ Add housekeeper</summary><form className="ops-form-grid" onSubmit={(event) => {
              event.preventDefault();
              if (!staffName.trim()) return;
              const person = { id: `HK-${Date.now().toString().slice(-4)}`, name: staffName.trim(), phone: "+94 77 000 0000", email: `${staffName.trim().toLowerCase().replaceAll(" ", ".")}@aurelia.example`, position: "Room Attendant", department: "Housekeeping", status: "Active" as const, shift: "Morning", availability: "Available" as const };
              setEmployees((current) => [person, ...current]);
              setStaffName("");
              notify("Housekeeper added to the team.");
            }}><Field label="Employee name"><input required value={staffName} onChange={(event) => setStaffName(event.target.value)} /></Field><button className="primary-button" type="submit">Add employee</button></form></details> : undefined} />
            <div className="table-scroll"><table className="ops-table"><thead><tr><th>EMPLOYEE</th><th>CONTACT</th><th>POSITION / DEPARTMENT</th><th>SHIFT</th><th>AVAILABILITY</th><th>OPEN TASKS</th><th>COMPLETED</th></tr></thead><tbody>{employees.map((person) => <tr key={person.id}><td><span className="ops-person"><i>{person.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</i><span><strong>{person.name}</strong><small>{person.id} · {person.status}</small></span></span></td><td>{isManager ? <input className="ops-cell-input" aria-label={`${person.name} phone`} value={person.phone} onChange={(event) => setEmployees((current) => current.map((entry) => entry.id === person.id ? { ...entry, phone: event.target.value } : entry))} /> : person.phone}<small>{person.email}</small></td><td>{isManager ? <select aria-label={`${person.name} position`} value={person.position} onChange={(event) => setEmployees((current) => current.map((entry) => entry.id === person.id ? { ...entry, position: event.target.value } : entry))}><option>Room Attendant</option><option>Housekeeping Supervisor</option><option>Public Area Attendant</option></select> : person.position}<small>{person.department}</small></td><td>{isManager ? <select aria-label={`${person.name} assigned shift`} value={person.shift} onChange={(event) => setEmployees((current) => current.map((entry) => entry.id === person.id ? { ...entry, shift: event.target.value } : entry))}><option>Morning</option><option>Afternoon</option><option>Night</option><option>Custom</option></select> : person.shift}</td><td>{isManager ? <select aria-label={`${person.name} availability`} value={person.availability} onChange={(event) => setEmployees((current) => current.map((entry) => entry.id === person.id ? { ...entry, availability: event.target.value as typeof person.availability } : entry))}><option>Available</option><option>On task</option><option>Off duty</option></select> : <Badge>{person.availability}</Badge>}</td><td>{tasks.filter((task) => task.assignee === person.name && ["Pending", "Assigned", "In Progress"].includes(task.status)).length}</td><td>{tasks.filter((task) => task.assignee === person.name && ["Completed", "Inspected"].includes(task.status)).length}</td></tr>)}</tbody></table></div>
          </section>
          <section className="panel ops-panel"><PanelHeading eyebrow="SHIFT ROSTER" title="Shift scheduling" detail="Morning, afternoon, night, and custom start/end times are supported."
            action={isManager ? <details className="ops-pop-form"><summary className="outline-button">+ Schedule shift</summary><form className="ops-form-grid" onSubmit={createShift}>
              <Field label="Employee"><select value={shiftDraft.employee} onChange={(event) => setShiftDraft({ ...shiftDraft, employee: event.target.value })}>{employees.map((person) => <option key={person.id}>{person.name}</option>)}</select></Field>
              <Field label="Date"><input type="date" value={shiftDraft.date} onChange={(event) => setShiftDraft({ ...shiftDraft, date: event.target.value })} required /></Field>
              <Field label="Start"><input type="time" value={shiftDraft.start} onChange={(event) => setShiftDraft({ ...shiftDraft, start: event.target.value })} required /></Field>
              <Field label="End"><input type="time" value={shiftDraft.end} onChange={(event) => setShiftDraft({ ...shiftDraft, end: event.target.value })} required /></Field>
              <Field label="Break (minutes)"><input type="number" min="0" value={shiftDraft.breakMinutes} onChange={(event) => setShiftDraft({ ...shiftDraft, breakMinutes: Number(event.target.value) })} /></Field>
              <button className="primary-button" type="submit">Save shift</button>
            </form></details> : undefined} />
            <div className="ops-shift-period">{(["Daily", "Weekly", "Monthly"] as const).map((period) => <button key={period} className={shiftPeriod === period ? "active" : ""} onClick={() => setShiftPeriod(period)}>{period}</button>)}</div>
            {shifts.filter((shift) => isManager || shift.employee === userName).filter((shift) => {
              const days = Math.floor((Date.parse(`${shift.date}T00:00:00Z`) - Date.parse(`${asOfDate}T00:00:00Z`)) / 86_400_000);
              return shiftPeriod === "Daily" ? days === 0 : shiftPeriod === "Weekly" ? days >= 0 && days < 7 : days >= 0 && days < 31;
            }).map((shift) => <div className="ops-shift-row" key={shift.id}><div className="ops-shift-fields">{isManager ? <><select aria-label={`${shift.id} employee`} value={shift.employee} onChange={(event) => updateShift(shift, { employee: event.target.value })}>{employees.map((person) => <option key={person.id}>{person.name}</option>)}</select><input aria-label={`${shift.id} date`} type="date" value={shift.date} onChange={(event) => updateShift(shift, { date: event.target.value })} /><input aria-label={`${shift.id} start time`} type="time" value={shift.start} onChange={(event) => updateShift(shift, { start: event.target.value })} /><input aria-label={`${shift.id} end time`} type="time" value={shift.end} onChange={(event) => updateShift(shift, { end: event.target.value })} /><input aria-label={`${shift.id} break minutes`} type="number" min="0" value={shift.breakMinutes} onChange={(event) => updateShift(shift, { breakMinutes: Number(event.target.value) })} /></> : <><span className="ops-shift-date">{new Intl.DateTimeFormat("en-LK", { month: "short", day: "numeric" }).format(new Date(`${shift.date}T00:00:00`))}</span><div><strong>{shift.employee}</strong><small>{shift.start} – {shift.end} · {shift.breakMinutes}m break</small></div></>}</div>{isManager ? <select aria-label={`${shift.id} status`} value={shift.status} onChange={(event) => updateShift(shift, { status: event.target.value as StaffShift["status"] })}>{["Scheduled", "In progress", "Completed", "Off"].map((status) => <option key={status}>{status}</option>)}</select> : <Badge>{shift.status}</Badge>}</div>)}
          </section>
        </div>}
      </>}

      {module === "inventory" && <>
        {tab === "dashboard" && <div className="ops-dashboard">
          <div className="ops-metric-grid">
            <Metric label="Inventory items" value={inventory.length} detail="Across hotel and restaurant" icon="building" />
            <Metric label="Total stock value" value={currency(inventory.reduce((sum, item) => sum + item.quantity * item.unitCost, 0))} detail="Estimated on-hand value" icon="wallet" />
            <Metric label="Available stock" value={inventory.filter((item) => item.quantity > item.minimum).length} detail="Above minimum level" icon="check" />
            <Metric label="Low stock" value={lowStock.length} detail="At or below minimum" icon="alert" />
            <Metric label="Out of stock" value={inventory.filter((item) => item.quantity === 0).length} detail="Needs replenishment" icon="alert" />
            <Metric label="Pending requests" value={pendingRequests.length} detail="Awaiting manager review" icon="activity" />
          </div>
          {(lowStock.length > 0 || nearExpiry.length > 0) && <div className="ops-alert"><Icon name="alert" size={17} /><span><strong>Stock attention required</strong>{lowStock.slice(0, 4).map((item) => `${item.name} (${item.quantity} ${item.unit})`).join(" · ")}{nearExpiry.length > 0 && ` · ${nearExpiry.length} item(s) expiring within 30 days`}</span></div>}
          <div className="ops-content-grid"><section className="panel ops-panel"><PanelHeading eyebrow="STOCK OVERVIEW" title="Stock by department" />
            {(["Hotel", "Restaurant"] as const).map((name) => {
              const count = inventory.filter((item) => item.department === name).length;
              const value = inventory.filter((item) => item.department === name).reduce((sum, item) => sum + item.quantity * item.unitCost, 0);
              return <div className="ops-department" key={name}><span className="ops-dept-icon"><Icon name={name === "Hotel" ? "building" : "wallet"} size={17} /></span><span><strong>{name}</strong><small>{count} items · {currency(value)} stock value</small></span><i><b style={{ width: `${count / inventory.length * 100}%` }} /></i></div>;
            })}
          </section><section className="panel ops-panel"><PanelHeading eyebrow="LATEST REQUESTS" title="Needs approval" />
            {requests.filter((request) => request.status === "Pending").map((request) => <div className="ops-activity-row" key={request.id}><span className="ops-activity-icon"><Icon name="activity" size={15} /></span><div><strong>{requestDetails(request.id)?.requestedBy} · {inventory.find((entry) => entry.id === request.itemId)?.name}</strong><small>{request.quantity} requested · {request.reason}</small></div><Badge>{request.status}</Badge></div>)}
          </section></div>
        </div>}
        {(tab === "items" || tab === "movements") && <section className="panel ops-panel">
          <PanelHeading eyebrow="CENTRAL HOTEL & RESTAURANT STOCK" title={tab === "items" ? "All inventory" : "Recent stock movements"} detail="Hotel and restaurant departments share one inventory list."
            action={tab === "items" ? <button className="primary-button" onClick={() => openItemEditor()}>+ Add item</button> : undefined} />
          {tab === "items" && itemFormOpen && <form className="ops-menu-editor ops-form-grid" onSubmit={addInventoryItem}>
            <Field label="Item name"><input required value={itemDraft.name} onChange={(event) => setItemDraft({ ...itemDraft, name: event.target.value })} /></Field>
            <Field label="Department"><select value={itemDraft.department} onChange={(event) => setItemDraft({ ...itemDraft, department: event.target.value, category: event.target.value === "Hotel" ? "Cleaning Supplies" : "Vegetables", location: `${event.target.value} store` })}><option>Hotel</option><option>Restaurant</option></select></Field>
            <Field label="Category"><select value={itemDraft.category} onChange={(event) => setItemDraft({ ...itemDraft, category: event.target.value })}>{(itemDraft.department === "Hotel" ? ["Cleaning Supplies", "Toiletries", "Towels", "Bedsheets", "Pillows", "Guest Amenities", "Laundry Supplies", "Maintenance Materials", "Office Supplies"] : ["Vegetables", "Fruits", "Meat and Seafood", "Dairy Products", "Beverages", "Dry Food", "Spices", "Cooking Ingredients", "Packaging Materials"]).map((category) => <option key={category}>{category}</option>)}</select></Field>
            <Field label="Unit"><select value={itemDraft.unit} onChange={(event) => setItemDraft({ ...itemDraft, unit: event.target.value })}>{["pieces", "kilograms", "grams", "litres", "bottles", "packs", "boxes"].map((unit) => <option key={unit}>{unit}</option>)}</select></Field>
            <Field label="Quantity"><input type="number" min="0" value={itemDraft.quantity} onChange={(event) => setItemDraft({ ...itemDraft, quantity: Number(event.target.value) })} /></Field>
            <Field label="Minimum level"><input type="number" min="0" value={itemDraft.minimum} onChange={(event) => setItemDraft({ ...itemDraft, minimum: Number(event.target.value) })} /></Field>
            <Field label="Maximum level"><input type="number" min={itemDraft.minimum} value={itemDraft.maximum} onChange={(event) => setItemDraft({ ...itemDraft, maximum: Number(event.target.value) })} /></Field>
            <Field label="Unit cost (LKR)"><input type="number" min="0" value={itemDraft.unitCost} onChange={(event) => setItemDraft({ ...itemDraft, unitCost: Number(event.target.value) })} /></Field>
            <Field label="Supplier"><input value={itemDraft.supplier} onChange={(event) => setItemDraft({ ...itemDraft, supplier: event.target.value })} /></Field>
            <Field label="Expiry date (optional)"><input type="date" value={itemDraft.expiryDate} onChange={(event) => setItemDraft({ ...itemDraft, expiryDate: event.target.value })} /></Field>
            <Field label="Storage location"><input value={itemDraft.location} onChange={(event) => setItemDraft({ ...itemDraft, location: event.target.value })} /></Field>
            <div className="ops-editor-actions"><button type="button" className="outline-button" onClick={() => { setItemFormOpen(false); setEditingInventoryId(null); }}>Cancel</button><button className="primary-button" type="submit">{editingInventoryId ? "Save changes" : "Add item"}</button></div>
          </form>}
          {tab === "items" && <div className="ops-toolbar"><label className="ops-search"><Icon name="search" size={16} /><input placeholder="Search name, category or supplier..." value={query} onChange={(event) => setQuery(event.target.value)} /></label><select value={department} onChange={(event) => { setDepartment(event.target.value); setCategoryFilter("All categories"); }}><option>All departments</option><option>Hotel</option><option>Restaurant</option></select><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option>All categories</option>{[...new Set(inventory.filter((item) => department === "All departments" || item.department === department).map((item) => item.category))].map((category) => <option key={category}>{category}</option>)}</select><span>{filteredInventory.length} items</span></div>}
          {tab === "movements" && <div className="ops-report-grid">{(["Hotel", "Restaurant"] as const).map((departmentName) => {
            const departmentMoves = movements.filter((movement) => {
              const item = inventory.find((entry) => entry.id === movement.itemId);
              return item?.department === departmentName;
            });
            return <article className="ops-report-card" key={departmentName}><span>{departmentName} usage</span><strong>{departmentMoves.filter((movement) => movement.type === "Used" || movement.type === "Issued").length} movements</strong><small>{departmentMoves.length} total stock changes · {currency(inventory.filter((item) => item.department === departmentName).reduce((sum, item) => sum + item.quantity * item.unitCost, 0))} on hand</small></article>;
          })}</div>}
          <div className="table-scroll"><table className="ops-table"><thead><tr><th>ITEM</th><th>DEPARTMENT / CATEGORY</th><th>ON HAND</th><th>MINIMUM</th><th>UNIT COST</th><th>SUPPLIER / DETAIL</th><th>EXPIRY</th><th>STOCK STATUS</th><th>ACTIONS</th></tr></thead><tbody>
            {(tab === "items" ? filteredInventory : movements.map((movement) => ({ movement, item: inventory.find((entry) => entry.id === movement.itemId) })).filter((entry) => entry.item).map(({ movement, item }) => ({
              id: movement.id, name: item!.name, department: item!.department, category: movement.type, quantity: movement.quantity,
              unit: item!.unit, minimum: item!.minimum, unitCost: item!.unitCost, location: `${movement.detail} · ${movement.occurredAt}`, supplier: movement.detail, expiryDate: undefined,
            }))).map((item) => <tr key={item.id}><td><strong>{item.name}</strong><small>{item.id} · {item.location}</small></td><td>{item.department}<small>{item.category}</small></td><td><strong>{item.quantity} {item.unit}</strong></td><td>{tab === "items" ? item.minimum : "—"}</td><td>{currency(item.unitCost)}</td><td>{item.supplier}<small>{tab === "items" ? item.location : item.category}</small></td><td>{tab === "items" ? item.expiryDate ?? "—" : "—"}</td><td>{tab === "items" && <Badge>{item.quantity <= 0 ? "Out of stock" : item.quantity <= item.minimum ? "Low stock" : "In stock"}</Badge>}</td><td>{tab === "items" && <div className="ops-adjust"><button aria-label={`Edit ${item.name}`} onClick={() => openItemEditor(inventory.find((entry) => entry.id === item.id))}>Edit</button><button aria-label={`Remove one ${item.name}`} onClick={() => updateStock(item.id, -1)}>−</button><button aria-label={`Add one ${item.name}`} onClick={() => updateStock(item.id, 1)}>+</button></div>}</td></tr>)}
          </tbody></table></div>
        </section>}
        {tab === "requests" && <div className="ops-dashboard">
          <section className="panel ops-panel"><PanelHeading eyebrow="HOUSEKEEPING & RESTAURANT" title="Stock requests" detail="Approve and issue requests from both departments."
            action={<details className="ops-pop-form"><summary className="primary-button">+ Request supplies</summary><form className="ops-form-grid" onSubmit={submitRequest}>
              <Field label="Item"><select value={requestDraft.itemId} onChange={(event) => setRequestDraft({ ...requestDraft, itemId: event.target.value })}>{inventory.map((item) => <option key={item.id} value={item.id}>{item.department} · {item.name}</option>)}</select></Field>
              <Field label="Quantity"><input type="number" min="1" value={requestDraft.quantity} onChange={(event) => setRequestDraft({ ...requestDraft, quantity: Number(event.target.value) })} /></Field>
              <Field label="Reason"><input required value={requestDraft.reason} onChange={(event) => setRequestDraft({ ...requestDraft, reason: event.target.value })} placeholder="Usage or task" /></Field>
              <button className="primary-button" type="submit">Submit request</button>
            </form></details>} />
            <div className="table-scroll"><table className="ops-table"><thead><tr><th>REQUEST</th><th>DEPARTMENT / REQUESTER</th><th>ITEM / QTY</th><th>REASON</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{requests.map((request) => {
              const item = inventory.find((entry) => entry.id === request.itemId);
              return <tr key={request.id}><td><strong>{request.id}</strong></td><td>{request.department}<small>{request.requestedBy}</small></td><td>{item?.name}<small>{request.quantity} {item?.unit}</small></td><td>{request.reason}</td><td><Badge>{request.status}</Badge></td><td>{request.status === "Pending" && <div className="ops-action-buttons"><button onClick={() => updateRequest(request.id, "Approved")}>Approve</button><button onClick={() => updateRequest(request.id, "Rejected")}>Reject</button></div>}{request.status === "Approved" && <button className="outline-button" onClick={() => updateRequest(request.id, "Issued")}>Issue stock</button>}{request.status === "Issued" && <button className="outline-button" onClick={() => updateRequest(request.id, "Completed")}>Complete</button>}</td></tr>;
            })}</tbody></table></div>
          </section>
        </div>}
      </>}

      {module === "restaurant" && <>
        {tab === "dashboard" && <div className="ops-dashboard">
          <div className="ops-metric-grid">
            <Metric label="Orders today" value={todayOrders.length} detail="Dine-in, takeaway & room service" icon="activity" />
            <Metric label="Pending" value={orders.filter((order) => order.status === "New Order" || order.status === "Confirmed").length} detail="Awaiting kitchen action" icon="alert" />
            <Metric label="Preparing" value={orders.filter((order) => order.status === "Preparing").length} detail="In the kitchen" icon="activity" />
            <Metric label="Completed" value={orders.filter((order) => order.status === "Completed").length} detail="Orders fulfilled" icon="check" />
            <Metric label="Cancelled" value={orders.filter((order) => order.status === "Cancelled").length} detail="Cancelled orders" icon="alert" />
            <Metric label="Revenue today" value={currency(orders.filter((order) => order.status === "Completed").reduce((sum, order) => sum + order.total, 0))} detail="Completed demo orders" icon="wallet" />
          </div>
          {restaurantLowStock.length > 0 && <div className="ops-alert"><Icon name="alert" size={17} /><span><strong>Low restaurant ingredients</strong>{restaurantLowStock.slice(0, 4).map((item) => `${item.name} (${item.quantity})`).join(" · ")}</span></div>}
          <div className="ops-content-grid"><section className="panel ops-panel"><PanelHeading eyebrow="SERVICE PULSE" title="Order pipeline" />
            {["New Order", "Preparing", "Ready", "Completed"].map((status) => <div className="ops-bar-row" key={status}><span>{status}</span><i><b style={{ width: `${Math.max(5, orders.filter((order) => order.status === status).length / Math.max(1, orders.length) * 100)}%` }} /></i><strong>{orders.filter((order) => order.status === status).length}</strong></div>)}
          </section><section className="panel ops-panel"><PanelHeading eyebrow="POPULAR TODAY" title="Menu activity" />
            {menu.map((item) => ({ ...item, count: orders.reduce((sum, order) => sum + order.items.filter((line) => line.menuItemId === item.id).reduce((sub, line) => sub + line.quantity, 0), 0) })).sort((a, b) => b.count - a.count).slice(0, 4).map((item) => <div className="ops-popular-row" key={item.id}><span>{item.name}</span><strong>{item.count} sold</strong></div>)}
          </section></div>
        </div>}
        {tab === "menu" && <section className="panel ops-panel"><PanelHeading eyebrow="RESTAURANT CATALOGUE" title="Menu management" detail="Out-of-stock ingredients automatically block affected dishes."
          action={<button className="primary-button" onClick={() => { setEditingMenuId(null); setMenuDraft({ name: "", category: "Main Courses", price: 0, minutes: 15, description: "" }); setMenuIngredients([{ itemId: inventory.find((entry) => entry.department === "Restaurant")?.id ?? "", quantity: 0.1 }]); setMenuFormOpen(true); }}>+ Add menu item</button>} />
          {menuFormOpen && <form className="ops-menu-editor ops-form-grid" onSubmit={createMenuItem}>
            <Field label="Food name"><input required value={menuDraft.name} onChange={(event) => setMenuDraft({ ...menuDraft, name: event.target.value })} /></Field>
            <Field label="Category"><select value={menuDraft.category} onChange={(event) => setMenuDraft({ ...menuDraft, category: event.target.value })}>{menuCategories.map((category) => <option key={category}>{category}</option>)}</select></Field>
            <Field label="Selling price (LKR)"><input type="number" min="1" value={menuDraft.price} onChange={(event) => setMenuDraft({ ...menuDraft, price: Number(event.target.value) })} required /></Field>
            <Field label="Preparation time (minutes)"><input type="number" min="1" value={menuDraft.minutes} onChange={(event) => setMenuDraft({ ...menuDraft, minutes: Number(event.target.value) })} /></Field>
            <Field label="Description"><input value={menuDraft.description} onChange={(event) => setMenuDraft({ ...menuDraft, description: event.target.value })} /></Field>
            <div className="ops-ingredient-editor"><strong>Required ingredients per serving</strong>{menuIngredients.map((ingredient, index) => <div className="ops-ingredient-row" key={`${editingMenuId ?? "new"}-${index}`}><select aria-label={`Ingredient ${index + 1}`} value={ingredient.itemId} onChange={(event) => setMenuIngredients((current) => current.map((entry, row) => row === index ? { ...entry, itemId: event.target.value } : entry))}>{inventory.filter((item) => item.department === "Restaurant").map((item) => <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>)}</select><input aria-label={`Ingredient quantity ${index + 1}`} type="number" min="0.01" step="0.01" value={ingredient.quantity} onChange={(event) => setMenuIngredients((current) => current.map((entry, row) => row === index ? { ...entry, quantity: Number(event.target.value) } : entry))} /><button type="button" aria-label="Remove ingredient" onClick={() => setMenuIngredients((current) => current.filter((_, row) => row !== index))}>Remove</button></div>)}<button type="button" className="outline-button" onClick={() => setMenuIngredients((current) => [...current, { itemId: inventory.find((item) => item.department === "Restaurant")?.id ?? "", quantity: 0.1 }])}>+ Add ingredient</button></div>
            <div className="ops-editor-actions"><button type="button" className="outline-button" onClick={() => { setMenuFormOpen(false); setEditingMenuId(null); }}>Cancel</button><button type="submit" className="primary-button">{editingMenuId ? "Save changes" : "Add to menu"}</button></div>
          </form>}
          <div className="ops-menu-grid">{menu.map((item) => <article className="ops-menu-card" key={item.id}><div className="ops-menu-art"><Icon name="wallet" size={24} /><span>{item.category}</span></div><div className="ops-menu-copy"><div><strong>{item.name}</strong><Badge>{availableMenu(item) ? "Available" : "Unavailable"}</Badge></div><p>{item.description}</p><small>{item.minutes} min · {currency(item.price)}</small><div className="ops-menu-actions"><button className="outline-button" onClick={() => {
            setEditingMenuId(item.id);
            setMenuDraft({ name: item.name, category: item.category, price: item.price, minutes: item.minutes, description: item.description });
            setMenuIngredients(item.ingredients.length ? item.ingredients : [{ itemId: inventory.find((entry) => entry.department === "Restaurant")?.id ?? "", quantity: 0.1 }]);
            setMenuFormOpen(true);
          }}>Edit</button><button className="outline-button" onClick={() => {
            setMenu((current) => current.map((entry) => entry.id === item.id ? { ...entry, available: !entry.available } : entry));
            notify(`${item.name} availability updated.`);
          }}>{item.available ? "Disable item" : "Enable item"}</button></div></div></article>)}</div>
        </section>}
        {tab === "orders" && <section className="panel ops-panel"><PanelHeading eyebrow="SERVICE ORDERS" title="Restaurant orders" detail="Create dine-in, takeaway or room service orders." action={<details className="ops-pop-form"><summary className="primary-button">+ New order</summary><form className="ops-form-grid" onSubmit={createOrder}>
          <Field label="Order type"><select value={orderDraft.type} onChange={(event) => setOrderDraft({ ...orderDraft, type: event.target.value as RestaurantOrder["type"] })}><option>Dine-in</option><option>Takeaway</option><option>Room service</option></select></Field>
          <Field label="Guest name"><input value={orderDraft.guest} onChange={(event) => setOrderDraft({ ...orderDraft, guest: event.target.value })} /></Field>
          {orderDraft.type === "Dine-in" && <Field label="Table number"><input value={orderDraft.table} onChange={(event) => setOrderDraft({ ...orderDraft, table: event.target.value })} /></Field>}
          {orderDraft.type === "Room service" && <Field label="Room number"><input required value={orderDraft.room} onChange={(event) => setOrderDraft({ ...orderDraft, room: event.target.value })} /></Field>}
          <Field label="Menu item"><select value={orderDraft.menuItemId} onChange={(event) => setOrderDraft({ ...orderDraft, menuItemId: event.target.value })}>{menu.map((item) => <option key={item.id} value={item.id} disabled={!item.available || (!availableMenu(item) && !(isManager && allowStockOverride))}>{item.name}{!availableMenu(item) ? " · low stock" : ""}</option>)}</select></Field>
          <Field label="Quantity"><input type="number" min="1" value={orderDraft.quantity} onChange={(event) => setOrderDraft({ ...orderDraft, quantity: Number(event.target.value) })} /></Field>
          <Field label="Special instructions"><input value={orderDraft.instructions} onChange={(event) => setOrderDraft({ ...orderDraft, instructions: event.target.value })} /></Field>
          {isManager && <label className="ops-override-option"><input type="checkbox" checked={allowStockOverride} onChange={(event) => setAllowStockOverride(event.target.checked)} /><span>Manager override for low ingredients</span></label>}
          <button type="submit" className="primary-button">Send order</button>
        </form></details>} />
          <div className="table-scroll"><table className="ops-table"><thead><tr><th>ORDER</th><th>TYPE / GUEST</th><th>ITEMS</th><th>TIME</th><th>TOTAL</th><th>STATUS</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td><strong>{order.id}</strong><small>{order.room ? `Room ${order.room}` : order.table ? `Table ${order.table}` : ""}</small></td><td>{order.type}<small>{order.guest}</small></td><td>{order.items.map((line) => `${menu.find((entry) => entry.id === line.menuItemId)?.name ?? "Item"} × ${line.quantity}`).join(", ")}{order.instructions && <small>Note: {order.instructions}</small>}</td><td>{order.createdAt}</td><td>{currency(order.total)}</td><td><select value={order.status} onChange={(event) => changeOrderStatus(order, event.target.value as OrderStatus)}>{orderStatuses.map((status) => <option key={status}>{status}</option>)}</select></td></tr>)}</tbody></table></div>
        </section>}
        {tab === "kitchen" && <section className="panel ops-panel"><PanelHeading eyebrow="KITCHEN DISPLAY SYSTEM" title="Live kitchen board" detail="Update an order as it moves from the pass to the guest." />
          <div className="ops-kds-grid">{(["New Order", "Preparing", "Ready", "Completed"] as const).map((status) => <section className="ops-kds-column" key={status}><h3>{status}<span>{orders.filter((order) => order.status === status).length}</span></h3>{orders.filter((order) => order.status === status).map((order) => <article className="ops-kds-card" key={order.id}><div><strong>{order.id}</strong><Badge>{order.type}</Badge></div><b>{order.room ? `Room ${order.room} · ` : order.table ? `Table ${order.table} · ` : ""}{order.guest}</b>{order.items.map((line) => <p key={line.menuItemId}>{line.quantity} × {menu.find((entry) => entry.id === line.menuItemId)?.name ?? "Menu item"}</p>)}{order.instructions && <small>Guest note: {order.instructions}</small>}<input className="ops-kds-note" aria-label={`Preparation note for ${order.id}`} placeholder="Kitchen preparation note..." value={order.preparationNotes ?? ""} onChange={(event) => setOrders((current) => current.map((entry) => entry.id === order.id ? { ...entry, preparationNotes: event.target.value } : entry))} /><select value={order.status} aria-label={`Kitchen status for ${order.id}`} onChange={(event) => changeOrderStatus(order, event.target.value as OrderStatus)}>{orderStatuses.map((item) => <option key={item}>{item}</option>)}</select></article>)}</section>)}</div>
        </section>}
        {tab === "delivery" && <section className="panel ops-panel"><PanelHeading eyebrow="ROOM SERVICE RUNNER" title="Delivery management" detail="Orders move here as soon as the kitchen marks them ready." />
          {orders.filter((order) => order.type === "Room service").map((order) => <div className="ops-delivery-row" key={order.id}><span className="ops-delivery-room">Room {order.room}</span><div><strong>{order.guest} · {order.id}</strong><small>{order.items.map((line) => `${menu.find((entry) => entry.id === line.menuItemId)?.name ?? "Item"} × ${line.quantity}`).join(", ")}</small></div><Badge>{order.deliveryStatus ?? "Waiting"}</Badge><select aria-label={`Delivery status for ${order.id}`} value={order.deliveryStatus ?? "Waiting"} onChange={(event) => {
            const deliveryStatus = event.target.value as NonNullable<RestaurantOrder["deliveryStatus"]>;
            if (deliveryStatus === "Delivered" && !changeOrderStatus(order, "Completed")) return;
            setOrders((current) => current.map((entry) => entry.id === order.id ? { ...entry, deliveryStatus, status: deliveryStatus === "Delivered" ? "Completed" : entry.status } : entry));
          }}>{["Waiting", "Ready", "Out for delivery", "Delivered"].map((status) => <option key={status}>{status}</option>)}</select></div>)}
        </section>}
      </>}
      {toast && <div className="room-toast" role="status"><Icon name="check" size={16} /><span>{toast}</span><button aria-label="Dismiss notification" onClick={() => setToast("")}><Icon name="close" size={14} /></button></div>}
    </div>
  );
}

export function OperationsModuleProvider({ children }: { children: ReactNode }) {
  return <OperationsProvider>{children}</OperationsProvider>;
}
