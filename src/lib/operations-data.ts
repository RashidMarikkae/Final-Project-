export type TaskStatus = "Pending" | "Assigned" | "In Progress" | "Completed" | "Inspected" | "Cancelled";
export type StockRequestStatus = "Pending" | "Approved" | "Rejected" | "Issued" | "Completed";
export type OrderStatus = "New Order" | "Confirmed" | "Preparing" | "Ready" | "Served" | "Completed" | "Cancelled";

export type Housekeeper = {
  id: string;
  name: string;
  phone: string;
  email: string;
  position: string;
  department: string;
  status: "Active" | "On leave";
  shift: string;
  availability: "Available" | "On task" | "Off duty";
};

export type HousekeepingTask = {
  id: string;
  room: string;
  roomType: string;
  description: string;
  assignee: string;
  priority: "Low" | "Normal" | "High" | "Urgent";
  createdAt: string;
  dueTime: string;
  status: TaskStatus;
};

export type StaffShift = {
  id: string;
  employee: string;
  date: string;
  start: string;
  end: string;
  breakMinutes: number;
  status: "Scheduled" | "In progress" | "Completed" | "Off";
};

export type InventoryItem = {
  id: string;
  name: string;
  category: string;
  department: "Hotel" | "Restaurant";
  quantity: number;
  unit: string;
  minimum: number;
  maximum: number;
  unitCost: number;
  supplier: string;
  expiryDate?: string;
  location: string;
};

export type StockRequest = {
  id: string;
  department: "Hotel" | "Restaurant";
  requestedBy: string;
  itemId: string;
  quantity: number;
  reason: string;
  status: StockRequestStatus;
};

export type StockMovement = {
  id: string;
  itemId: string;
  type: "Received" | "Issued" | "Used" | "Adjustment";
  quantity: number;
  detail: string;
  occurredAt: string;
};

export type MenuItem = {
  id: string;
  name: string;
  category: string;
  description: string;
  price: number;
  minutes: number;
  available: boolean;
  ingredients: { itemId: string; quantity: number }[];
};

export type RestaurantOrder = {
  id: string;
  type: "Dine-in" | "Takeaway" | "Room service";
  guest: string;
  table?: string;
  room?: string;
  items: { menuItemId: string; quantity: number }[];
  instructions: string;
  total: number;
  createdAt: string;
  status: OrderStatus;
  deliveryStatus?: "Waiting" | "Ready" | "Out for delivery" | "Delivered";
  billing?: "Charge to room" | "Direct payment";
  reservation?: string;
  preparationNotes?: string;
  stockUsed?: boolean;
  stockOverride?: boolean;
};

const staffNames = [
  "Amara Fernando", "Nimal Perera", "Sajani Silva", "Kasun Jayawardena", "Ruwani Dias",
  "Tharindu Gunasekara", "Ishara de Silva", "Malith Bandara", "Piumi Wickramasinghe", "Dinesh Kumara",
];

export const initialHousekeepers: Housekeeper[] = staffNames.map((name, index) => ({
  id: `HK-${String(index + 1).padStart(3, "0")}`,
  name,
  phone: `+94 77 ${String(120 + index).padStart(3, "0")} ${String(4100 + index * 13).slice(-4)}`,
  email: `${name.toLowerCase().replaceAll(" ", ".")}@aurelia.example`,
  position: index === 0 ? "Housekeeping Supervisor" : "Room Attendant",
  department: "Housekeeping",
  status: index === 8 ? "On leave" : "Active",
  shift: ["Morning", "Morning", "Afternoon", "Afternoon", "Night"][index % 5],
  availability: index % 4 === 0 ? "On task" : index % 4 === 1 ? "Off duty" : "Available",
}));

export const initialTasks: HousekeepingTask[] = [
  { id: "HK-T1042", room: "205", roomType: "Deluxe King", description: "Checkout clean · guest departed 10:15 AM", assignee: "Amara Fernando", priority: "High", createdAt: "10:18 AM", dueTime: "12:00 PM", status: "In Progress" },
  { id: "HK-T1041", room: "312", roomType: "Ocean Suite", description: "Turn-down service and fresh towels", assignee: "Sajani Silva", priority: "Normal", createdAt: "10:02 AM", dueTime: "2:00 PM", status: "Assigned" },
  { id: "HK-T1040", room: "118", roomType: "Garden Twin", description: "Departure cleaning · inspection required", assignee: "Unassigned", priority: "Urgent", createdAt: "9:45 AM", dueTime: "11:30 AM", status: "Pending" },
  { id: "HK-T1039", room: "407", roomType: "Deluxe King", description: "Guest-requested extra cleaning", assignee: "Ruwani Dias", priority: "Normal", createdAt: "9:21 AM", dueTime: "1:00 PM", status: "Completed" },
  { id: "HK-T1038", room: "221", roomType: "Garden Twin", description: "Routine occupied-room refresh", assignee: "Ishara de Silva", priority: "Low", createdAt: "8:50 AM", dueTime: "3:00 PM", status: "Inspected" },
  { id: "HK-T1037", room: "509", roomType: "Ocean Suite", description: "Report of damaged bedside lamp", assignee: "Unassigned", priority: "High", createdAt: "8:34 AM", dueTime: "12:30 PM", status: "Pending" },
  { id: "HK-T1036", room: "302", roomType: "Deluxe King", description: "New arrival preparation", assignee: "Nimal Perera", priority: "High", createdAt: "8:10 AM", dueTime: "1:00 PM", status: "Assigned" },
  { id: "HK-T1035", room: "116", roomType: "Garden Twin", description: "Post-checkout clean", assignee: "Dinesh Kumara", priority: "Normal", createdAt: "Yesterday", dueTime: "10:00 AM", status: "Completed" },
];

export const initialShifts: StaffShift[] = initialHousekeepers.slice(0, 8).map((person, index) => ({
  id: `SH-${String(index + 21).padStart(3, "0")}`,
  employee: person.name,
  date: new Date(Date.now() + (index % 3) * 86_400_000).toISOString().slice(0, 10),
  start: ["06:00", "06:00", "14:00", "14:00", "22:00"][index % 5],
  end: ["14:00", "14:00", "22:00", "22:00", "06:00"][index % 5],
  breakMinutes: 30,
  status: index === 0 ? "In progress" : "Scheduled",
}));

const hotelProducts = [
  ["All-purpose cleaner", "Cleaning Supplies", "bottles", 8], ["Glass cleaner", "Cleaning Supplies", "bottles", 6],
  ["Disinfectant concentrate", "Cleaning Supplies", "litres", 12], ["Microfiber cloths", "Cleaning Supplies", "pieces", 40],
  ["Toilet cleaner", "Cleaning Supplies", "bottles", 7], ["Hand soap", "Toiletries", "bottles", 30],
  ["Shampoo 50ml", "Toiletries", "pieces", 80], ["Conditioner 50ml", "Toiletries", "pieces", 70],
  ["Body wash 50ml", "Toiletries", "pieces", 90], ["Dental kit", "Guest Amenities", "packs", 40],
  ["Bath towels", "Towels", "pieces", 65], ["Hand towels", "Towels", "pieces", 80],
  ["Pool towels", "Towels", "pieces", 32], ["Queen bedsheets", "Bedsheets", "pieces", 38],
  ["King bedsheets", "Bedsheets", "pieces", 25], ["Pillow cases", "Pillows", "pieces", 60],
  ["Bath robes", "Guest Amenities", "pieces", 18], ["Laundry detergent", "Laundry Supplies", "kilograms", 45],
  ["Fabric softener", "Laundry Supplies", "litres", 15], ["Light bulbs LED", "Maintenance Materials", "pieces", 25],
  ["Door batteries", "Maintenance Materials", "packs", 12], ["Printer paper", "Office Supplies", "boxes", 8],
  ["Bin liners", "Cleaning Supplies", "boxes", 30], ["Air freshener", "Guest Amenities", "bottles", 20],
  ["Mattress protector", "Bedsheets", "pieces", 11],
] as const;

const restaurantProducts = [
  ["Potatoes", "Vegetables", "kilograms", 42], ["Red onions", "Vegetables", "kilograms", 18],
  ["Tomatoes", "Vegetables", "kilograms", 22], ["Lettuce", "Vegetables", "pieces", 15],
  ["Carrots", "Vegetables", "kilograms", 20], ["Oranges", "Fruits", "kilograms", 24],
  ["Bananas", "Fruits", "kilograms", 16], ["Limes", "Fruits", "kilograms", 9],
  ["Chicken breast", "Meat and Seafood", "kilograms", 26], ["Beef mince", "Meat and Seafood", "kilograms", 14],
  ["White fish fillet", "Meat and Seafood", "kilograms", 12], ["Eggs", "Dairy Products", "boxes", 11],
  ["Cheddar cheese", "Dairy Products", "kilograms", 7], ["Fresh milk", "Dairy Products", "litres", 18],
  ["Bottled water", "Beverages", "bottles", 100], ["Orange juice", "Beverages", "litres", 16],
  ["Coffee beans", "Beverages", "kilograms", 12], ["Basmati rice", "Dry Food", "kilograms", 38],
  ["Burger buns", "Dry Food", "pieces", 32], ["Pasta", "Dry Food", "kilograms", 20],
  ["Black pepper", "Spices", "grams", 1800], ["Curry powder", "Spices", "grams", 1200],
  ["Olive oil", "Cooking Ingredients", "litres", 13], ["Tomato sauce", "Cooking Ingredients", "bottles", 14],
  ["Takeaway containers", "Packaging Materials", "boxes", 10],
] as const;

export const initialInventory: InventoryItem[] = [...hotelProducts, ...restaurantProducts].map(
  ([name, category, unit, quantity], index) => ({
    id: `INV-${String(index + 1).padStart(3, "0")}`,
    name,
    category,
    department: index < hotelProducts.length ? "Hotel" : "Restaurant",
    quantity,
    unit,
    minimum: index % 5 === 0 ? 10 : 8,
    maximum: index < hotelProducts.length ? 100 : 120,
    unitCost: 250 + (index * 137) % 3200,
    supplier: ["Ceylon Hospitality Supply", "Island Fresh Traders", "Premier Hotel Goods"][index % 3],
    ...(index === 5 ? { expiryDate: "2026-11-18" } : index === 30 ? { expiryDate: "2026-11-25" } : {}),
    location: index < 25 ? `Hotel store · ${["Level 1", "Laundry", "Pantry"][index % 3]}` : `Kitchen store · ${["Chiller", "Dry store", "Prep station"][index % 3]}`,
  }),
);

export const initialStockRequests: StockRequest[] = [
  { id: "SR-208", department: "Hotel", requestedBy: "Amara Fernando", itemId: "INV-001", quantity: 3, reason: "Room 205 checkout clean", status: "Pending" },
  { id: "SR-207", department: "Restaurant", requestedBy: "Chef Kavindu", itemId: "INV-034", quantity: 5, reason: "Lunch preparation", status: "Pending" },
  { id: "SR-206", department: "Hotel", requestedBy: "Ruwani Dias", itemId: "INV-011", quantity: 4, reason: "Guest room restock", status: "Approved" },
  { id: "SR-205", department: "Restaurant", requestedBy: "Nadeesha Perera", itemId: "INV-039", quantity: 8, reason: "Dinner service", status: "Issued" },
];

export const initialStockMovements: StockMovement[] = [
  { id: "MOV-721", itemId: "INV-039", type: "Used", quantity: 8, detail: "Restaurant dinner service", occurredAt: "12:45 PM" },
  { id: "MOV-720", itemId: "INV-011", type: "Issued", quantity: 4, detail: "Housekeeping request SR-206", occurredAt: "11:20 AM" },
  { id: "MOV-719", itemId: "INV-034", type: "Received", quantity: 15, detail: "Supplier delivery · Island Fresh Traders", occurredAt: "9:05 AM" },
];

export const initialMenu: MenuItem[] = [
  { id: "MENU-101", name: "Aurelia Chicken Burger", category: "Main Courses", description: "Grilled chicken, garden greens, house sauce", price: 2450, minutes: 20, available: true, ingredients: [{ itemId: "INV-034", quantity: 0.2 }, { itemId: "INV-044", quantity: 1 }, { itemId: "INV-029", quantity: 0.08 }, { itemId: "INV-050", quantity: 0.02 }] },
  { id: "MENU-102", name: "Crispy French Fries", category: "Snacks", description: "Golden-cut fries with sea salt", price: 950, minutes: 12, available: true, ingredients: [{ itemId: "INV-026", quantity: 0.25 }] },
  { id: "MENU-103", name: "Fresh Orange Juice", category: "Beverages", description: "Freshly squeezed seasonal oranges", price: 780, minutes: 5, available: true, ingredients: [{ itemId: "INV-031", quantity: 0.3 }] },
  { id: "MENU-104", name: "Coconut Rice Bowl", category: "Lunch", description: "Fragrant rice with vegetables and curry", price: 1850, minutes: 18, available: true, ingredients: [{ itemId: "INV-043", quantity: 0.18 }, { itemId: "INV-027", quantity: 0.12 }] },
  { id: "MENU-105", name: "Chocolate Fondant", category: "Desserts", description: "Warm chocolate centre, vanilla cream", price: 1200, minutes: 15, available: true, ingredients: [{ itemId: "INV-038", quantity: 0.1 }, { itemId: "INV-037", quantity: 1 }] },
  { id: "MENU-106", name: "Seafood Linguine", category: "Dinner", description: "Local catch, herbs, olive oil", price: 3200, minutes: 25, available: true, ingredients: [{ itemId: "INV-036", quantity: 0.2 }, { itemId: "INV-048", quantity: 0.04 }] },
  { id: "MENU-107", name: "Garden Breakfast Plate", category: "Breakfast", description: "Eggs, toast, grilled tomato", price: 1650, minutes: 14, available: true, ingredients: [{ itemId: "INV-037", quantity: 2 }, { itemId: "INV-028", quantity: 0.1 }] },
  { id: "MENU-108", name: "Sparkling Lime Cooler", category: "Beverages", description: "Fresh lime, soda and mint", price: 650, minutes: 5, available: true, ingredients: [{ itemId: "INV-033", quantity: 0.1 }] },
];

export const initialOrders: RestaurantOrder[] = [
  { id: "ORD-6021", type: "Dine-in", guest: "Walk-in · Table 04", table: "04", items: [{ menuItemId: "MENU-101", quantity: 2 }, { menuItemId: "MENU-102", quantity: 1 }], instructions: "One burger without onions", total: 5850, createdAt: "12:34 PM", status: "Preparing" },
  { id: "ORD-6020", type: "Room service", guest: "Mohamed Rashid", room: "205", items: [{ menuItemId: "MENU-101", quantity: 2 }, { menuItemId: "MENU-103", quantity: 2 }], instructions: "No onions, extra sauce", total: 6460, createdAt: "12:28 PM", status: "Ready", deliveryStatus: "Ready", billing: "Charge to room", reservation: "AUR-2601" },
  { id: "ORD-6019", type: "Takeaway", guest: "Takeaway · S. Silva", items: [{ menuItemId: "MENU-104", quantity: 1 }], instructions: "", total: 1850, createdAt: "12:16 PM", status: "New Order" },
  { id: "ORD-6018", type: "Dine-in", guest: "Walk-in · Table 02", table: "02", items: [{ menuItemId: "MENU-106", quantity: 1 }], instructions: "Allergy: shellfish", total: 3200, createdAt: "11:52 AM", status: "Completed", stockUsed: true },
  { id: "ORD-6017", type: "Room service", guest: "Nimali Perera", room: "312", items: [{ menuItemId: "MENU-108", quantity: 2 }], instructions: "Deliver to room", total: 1300, createdAt: "11:41 AM", status: "Preparing", deliveryStatus: "Waiting", billing: "Direct payment" },
];

export const guestRooms = [
  { room: "205", guest: "Mohamed Rashid", reservation: "AUR-2601", balance: 18400 },
  { room: "312", guest: "Nimali Perera", reservation: "AUR-2598", balance: 27650 },
  { room: "407", guest: "Sarah Chen", reservation: "AUR-2591", balance: 9200 },
  { room: "221", guest: "Kavindu Silva", reservation: "AUR-2584", balance: 12700 },
];
