export type RoomStatus =
  | "Available"
  | "Reserved"
  | "Occupied"
  | "Cleaning"
  | "Maintenance"
  | "Out of Service";

export type ReservationStatus =
  | "Pending"
  | "Confirmed"
  | "Checked In"
  | "Checked Out"
  | "Cancelled";

export type PaymentStatus = "Paid" | "Partial" | "Unpaid";

export type RoomType = {
  name: string;
  description: string;
  price: number;
  occupancy: number;
  bed: string;
  amenities: string[];
};

export type HotelRoom = {
  id: string;
  number: string;
  floor: number;
  type: string;
  bed: string;
  capacity: number;
  price: number;
  amenities: string[];
  status: RoomStatus;
  image: string;
};

export type Reservation = {
  id: string;
  guestName: string;
  email: string;
  phone: string;
  roomNumber: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  total: number;
  paid: number;
  status: ReservationStatus;
  specialRequests: string;
};

export const initialRoomTypes: RoomType[] = [
  { name: "Standard Room", description: "A comfortable retreat for a city stay.", price: 18000, occupancy: 2, bed: "Queen", amenities: ["Wi-Fi", "Rain shower", "Work desk"] },
  { name: "Deluxe Room", description: "Extra space and thoughtful in-room comforts.", price: 24500, occupancy: 2, bed: "King", amenities: ["Wi-Fi", "Balcony", "Rain shower", "Mini bar"] },
  { name: "Superior Room", description: "Elevated views with room to unwind.", price: 29500, occupancy: 3, bed: "King", amenities: ["Wi-Fi", "Ocean view", "Rain shower", "Mini bar"] },
  { name: "Executive Room", description: "A refined base with executive lounge access.", price: 36000, occupancy: 2, bed: "King", amenities: ["Wi-Fi", "Lounge access", "Espresso machine"] },
  { name: "Family Room", description: "A generous layout designed for travelling together.", price: 42000, occupancy: 4, bed: "King + twin", amenities: ["Wi-Fi", "Sofa bed", "Connecting rooms", "Bath"] },
  { name: "Suite", description: "Separate living space with a private sea-facing terrace.", price: 68000, occupancy: 4, bed: "King", amenities: ["Wi-Fi", "Ocean view", "Living room", "Butler service"] },
  { name: "Presidential Suite", description: "Our signature residence for exceptional stays.", price: 145000, occupancy: 6, bed: "King + twin", amenities: ["Wi-Fi", "Panoramic view", "Private dining", "Butler service"] },
];

const imageByType: Record<string, string> = {
  "Standard Room": "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=960&q=80",
  "Deluxe Room": "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=960&q=80",
  "Superior Room": "https://images.unsplash.com/photo-1611892440504-0a15ecfdbb4d?auto=format&fit=crop&w=960&q=80",
  "Executive Room": "https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=960&q=80",
  "Family Room": "https://images.unsplash.com/photo-1595576508898-0ad5c879a061?auto=format&fit=crop&w=960&q=80",
  Suite: "https://images.unsplash.com/photo-1611892440504-0a15ecfdbb4d?auto=format&fit=crop&w=960&q=80",
  "Presidential Suite": "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=960&q=80",
};

export function dateOffset(offset: number) {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

const roomTypeForRoom = (index: number) => initialRoomTypes[index % initialRoomTypes.length];
const statusByRoom: Record<string, RoomStatus> = {
  "101": "Occupied",
  "102": "Reserved",
  "103": "Reserved",
  "105": "Cleaning",
  "201": "Available",
  "204": "Reserved",
  "208": "Cleaning",
  "301": "Reserved",
  "302": "Occupied",
  "401": "Maintenance",
  "402": "Out of Service",
  "503": "Cleaning",
};

export const initialRooms: HotelRoom[] = Array.from({ length: 30 }, (_, index) => {
  const floor = Math.floor(index / 6) + 1;
  const number = `${floor}${String((index % 6) + 1).padStart(2, "0")}`;
  const type = roomTypeForRoom(index);
  return {
    id: `room-${number}`,
    number,
    floor,
    type: type.name,
    bed: type.bed,
    capacity: type.occupancy,
    price: type.price,
    amenities: type.amenities,
    status: statusByRoom[number] ?? "Available",
    image: imageByType[type.name],
  };
});

export const initialReservations: Reservation[] = [
  {
    id: "AUR-2601",
    guestName: "Isabella Fernando",
    email: "isabella.fernando@example.com",
    phone: "+94 77 234 1098",
    roomNumber: "101",
    roomType: initialRooms[0].type,
    checkIn: dateOffset(-1),
    checkOut: dateOffset(1),
    guests: 2,
    total: initialRooms[0].price * 2,
    paid: initialRooms[0].price,
    status: "Checked In",
    specialRequests: "Late dinner reservation, please.",
  },
  {
    id: "AUR-2602",
    guestName: "Daniel Kim",
    email: "daniel.kim@example.com",
    phone: "+82 10 3842 7190",
    roomNumber: "102",
    roomType: initialRooms[1].type,
    checkIn: dateOffset(0),
    checkOut: dateOffset(2),
    guests: 2,
    total: initialRooms[1].price * 2,
    paid: initialRooms[1].price * 2,
    status: "Confirmed",
    specialRequests: "Feather-free pillows.",
  },
  {
    id: "AUR-2603",
    guestName: "Amara Wijesinghe",
    email: "amara.w@example.com",
    phone: "+94 71 992 0431",
    roomNumber: "103",
    roomType: initialRooms[2].type,
    checkIn: dateOffset(2),
    checkOut: dateOffset(5),
    guests: 2,
    total: initialRooms[2].price * 3,
    paid: 0,
    status: "Confirmed",
    specialRequests: "",
  },
  {
    id: "AUR-2604",
    guestName: "Oliver Chen",
    email: "oliver.chen@example.com",
    phone: "+65 8123 7745",
    roomNumber: "204",
    roomType: initialRooms[9].type,
    checkIn: dateOffset(0),
    checkOut: dateOffset(3),
    guests: 3,
    total: initialRooms[9].price * 3,
    paid: 0,
    status: "Pending",
    specialRequests: "Airport transfer for three guests.",
  },
  {
    id: "AUR-2605",
    guestName: "Sofia Perera",
    email: "sofia.perera@example.com",
    phone: "+94 76 331 2281",
    roomNumber: "302",
    roomType: initialRooms[13].type,
    checkIn: dateOffset(-2),
    checkOut: dateOffset(2),
    guests: 2,
    total: initialRooms[13].price * 4,
    paid: 0,
    status: "Checked In",
    specialRequests: "Celebrating an anniversary.",
  },
  {
    id: "AUR-2606",
    guestName: "Ravi Nair",
    email: "ravi.nair@example.com",
    phone: "+91 98450 11702",
    roomNumber: "301",
    roomType: initialRooms[12].type,
    checkIn: dateOffset(4),
    checkOut: dateOffset(7),
    guests: 2,
    total: initialRooms[12].price * 3,
    paid: initialRooms[12].price,
    status: "Confirmed",
    specialRequests: "",
  },
  {
    id: "AUR-2607",
    guestName: "Grace Thompson",
    email: "grace.t@example.com",
    phone: "+44 7700 900123",
    roomNumber: "205",
    roomType: initialRooms[10].type,
    checkIn: dateOffset(-4),
    checkOut: dateOffset(-2),
    guests: 2,
    total: initialRooms[10].price * 2,
    paid: initialRooms[10].price * 2,
    status: "Checked Out",
    specialRequests: "",
  },
  {
    id: "AUR-2608",
    guestName: "Noah Martins",
    email: "noah.martins@example.com",
    phone: "+55 11 98431 2220",
    roomNumber: "405",
    roomType: initialRooms[22].type,
    checkIn: dateOffset(3),
    checkOut: dateOffset(6),
    guests: 2,
    total: initialRooms[22].price * 3,
    paid: 0,
    status: "Confirmed",
    specialRequests: "",
  },
];

export function getNights(checkIn: string, checkOut: string) {
  const nights = Math.ceil((Date.parse(`${checkOut}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`)) / 86_400_000);
  return Math.max(0, nights);
}

export function datesOverlap(startA: string, endA: string, startB: string, endB: string) {
  return startA < endB && startB < endA;
}

export function isReservationBlocking(reservation: Reservation) {
  return ["Pending", "Confirmed", "Checked In"].includes(reservation.status);
}

export function getRoomAvailability(
  room: HotelRoom,
  reservations: Reservation[],
  checkIn: string,
  checkOut: string,
) {
  if (room.status === "Maintenance" || room.status === "Out of Service") return false;
  if (room.status === "Occupied" && checkIn <= dateOffset(0) && checkOut > dateOffset(0)) return false;
  if (room.status === "Cleaning" && checkIn <= dateOffset(0)) return false;
  return !reservations.some(
    (reservation) =>
      reservation.roomNumber === room.number &&
      isReservationBlocking(reservation) &&
      datesOverlap(checkIn, checkOut, reservation.checkIn, reservation.checkOut),
  );
}
