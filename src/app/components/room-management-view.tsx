"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Icon } from "@/app/components/ui-icon";
import { RoomServiceWorkspace } from "@/app/components/operations-workspace";
import { useOperationsStore } from "@/app/components/operations-store";
import {
  dateOffset,
  datesOverlap,
  getNights,
  getRoomAvailability,
  initialReservations,
  initialRooms,
  initialRoomTypes,
  isReservationBlocking,
  type HotelRoom,
  type PaymentStatus,
  type Reservation,
  type ReservationStatus,
  type RoomStatus,
  type RoomType,
} from "@/lib/room-management-data";

export type RoomWorkspaceView =
  | "overview"
  | "availability"
  | "reservations"
  | "operations"
  | "room-service"
  | "floor-plan"
  | "calendar"
  | "room-types";

type Props = {
  initialView: RoomWorkspaceView;
  roleName: string;
  permissions: string[];
};

type ReservationDraft = {
  guestName: string;
  email: string;
  phone: string;
  roomNumber: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
  guests: string;
  specialRequests: string;
  status: "Pending" | "Confirmed";
  payment: PaymentStatus;
};

type RoomTypeDraft = {
  name: string;
  description: string;
  price: string;
  occupancy: string;
  bed: string;
  amenities: string;
};

const roomStatuses: RoomStatus[] = ["Available", "Reserved", "Occupied", "Cleaning", "Maintenance", "Out of Service"];
const reservationStatuses: ReservationStatus[] = ["Pending", "Confirmed", "Checked In", "Checked Out", "Cancelled"];
const emptyDraft = (): ReservationDraft => ({
  guestName: "",
  email: "",
  phone: "",
  roomNumber: "",
  roomType: "",
  checkIn: dateOffset(0),
  checkOut: dateOffset(1),
  guests: "1",
  specialRequests: "",
  status: "Confirmed",
  payment: "Unpaid",
});

const roomTypeDraft = (type?: RoomType): RoomTypeDraft => ({
  name: type?.name ?? "",
  description: type?.description ?? "",
  price: String(type?.price ?? ""),
  occupancy: String(type?.occupancy ?? 2),
  bed: type?.bed ?? "Queen",
  amenities: type?.amenities.join(", ") ?? "",
});

function currency(value: number) {
  return new Intl.NumberFormat("en-LK", {
    style: "currency",
    currency: "LKR",
    maximumFractionDigits: 0,
  }).format(value);
}

function dateLabel(value: string, options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) {
  return new Intl.DateTimeFormat("en-LK", { ...options, timeZone: "UTC" })
    .format(new Date(`${value}T00:00:00Z`));
}

function statusClass(value: string) {
  return `room-status-${value.toLowerCase().replaceAll(" ", "-")}`;
}

function Avatar({ name }: { name: string }) {
  return <span className="room-avatar">{name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>;
}

function StatusBadge({ status }: { status: RoomStatus | ReservationStatus | PaymentStatus }) {
  return <span className={`room-status-badge ${statusClass(status)}`}><i />{status}</span>;
}

export function RoomManagementView({ initialView, roleName, permissions }: Props) {
  const { rooms, setRooms, reservations, setReservations, setTasks } = useOperationsStore();
  const [view, setView] = useState<RoomWorkspaceView>(initialView);
  const [roomTypes, setRoomTypes] = useState(initialRoomTypes);
  const [toast, setToast] = useState("");
  const [query, setQuery] = useState("");
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [selectedReservation, setSelectedReservation] = useState<string | null>(null);
  const [reservationModal, setReservationModal] = useState(false);
  const [editingReservationId, setEditingReservationId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ReservationDraft>(emptyDraft);
  const [typeModal, setTypeModal] = useState(false);
  const [editingTypeName, setEditingTypeName] = useState<string | null>(null);
  const [typeDraft, setTypeDraft] = useState<RoomTypeDraft>(roomTypeDraft());
  const [checkInDate, setCheckInDate] = useState(dateOffset(0));
  const [checkOutDate, setCheckOutDate] = useState(dateOffset(1));
  const [guestCount, setGuestCount] = useState("2");
  const [availabilityType, setAvailabilityType] = useState("All room types");
  const [availabilityMinPrice, setAvailabilityMinPrice] = useState("");
  const [availabilityMaxPrice, setAvailabilityMaxPrice] = useState("");
  const [availabilitySort, setAvailabilitySort] = useState("recommended");
  const [searchedAvailability, setSearchedAvailability] = useState(false);
  const [floorFilter, setFloorFilter] = useState("All floors");
  const [typeFilter, setTypeFilter] = useState("All room types");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [reservationFilter, setReservationFilter] = useState("All statuses");
  const [reservationDateFilter, setReservationDateFilter] = useState("All dates");
  const [calendarView, setCalendarView] = useState<"Daily" | "Weekly" | "Monthly">("Weekly");
  const [calendarDate, setCalendarDate] = useState(dateOffset(0));
  const [operationSearch, setOperationSearch] = useState("");
  const [transferReservationId, setTransferReservationId] = useState("");
  const [transferRoomNumber, setTransferRoomNumber] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [cleaningFilter, setCleaningFilter] = useState("Needs cleaning");
  const [typeError, setTypeError] = useState("");
  const [formError, setFormError] = useState("");
  const [detailTab, setDetailTab] = useState<"details" | "activity">("details");

  const canSeeRooms = permissions.includes("rooms:view");
  const canSeeReservations = permissions.includes("reservations:view");
  const canUseFrontDesk = permissions.includes("frontdesk:view");
  const canManageRoomTypes = roleName === "Super Admin" || roleName === "Hotel Manager";
  const today = dateOffset(0);
  const activeReservation = reservations.find((reservation) => reservation.id === selectedReservation) ?? null;
  const activeRoom = rooms.find((room) => room.number === selectedRoom) ?? null;
  const nextReservationNumber = useMemo(
    () => reservations.reduce((maximum, reservation) => Math.max(maximum, Number(reservation.id.split("-")[1]) || 0), 2600) + 1,
    [reservations],
  );
  const editingReservation = editingReservationId
    ? reservations.find((reservation) => reservation.id === editingReservationId) ?? null
    : null;

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 3600);
  }

  const navigation: { id: RoomWorkspaceView; label: string; permission: boolean }[] = [
    { id: "overview", label: "Overview", permission: canSeeRooms },
    { id: "availability", label: "Availability", permission: canSeeRooms || canSeeReservations || canUseFrontDesk },
    { id: "floor-plan", label: "Floor plan", permission: canSeeRooms || canUseFrontDesk },
    { id: "reservations", label: "Reservations", permission: canSeeReservations },
    { id: "calendar", label: "Calendar", permission: canSeeReservations },
    { id: "operations", label: "Front desk", permission: canUseFrontDesk },
    { id: "room-service", label: "Room service", permission: canUseFrontDesk },
    { id: "room-types", label: "Room types & rates", permission: canSeeRooms },
  ];
  const availableNavigation = navigation.filter(({ permission }) => permission);

  const roomSearchMatches = (room: HotelRoom) => {
    const guest = reservations.find((item) => item.roomNumber === room.number && item.status === "Checked In")?.guestName ?? "";
    return `${room.number} ${room.type} ${room.status} ${guest}`.toLowerCase().includes(query.trim().toLowerCase());
  };
  const reservationMatches = (reservation: Reservation) =>
    `${reservation.id} ${reservation.guestName} ${reservation.roomNumber} ${reservation.roomType} ${reservation.status}`
      .toLowerCase().includes(query.trim().toLowerCase());

  const metrics = useMemo(() => {
    const count = (status: RoomStatus) => rooms.filter((room) => room.status === status).length;
    return [
      { label: "Total rooms", value: rooms.length, detail: "Across all floors", color: "navy", icon: "building" as const },
      { label: "Available", value: count("Available"), detail: "Ready to welcome", color: "green", icon: "check" as const },
      { label: "Reserved", value: count("Reserved"), detail: "Upcoming arrivals", color: "gold", icon: "calendar" as const },
      { label: "Occupied", value: count("Occupied"), detail: "Guests in house", color: "blue", icon: "users" as const },
      { label: "Maintenance", value: count("Maintenance"), detail: "Attention required", color: "rose", icon: "wrench" as const },
      { label: "Needs cleaning", value: count("Cleaning"), detail: "Turnaround in progress", color: "purple", icon: "activity" as const },
    ];
  }, [rooms]);
  const occupancyPercent = rooms.length ? Math.round((rooms.filter((room) => room.status === "Occupied").length / rooms.length) * 100) : 0;
  const distribution = roomStatuses.map((status) => ({ status, count: rooms.filter((room) => room.status === status).length }));

  const availabilityRooms = useMemo(() => {
    if (!searchedAvailability || checkOutDate <= checkInDate) return [];
    return rooms
      .filter((room) =>
        room.capacity >= Number(guestCount) &&
        (availabilityType === "All room types" || room.type === availabilityType) &&
        (!availabilityMinPrice || room.price >= Number(availabilityMinPrice)) &&
        (!availabilityMaxPrice || room.price <= Number(availabilityMaxPrice)) &&
        getRoomAvailability(room, reservations, checkInDate, checkOutDate),
      )
      .sort((a, b) => availabilitySort === "price-low" ? a.price - b.price : availabilitySort === "price-high" ? b.price - a.price : a.floor - b.floor);
  }, [availabilityMaxPrice, availabilityMinPrice, availabilitySort, availabilityType, checkInDate, checkOutDate, guestCount, reservations, rooms, searchedAvailability]);

  const filteredRooms = rooms.filter((room) =>
    roomSearchMatches(room) &&
    (floorFilter === "All floors" || room.floor === Number(floorFilter)) &&
    (typeFilter === "All room types" || room.type === typeFilter) &&
    (statusFilter === "All statuses" || room.status === statusFilter),
  );
  const filteredReservations = reservations
    .filter((reservation) =>
      reservationMatches(reservation) &&
      (reservationFilter === "All statuses" || reservation.status === reservationFilter) &&
      (reservationDateFilter === "All dates" ||
        (reservationDateFilter === "Arriving today" && reservation.checkIn === today) ||
        (reservationDateFilter === "Upcoming" && reservation.checkIn > today) ||
        (reservationDateFilter === "Past stays" && reservation.checkOut <= today)),
    )
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  const staysForForm = reservations.filter((reservation) => reservation.id !== editingReservationId);
  const formAvailableRooms = rooms.filter((room) =>
    (draft.roomType === "" || room.type === draft.roomType) &&
    room.capacity >= Number(draft.guests || 1) &&
    !!draft.checkIn && !!draft.checkOut && draft.checkOut > draft.checkIn &&
    getRoomAvailability(room, staysForForm, draft.checkIn, draft.checkOut),
  );
  const selectedDraftRoom = formAvailableRooms.find((room) => room.number === draft.roomNumber);
  const draftNights = getNights(draft.checkIn, draft.checkOut);
  const draftTotal = (selectedDraftRoom?.price ?? 0) * draftNights;
  const operationMatches = (reservation: Reservation) =>
    `${reservation.guestName} ${reservation.id} ${reservation.roomNumber}`.toLowerCase().includes(operationSearch.trim().toLowerCase());
  const arrivals = reservations.filter((reservation) =>
    ["Pending", "Confirmed"].includes(reservation.status) &&
    reservation.checkIn <= today &&
    operationMatches(reservation),
  );
  const departures = reservations.filter((reservation) =>
    reservation.status === "Checked In" && operationMatches(reservation),
  );
  const cleaningRooms = rooms.filter((room) => room.status === "Cleaning");

  function openReservation(roomNumber?: string, reservation?: Reservation) {
    setEditingReservationId(reservation?.id ?? null);
    setFormError("");
    setDraft(reservation ? {
      guestName: reservation.guestName,
      email: reservation.email,
      phone: reservation.phone,
      roomNumber: reservation.roomNumber,
      roomType: reservation.roomType,
      checkIn: reservation.checkIn,
      checkOut: reservation.checkOut,
      guests: String(reservation.guests),
      specialRequests: reservation.specialRequests,
      status: reservation.status === "Pending" ? "Pending" : "Confirmed",
      payment: reservation.paid >= reservation.total ? "Paid" : reservation.paid > 0 ? "Partial" : "Unpaid",
    } : { ...emptyDraft(), roomNumber: roomNumber ?? "" });
    setReservationModal(true);
  }

  function saveReservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    const guests = Number(draft.guests);
    if (!draft.guestName.trim() || !draft.phone.trim() || !draft.checkIn || !draft.checkOut) {
      setFormError("Add the guest name, phone number and stay dates to continue.");
      return;
    }
    if (draft.checkOut <= draft.checkIn) {
      setFormError("Check-out must be after check-in.");
      return;
    }
    if (!editingReservation && draft.checkIn < today) {
      setFormError("New reservations must start today or later.");
      return;
    }
    if (!Number.isInteger(guests) || guests < 1) {
      setFormError("Guest count must be at least one.");
      return;
    }
    const availableRoom = formAvailableRooms.find((room) => room.number === draft.roomNumber);
    if (!availableRoom) {
      setFormError("Choose a room that is available for those dates and guest count.");
      return;
    }
    const nights = getNights(draft.checkIn, draft.checkOut);
    const total = availableRoom.price * nights;
    const paid = draft.payment === "Paid" ? total : draft.payment === "Partial" ? Math.round(total / 2) : 0;
    const nextReservation: Reservation = {
      id: editingReservation?.id ?? `AUR-${nextReservationNumber}`,
      guestName: draft.guestName.trim(),
      email: draft.email.trim(),
      phone: draft.phone.trim(),
      roomNumber: availableRoom.number,
      roomType: availableRoom.type,
      checkIn: draft.checkIn,
      checkOut: draft.checkOut,
      guests,
      total,
      paid,
      status: editingReservation?.status === "Checked In" || editingReservation?.status === "Checked Out"
        ? editingReservation.status
        : draft.status,
      specialRequests: draft.specialRequests.trim(),
    };
    if (editingReservation) {
      setReservations((current) => current.map((item) => item.id === editingReservation.id ? nextReservation : item));
      if (editingReservation.roomNumber !== availableRoom.number) {
        setRooms((current) => current.map((room) => room.number === editingReservation.roomNumber
          ? { ...room, status: room.status === "Occupied" ? "Cleaning" : "Available" }
          : room.number === availableRoom.number
            ? { ...room, status: editingReservation.status === "Checked In" ? "Occupied" : "Reserved" }
            : room));
      }
      notify(`Reservation ${nextReservation.id} updated.`);
    } else {
      setReservations((current) => [nextReservation, ...current]);
      if (nextReservation.checkIn <= today && nextReservation.checkOut > today) {
        setRooms((current) => current.map((room) => room.number === availableRoom.number ? { ...room, status: "Reserved" } : room));
      }
      notify(`Reservation ${nextReservation.id} created.`);
    }
    setReservationModal(false);
  }

  function cancelReservation(reservation: Reservation) {
    if (!window.confirm(`Cancel reservation ${reservation.id} for ${reservation.guestName}?`)) return;
    setReservations((current) => current.map((item) => item.id === reservation.id ? { ...item, status: "Cancelled" } : item));
    const hasOtherActiveStay = reservations.some((item) =>
      item.id !== reservation.id &&
      item.roomNumber === reservation.roomNumber &&
      isReservationBlocking(item) &&
      datesOverlap(item.checkIn, item.checkOut, today, dateOffset(1)),
    );
    if (!hasOtherActiveStay) {
      setRooms((current) => current.map((room) => room.number === reservation.roomNumber && room.status === "Reserved"
        ? { ...room, status: "Available" }
        : room));
    }
    setSelectedReservation(null);
    notify(`Reservation ${reservation.id} cancelled.`);
  }

  function changeRoomStatus(room: HotelRoom, status: RoomStatus) {
    if (status === "Available" && reservations.some((reservation) =>
      reservation.roomNumber === room.number &&
      isReservationBlocking(reservation) &&
      reservation.checkIn <= today &&
      reservation.checkOut > today,
    )) {
      notify(`Room ${room.number} has an active stay or arrival and cannot be marked available.`);
      return;
    }
    if (status === "Available" && room.status === "Occupied") {
      notify(`Check out the current guest from room ${room.number} before marking it available.`);
      return;
    }
    setRooms((current) => current.map((item) => item.number === room.number ? { ...item, status } : item));
    notify(`Room ${room.number} marked ${status.toLowerCase()}.`);
  }

  function checkInGuest(reservation: Reservation) {
    if (reservation.status !== "Confirmed" || reservation.checkIn > today) {
      notify("Only confirmed arrivals due today can be checked in.");
      return;
    }
    const assignedRoom = rooms.find((room) => room.number === reservation.roomNumber);
    if (!assignedRoom || ["Occupied", "Cleaning", "Maintenance", "Out of Service"].includes(assignedRoom.status)) {
      notify(`Room ${reservation.roomNumber} is not ready for check-in. Review its current status first.`);
      return;
    }
    if (!window.confirm(`Check in ${reservation.guestName} to room ${reservation.roomNumber}?`)) return;
    setReservations((current) => current.map((item) => item.id === reservation.id ? { ...item, status: "Checked In" } : item));
    setRooms((current) => current.map((room) => room.number === reservation.roomNumber ? { ...room, status: "Occupied" } : room));
    notify(`${reservation.guestName} checked in to room ${reservation.roomNumber}.`);
  }

  function checkOutGuest(reservation: Reservation) {
    const due = Math.max(0, reservation.total - reservation.paid);
    const message = due
      ? `There is ${currency(due)} outstanding. Confirm check-out for ${reservation.guestName}?`
      : `Confirm check-out for ${reservation.guestName}?`;
    if (!window.confirm(message)) return;
    setReservations((current) => current.map((item) => item.id === reservation.id ? { ...item, status: "Checked Out" } : item));
    setRooms((current) => current.map((room) => room.number === reservation.roomNumber ? { ...room, status: "Cleaning" } : room));
    setTasks((current) => current.some((task) => task.description.includes(reservation.id)) ? current : [{
      id: `HK-T${Date.now().toString().slice(-4)}`,
      room: reservation.roomNumber,
      roomType: reservation.roomType,
      description: `Checkout cleaning for ${reservation.guestName} · ${reservation.id}`,
      assignee: "Unassigned",
      priority: "High",
      createdAt: new Intl.DateTimeFormat("en-LK", { hour: "2-digit", minute: "2-digit" }).format(new Date()),
      dueTime: "12:00 PM",
      status: "Pending",
    }, ...current]);
    notify(`Room ${reservation.roomNumber} is now marked for cleaning.`);
  }

  function transferGuest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reservation = reservations.find((item) => item.id === transferReservationId && item.status === "Checked In");
    const target = rooms.find((room) => room.number === transferRoomNumber && room.status === "Available");
    if (!reservation || !target || !transferReason.trim()) {
      notify("Choose an occupied stay, an eligible room and a transfer reason.");
      return;
    }
    if (!getRoomAvailability(target, reservations, today, reservation.checkOut) || target.capacity < reservation.guests) {
      notify(`Room ${target.number} is not available for this guest's stay.`);
      return;
    }
    if (!window.confirm(`Transfer ${reservation.guestName} from ${reservation.roomNumber} to ${target.number}?`)) return;
    const previousRoom = reservation.roomNumber;
    setReservations((current) => current.map((item) => item.id === reservation.id ? { ...item, roomNumber: target.number } : item));
    setRooms((current) => current.map((room) =>
      room.number === previousRoom ? { ...room, status: "Cleaning" } :
        room.number === target.number ? { ...room, status: "Occupied" } : room,
    ));
    setTasks((current) => [{
      id: `HK-T${Date.now().toString().slice(-4)}`,
      room: previousRoom,
      roomType: rooms.find((room) => room.number === previousRoom)?.type ?? reservation.roomType,
      description: `Cleaning after room transfer for ${reservation.guestName} · ${reservation.id}`,
      assignee: "Unassigned",
      priority: "Normal",
      createdAt: new Intl.DateTimeFormat("en-LK", { hour: "2-digit", minute: "2-digit" }).format(new Date()),
      dueTime: "5:00 PM",
      status: "Pending",
    }, ...current]);
    setTransferReservationId("");
    setTransferRoomNumber("");
    setTransferReason("");
    notify(`Guest transferred. Room ${previousRoom} needs cleaning.`);
  }

  function saveRoomType(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTypeError("");
    const price = Number(typeDraft.price);
    const occupancy = Number(typeDraft.occupancy);
    if (!typeDraft.name.trim() || !typeDraft.description.trim() || !typeDraft.bed.trim() ||
      !Number.isFinite(price) || price <= 0 || !Number.isInteger(occupancy) || occupancy < 1) {
      setTypeError("Enter a name, description, valid nightly rate, occupancy and bed configuration.");
      return;
    }
    const name = typeDraft.name.trim();
    if (roomTypes.some((type) => type.name.toLowerCase() === name.toLowerCase() && type.name !== editingTypeName)) {
      setTypeError("A room type with that name already exists.");
      return;
    }
    const nextType: RoomType = {
      name,
      description: typeDraft.description.trim(),
      price,
      occupancy,
      bed: typeDraft.bed.trim(),
      amenities: typeDraft.amenities.split(",").map((amenity) => amenity.trim()).filter(Boolean),
    };
    if (editingTypeName) {
      setRoomTypes((current) => current.map((type) => type.name === editingTypeName ? nextType : type));
      setRooms((current) => current.map((room) => room.type === editingTypeName
        ? { ...room, type: name, price, capacity: occupancy, bed: nextType.bed, amenities: nextType.amenities }
        : room));
      setReservations((current) => current.map((reservation) => reservation.roomType === editingTypeName
        ? { ...reservation, roomType: name }
        : reservation));
      notify(`${name} details updated.`);
    } else {
      setRoomTypes((current) => [...current, nextType]);
      notify(`${name} added to room types.`);
    }
    setTypeModal(false);
    setEditingTypeName(null);
  }

  function resetDemoData() {
    if (!window.confirm("Reset rooms, reservations and room types to the original sample data?")) return;
    setRooms(initialRooms);
    setReservations(initialReservations);
    setRoomTypes(initialRoomTypes);
    setSelectedRoom(null);
    setSelectedReservation(null);
    notify("Sample data restored.");
  }

  const titleByView: Record<RoomWorkspaceView, string> = {
    overview: "Room management",
    availability: "Room availability",
    reservations: "Reservations",
    operations: "Front desk operations",
    "room-service": "Room service",
    "floor-plan": "Room overview",
    calendar: "Reservation calendar",
    "room-types": "Room types & pricing",
  };
  const descriptionByView: Record<RoomWorkspaceView, string> = {
    overview: "A live view of room readiness, guest stays and property occupancy.",
    availability: "Find the right room for a stay, based on the dates selected.",
    reservations: "Create, review and manage guest reservations.",
    operations: "Arrivals, departures, room transfers and housekeeping in one place.",
    "room-service": "Create guest orders, track kitchen progress and manage room delivery.",
    "floor-plan": "Explore every room and its current status across the property.",
    calendar: "View reservations by day, week or month across every room.",
    "room-types": "Manage room categories, nightly rates, occupancy and amenities.",
  };

  return (
    <div className="room-workspace">
      <div className="page-heading room-page-heading">
        <div>
          <div className="breadcrumb">Workspace <Icon name="chevron" size={14} /> Rooms & property <Icon name="chevron" size={14} /> {titleByView[view]}</div>
          <h1>{titleByView[view]}</h1>
          <p>{descriptionByView[view]}</p>
        </div>
        <div className="room-heading-actions">
          <label className="room-global-search">
            <Icon name="search" size={17} />
            <input aria-label="Search rooms, guests and reservations" placeholder="Search rooms, guests, bookings..." value={query} onChange={(event) => setQuery(event.target.value)} />
            {query && <button type="button" aria-label="Clear search" onClick={() => setQuery("")}><Icon name="close" size={14} /></button>}
          </label>
          {canSeeReservations && (
            <button className="primary-button room-new-booking" onClick={() => openReservation()}>
              <span>+</span> New reservation
            </button>
          )}
        </div>
      </div>

      <nav className="room-tabs" aria-label="Room management sections">
        {availableNavigation.map((item) => (
          <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}>
            {item.label}
            {item.id === "reservations" && <span>{reservations.filter((reservation) => isReservationBlocking(reservation)).length}</span>}
          </button>
        ))}
      </nav>

      {view === "overview" && canSeeRooms && (
        <section className="room-content">
          <div className="room-kpi-grid">
            {metrics.map((metric) => (
              <article className="room-kpi-card" key={metric.label}>
                <span className={`room-kpi-icon room-kpi-${metric.color}`}><Icon name={metric.icon} size={19} /></span>
                <div><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.detail}</small></div>
                <i className={`room-kpi-accent room-kpi-accent-${metric.color}`} />
              </article>
            ))}
          </div>
          <div className="room-analytics-grid">
            <article className="panel room-occupancy-panel">
              <div className="room-panel-heading"><div><span className="panel-overline">TODAY AT A GLANCE</span><h2>Occupancy overview</h2><p>Current room status across the property</p></div><span className="room-live"><i /> Live overview</span></div>
              <div className="room-occupancy-content">
                <div className="room-donut" style={{ "--occupancy": `${occupancyPercent}%` } as React.CSSProperties}>
                  <div><strong>{occupancyPercent}%</strong><span>occupied</span></div>
                </div>
                <div className="room-occupancy-legend">
                  {[
                    ["Available", rooms.filter((room) => room.status === "Available").length, "green"],
                    ["Occupied", rooms.filter((room) => room.status === "Occupied").length, "navy"],
                    ["Reserved", rooms.filter((room) => room.status === "Reserved").length, "gold"],
                  ].map(([label, count, color]) => <div key={label as string}><i className={`legend-${color}`} /><span>{label}</span><strong>{count}</strong></div>)}
                </div>
              </div>
              <div className="room-capacity-line"><span>Room availability mix</span><strong>{rooms.filter((room) => room.status === "Available").length} ready now</strong></div>
              <div className="room-stack-bar">
                {[
                  ["Available", "stack-available"],
                  ["Occupied", "stack-occupied"],
                  ["Reserved", "stack-reserved"],
                  ["Other", "stack-other"],
                ].map(([label, style]) => {
                  const amount = label === "Other"
                    ? rooms.length - rooms.filter((room) => ["Available", "Occupied", "Reserved"].includes(room.status)).length
                    : rooms.filter((room) => room.status === label).length;
                  return amount > 0 ? <i key={label} className={style} style={{ width: `${(amount / Math.max(rooms.length, 1)) * 100}%` }} title={`${label}: ${amount}`} /> : null;
                })}
              </div>
            </article>
            <article className="panel room-distribution-panel">
              <div className="room-panel-heading"><div><span className="panel-overline">ROOM HEALTH</span><h2>Status distribution</h2><p>Readiness across all room categories</p></div><span className="panel-count">{rooms.length} rooms</span></div>
              <div className="room-distribution-list">
                {distribution.map(({ status, count }) => (
                  <div className="room-distribution-row" key={status}>
                    <span><i className={`distribution-${statusClass(status)}`} />{status}</span>
                    <div className="room-distribution-track"><i className={statusClass(status)} style={{ width: `${rooms.length ? (count / rooms.length) * 100 : 0}%` }} /></div>
                    <strong>{count}</strong>
                  </div>
                ))}
              </div>
            </article>
          </div>
          <article className="panel room-upcoming-panel">
            <div className="room-panel-heading">
              <div><span className="panel-overline">GUEST EXPERIENCE</span><h2>Today’s arrivals & departures</h2><p>Keep the front desk one step ahead.</p></div>
              {canUseFrontDesk && <button className="text-button room-text-link" onClick={() => setView("operations")}>Open front desk <Icon name="arrow" size={14} /></button>}
            </div>
            <div className="room-arrivals-grid">
              {[
                { label: "Arrivals", entries: reservations.filter((reservation) => reservation.checkIn === today && ["Pending", "Confirmed"].includes(reservation.status)) },
                { label: "Departures", entries: reservations.filter((reservation) => reservation.checkOut === today && reservation.status === "Checked In") },
              ].map(({ label, entries }) => (
                <div className="room-arrival-column" key={label}>
                  <div className="room-arrival-title"><span>{label}</span><strong>{entries.length}</strong></div>
                  {entries.length ? entries.slice(0, 3).map((reservation) => (
                    <button className="room-arrival-row" key={reservation.id} onClick={() => setSelectedReservation(reservation.id)}>
                      <Avatar name={reservation.guestName} /><span><strong>{reservation.guestName}</strong><small>Room {reservation.roomNumber} · {reservation.id}</small></span><StatusBadge status={reservation.status} />
                    </button>
                  )) : <p className="room-empty-copy">No {label.toLowerCase()} scheduled today.</p>}
                </div>
              ))}
            </div>
          </article>
          <div className="room-quick-footer"><span>Demo changes are kept in this workspace until you leave or refresh it.</span><button onClick={resetDemoData}>Reset sample data</button></div>
        </section>
      )}

      {view === "availability" && (
        <section className="room-content">
          <form className="panel availability-search-panel" onSubmit={(event) => {
            event.preventDefault();
            if (checkOutDate <= checkInDate) {
              notify("Check-out must be after check-in.");
              return;
            }
            if (Number(guestCount) < 1) {
              notify("Guest count must be at least one.");
              return;
            }
            setSearchedAvailability(true);
          }}>
            <div className="room-panel-heading"><div><span className="panel-overline">PLAN A STAY</span><h2>Search availability</h2><p>Results are checked against room reservations for your dates.</p></div><span className="availability-search-icon"><Icon name="calendar" size={20} /></span></div>
            <div className="availability-fields">
              <label className="room-field"><span>Check-in</span><input type="date" value={checkInDate} onChange={(event) => { setCheckInDate(event.target.value); setSearchedAvailability(false); }} required /></label>
              <label className="room-field"><span>Check-out</span><input type="date" value={checkOutDate} min={checkInDate} onChange={(event) => { setCheckOutDate(event.target.value); setSearchedAvailability(false); }} required /></label>
              <label className="room-field"><span>Guests</span><select value={guestCount} onChange={(event) => { setGuestCount(event.target.value); setSearchedAvailability(false); }}>{[1, 2, 3, 4, 5, 6].map((number) => <option key={number} value={number}>{number} {number === 1 ? "guest" : "guests"}</option>)}</select></label>
              <label className="room-field"><span>Room type</span><select value={availabilityType} onChange={(event) => { setAvailabilityType(event.target.value); setSearchedAvailability(false); }}><option>All room types</option>{roomTypes.map((type) => <option key={type.name}>{type.name}</option>)}</select></label>
              <label className="room-field"><span>Min. nightly price</span><select value={availabilityMinPrice} onChange={(event) => { setAvailabilityMinPrice(event.target.value); setSearchedAvailability(false); }}><option value="">No minimum</option><option value="20000">From LKR 20,000</option><option value="30000">From LKR 30,000</option><option value="50000">From LKR 50,000</option></select></label>
              <label className="room-field"><span>Max. nightly price</span><select value={availabilityMaxPrice} onChange={(event) => { setAvailabilityMaxPrice(event.target.value); setSearchedAvailability(false); }}><option value="">No maximum</option><option value="25000">Up to LKR 25,000</option><option value="40000">Up to LKR 40,000</option><option value="70000">Up to LKR 70,000</option></select></label>
              <button className="primary-button availability-search-button" type="submit"><Icon name="search" size={17} /> Search rooms</button>
            </div>
          </form>
          {searchedAvailability ? (
            <div className="availability-results">
              <div className="room-results-heading"><div><span className="panel-overline">MATCHING ROOMS</span><h2>{availabilityRooms.length} rooms available</h2><p>{dateLabel(checkInDate, { month: "long", day: "numeric" })} – {dateLabel(checkOutDate, { month: "long", day: "numeric", year: "numeric" })} · {guestCount} guests · {getNights(checkInDate, checkOutDate)} nights</p></div>
                <label className="room-sort-select"><span>Sort by</span><select value={availabilitySort} onChange={(event) => setAvailabilitySort(event.target.value)}><option value="recommended">Recommended</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select></label>
              </div>
              {availabilityRooms.length ? <div className="available-room-grid">
                {availabilityRooms.filter(roomSearchMatches).map((room) => (
                  <article className="available-room-card" key={room.id}>
                    <div className="available-room-photo" role="img" aria-label={`${room.type} interior`} style={{ backgroundImage: `linear-gradient(180deg,rgba(20,29,47,.02),rgba(20,29,47,.17)),url("${room.image}")` }}>
                      <StatusBadge status={room.status} /><span className="room-photo-floor">Floor {room.floor}</span>
                    </div>
                    <div className="available-room-copy"><div className="available-room-title"><div><span>ROOM {room.number}</span><h3>{room.type}</h3></div><strong>{currency(room.price)}<small> / night</small></strong></div>
                      <div className="available-room-specs"><span>{room.bed} bed</span><i /><span>Up to {room.capacity} guests</span><i /><span>Floor {room.floor}</span></div>
                      <div className="available-dates"><Icon name="check" size={14} /> Available for selected dates</div>
                      <div className="room-amenities">{room.amenities.slice(0, 4).map((amenity) => <span key={amenity}>{amenity}</span>)}</div>
                      <button className="outline-button room-reserve-button" onClick={() => { openReservation(room.number); setView("reservations"); }}>Reserve this room <Icon name="arrow" size={15} /></button>
                    </div>
                  </article>
                ))}
              </div> : <div className="panel room-no-results"><span className="empty-state-icon"><Icon name="search" size={19} /></span><strong>No rooms match those dates and filters.</strong><p>Try a different room type, guest count or price range. Room maintenance and active reservations are excluded.</p></div>}
            </div>
          ) : <div className="panel availability-hint"><span className="availability-hint-icon"><Icon name="calendar" size={20} /></span><div><strong>Availability is date-based</strong><p>A room occupied today can appear if its current stay ends before your selected check-in. Confirmed and pending reservations block overlapping dates.</p></div></div>}
        </section>
      )}

      {view === "reservations" && canSeeReservations && (
        <section className="room-content">
          <div className="reservation-summary-row">
            {[
              ["All bookings", reservations.length, "navy"],
              ["Awaiting confirmation", reservations.filter((item) => item.status === "Pending").length, "gold"],
              ["Confirmed stays", reservations.filter((item) => item.status === "Confirmed").length, "green"],
              ["Currently in house", reservations.filter((item) => item.status === "Checked In").length, "blue"],
            ].map(([label, value, color]) => <article className="reservation-summary-card" key={label as string}><i className={`summary-mark summary-${color}`} /><span>{label}</span><strong>{value}</strong></article>)}
          </div>
          <article className="panel reservation-list-panel">
            <div className="room-panel-heading reservation-list-heading"><div><span className="panel-overline">GUEST BOOKINGS</span><h2>All reservations</h2><p>Review guest stays, balances and booking status.</p></div>
              <div className="room-reservation-filters"><label className="room-filter-select"><span>Date</span><select value={reservationDateFilter} onChange={(event) => setReservationDateFilter(event.target.value)}><option>All dates</option><option>Arriving today</option><option>Upcoming</option><option>Past stays</option></select></label><label className="room-filter-select"><span>Status</span><select value={reservationFilter} onChange={(event) => setReservationFilter(event.target.value)}><option>All statuses</option>{reservationStatuses.map((status) => <option key={status}>{status}</option>)}</select></label></div>
            </div>
            <div className="table-scroll room-table-scroll"><table className="room-table"><thead><tr><th>RESERVATION / GUEST</th><th>ROOM</th><th>CHECK-IN</th><th>CHECK-OUT</th><th>GUESTS</th><th>TOTAL / PAYMENT</th><th>STATUS</th><th /></tr></thead>
              <tbody>{filteredReservations.map((reservation) => {
                const balance = Math.max(0, reservation.total - reservation.paid);
                const paymentStatus: PaymentStatus = balance === 0 ? "Paid" : reservation.paid > 0 ? "Partial" : "Unpaid";
                return <tr key={reservation.id}>
                  <td><button className="room-guest-link" onClick={() => setSelectedReservation(reservation.id)}><Avatar name={reservation.guestName} /><span><strong>{reservation.guestName}</strong><small>{reservation.id}</small></span></button></td>
                  <td><strong className="room-table-strong">{reservation.roomNumber}</strong><small className="room-table-muted">{reservation.roomType}</small></td>
                  <td>{dateLabel(reservation.checkIn)}</td><td>{dateLabel(reservation.checkOut)}</td><td>{reservation.guests}</td>
                  <td><strong className="room-table-strong">{currency(reservation.total)}</strong><small className="room-table-muted">{paymentStatus === "Paid" ? "Paid in full" : `${currency(balance)} due`}</small></td>
                  <td><StatusBadge status={reservation.status} /></td>
                  <td><button className="room-row-action" aria-label={`View reservation ${reservation.id}`} onClick={() => setSelectedReservation(reservation.id)}>···</button></td>
                </tr>;
              })}</tbody>
            </table></div>
            {!filteredReservations.length && <div className="room-table-empty">No reservations match your search and status filter.</div>}
            <div className="room-table-footer">Showing {filteredReservations.length} of {reservations.length} reservations <span>Local demo data · changes are saved in this browser</span></div>
          </article>
        </section>
      )}

      {view === "floor-plan" && (
        <section className="room-content">
          <div className="floor-toolbar">
            <div className="floor-status-key">{roomStatuses.map((status) => <span key={status}><i className={statusClass(status)} />{status}</span>)}</div>
            <div className="room-filter-controls">
              <label><Icon name="filter" size={15} /><select aria-label="Filter by floor" value={floorFilter} onChange={(event) => setFloorFilter(event.target.value)}><option>All floors</option>{[...new Set(rooms.map((room) => room.floor))].sort().map((floor) => <option key={floor} value={floor}>Floor {floor}</option>)}</select></label>
              <label><select aria-label="Filter by room type" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option>All room types</option>{roomTypes.map((type) => <option key={type.name}>{type.name}</option>)}</select></label>
              <label><select aria-label="Filter by room status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All statuses</option>{roomStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>
            </div>
          </div>
          <div className="floor-room-groups">{[...new Set(filteredRooms.map((room) => room.floor))].sort().map((floor) => (
            <section className="floor-group" key={floor}><div className="floor-group-heading"><h2>Floor {floor}</h2><span>{filteredRooms.filter((room) => room.floor === floor).length} rooms</span><i /></div>
              <div className="floor-room-grid">{filteredRooms.filter((room) => room.floor === floor).map((room) => {
                const guest = reservations.find((reservation) => reservation.roomNumber === room.number && reservation.status === "Checked In");
                return <article className={`floor-room-card ${statusClass(room.status)}`} key={room.id}>
                  <button className="floor-room-main" onClick={() => { setSelectedRoom(room.number); setDetailTab("details"); }}>
                    <div className="floor-room-top"><span className="floor-room-number">{room.number}</span><span className={`floor-room-status-dot ${statusClass(room.status)}`} /></div>
                    <span className="floor-room-type">{room.type}</span>
                    <StatusBadge status={room.status} />
                    {room.status === "Occupied" && guest && canSeeReservations ? <span className="floor-room-guest"><Avatar name={guest.guestName} />{guest.guestName}</span> : <span className="floor-room-guest room-room-empty">{room.capacity} guests · {room.bed}</span>}
                    {room.status === "Occupied" && guest && <small className="floor-room-checkout">Check-out {dateLabel(guest.checkOut)}</small>}
                  </button>
                  <label className="floor-status-select"><span className="sr-only">Update status for room {room.number}</span><select aria-label={`Update status for room ${room.number}`} value={room.status} onChange={(event) => changeRoomStatus(room, event.target.value as RoomStatus)}><option value={room.status}>{room.status}</option>{roomStatuses.filter((status) => status !== room.status).map((status) => <option key={status}>{status}</option>)}</select></label>
                </article>;
              })}</div>
            </section>
          ))}</div>
          {!filteredRooms.length && <div className="panel room-no-results"><strong>No rooms match these filters.</strong><p>Adjust the floor, type or status above.</p></div>}
        </section>
      )}

      {view === "operations" && canUseFrontDesk && (
        <section className="room-content">
          <div className="operation-overview">
            <article><span className="operation-icon operation-arrival"><Icon name="arrow" size={18} /></span><div><span>Arrivals due</span><strong>{arrivals.length}</strong><small>Pending confirmation included</small></div></article>
            <article><span className="operation-icon operation-departure"><Icon name="logout" size={18} /></span><div><span>Guests in house</span><strong>{departures.length}</strong><small>Outstanding payments are flagged</small></div></article>
            <article><span className="operation-icon operation-cleaning"><Icon name="activity" size={18} /></span><div><span>Rooms to turn</span><strong>{cleaningRooms.length}</strong><small>Housekeeping status</small></div></article>
          </div>
          <div className="operation-search-row"><label className="room-global-search operation-search"><Icon name="search" size={17} /><input placeholder="Find guest or reservation..." aria-label="Find guest or reservation" value={operationSearch} onChange={(event) => setOperationSearch(event.target.value)} /></label><span>Changes update the local room board and booking record.</span></div>
          <div className="operation-columns">
            <article className="panel operation-panel"><div className="room-panel-heading"><div><span className="panel-overline">ARRIVALS</span><h2>Check-in</h2><p>Verify today&apos;s arrivals and assign their reserved rooms.</p></div><span className="panel-count">{arrivals.length} due</span></div>
              <div className="operation-record-list">{arrivals.map((reservation) => <div className="operation-record" key={reservation.id}><Avatar name={reservation.guestName} /><div className="operation-record-main"><strong>{reservation.guestName}</strong><small>{reservation.id} · Room {reservation.roomNumber} · {reservation.guests} guests</small><small>Stay {dateLabel(reservation.checkIn)} – {dateLabel(reservation.checkOut)}</small></div><div className="operation-record-action"><StatusBadge status={reservation.status} />{reservation.status === "Pending" ? <button className="outline-button" onClick={() => setSelectedReservation(reservation.id)}>Review booking</button> : <button className="primary-button" disabled={reservation.checkIn > today} onClick={() => checkInGuest(reservation)}>Check in</button>}</div></div>)}
                {!arrivals.length && <div className="room-empty-copy operation-empty">No arrivals due today.</div>}
              </div>
            </article>
            <article className="panel operation-panel"><div className="room-panel-heading"><div><span className="panel-overline">DEPARTURES</span><h2>Check-out</h2><p>Review guest balances before completing a departure.</p></div><span className="panel-count">{departures.length} in house</span></div>
              <div className="operation-record-list">{departures.map((reservation) => {
                const balance = Math.max(0, reservation.total - reservation.paid);
                return <div className="operation-record" key={reservation.id}><Avatar name={reservation.guestName} /><div className="operation-record-main"><strong>{reservation.guestName}</strong><small>{reservation.id} · Room {reservation.roomNumber}</small><small>{balance ? `${currency(balance)} outstanding` : "No outstanding payment"}</small></div><div className="operation-record-action">{balance > 0 && <span className="payment-due">{currency(balance)} due</span>}<button className="outline-button" onClick={() => checkOutGuest(reservation)}>Check out</button></div></div>;
              })}
                {!departures.length && <div className="room-empty-copy operation-empty">No occupied rooms match your search.</div>}
              </div>
            </article>
            <article className="panel operation-panel transfer-panel"><div className="room-panel-heading"><div><span className="panel-overline">GUEST CARE</span><h2>Room transfer</h2><p>Move an in-house guest to an eligible room.</p></div><span className="operation-icon operation-transfer"><Icon name="arrow" size={18} /></span></div>
              <form className="transfer-form" onSubmit={transferGuest}>
                <label className="room-field"><span>Guest / occupied room</span><select value={transferReservationId} onChange={(event) => { setTransferReservationId(event.target.value); setTransferRoomNumber(""); }} required><option value="">Select an in-house guest</option>{reservations.filter((reservation) => reservation.status === "Checked In").map((reservation) => <option key={reservation.id} value={reservation.id}>{reservation.guestName} · {reservation.roomNumber}</option>)}</select></label>
                <label className="room-field"><span>Transfer to</span><select value={transferRoomNumber} onChange={(event) => setTransferRoomNumber(event.target.value)} required><option value="">Select an available room</option>{rooms.filter((room) => room.status === "Available" && room.number !== reservations.find((reservation) => reservation.id === transferReservationId)?.roomNumber && getRoomAvailability(room, reservations, today, reservations.find((reservation) => reservation.id === transferReservationId)?.checkOut ?? dateOffset(1)) && room.capacity >= (reservations.find((reservation) => reservation.id === transferReservationId)?.guests ?? 1)).map((room) => <option key={room.number} value={room.number}>{room.number} · {room.type} · Floor {room.floor}</option>)}</select></label>
                <label className="room-field"><span>Reason for transfer</span><textarea rows={2} placeholder="e.g. Guest request, room maintenance..." value={transferReason} onChange={(event) => setTransferReason(event.target.value)} required /></label>
                <button className="primary-button" type="submit" disabled={!transferReservationId || !transferRoomNumber || !transferReason.trim()}>Confirm room transfer</button>
              </form>
            </article>
            <article className="panel operation-panel cleaning-panel"><div className="room-panel-heading"><div><span className="panel-overline">HOUSEKEEPING</span><h2>Room cleaning</h2><p>Rooms that need service before their next stay.</p></div><label className="room-filter-select"><span className="sr-only">Cleaning filter</span><select value={cleaningFilter} onChange={(event) => setCleaningFilter(event.target.value)}><option>Needs cleaning</option><option>All rooms</option></select></label></div>
              <div className="cleaning-room-list">{rooms.filter((room) => cleaningFilter === "All rooms" ? ["Cleaning", "Available"].includes(room.status) : room.status === "Cleaning").map((room) => <div className="cleaning-room-row" key={room.number}><span className="cleaning-room-number">{room.number}</span><span><strong>{room.type}</strong><small>Floor {room.floor} · {room.bed} bed</small></span><StatusBadge status={room.status} />{room.status === "Cleaning" ? <button className="outline-button" onClick={() => changeRoomStatus(room, "Available")}>Mark ready</button> : <span className="ready-label"><Icon name="check" size={14} /> Ready</span>}</div>)}
                {!rooms.some((room) => room.status === "Cleaning") && cleaningFilter === "Needs cleaning" && <div className="room-empty-copy operation-empty">All rooms are clean and ready.</div>}
              </div>
              <p className="cleaning-note"><Icon name="activity" size={14} /> Marking a room ready records it as cleaned and ready for inspection.</p>
            </article>
          </div>
        </section>
      )}

      {view === "room-service" && canUseFrontDesk && (
        <section className="room-content">
          <RoomServiceWorkspace />
        </section>
      )}

      {view === "calendar" && canSeeReservations && (
        <section className="room-content">
          <div className="calendar-toolbar panel">
            <div className="calendar-date-control"><button aria-label="Previous period" onClick={() => {
              const next = new Date(`${calendarDate}T00:00:00Z`);
              next.setUTCDate(next.getUTCDate() - (calendarView === "Daily" ? 1 : calendarView === "Weekly" ? 7 : 30));
              setCalendarDate(next.toISOString().slice(0, 10));
            }}>‹</button><strong>{dateLabel(calendarDate, { month: "long", day: "numeric", year: "numeric" })}</strong><button aria-label="Next period" onClick={() => {
              const next = new Date(`${calendarDate}T00:00:00Z`);
              next.setUTCDate(next.getUTCDate() + (calendarView === "Daily" ? 1 : calendarView === "Weekly" ? 7 : 30));
              setCalendarDate(next.toISOString().slice(0, 10));
            }}>›</button><button className="calendar-today-button" onClick={() => setCalendarDate(today)}>Today</button></div>
            <div className="segmented-control room-calendar-segment">{(["Daily", "Weekly", "Monthly"] as const).map((period) => <button key={period} className={calendarView === period ? "active" : ""} onClick={() => setCalendarView(period)}>{period}</button>)}</div>
          </div>
          <div className="panel booking-calendar-panel">
            <div className="booking-calendar-legend"><span><i className="calendar-confirmed" />Confirmed</span><span><i className="calendar-pending" />Pending</span><span><i className="calendar-inhouse" />Checked in</span><span><i className="calendar-blocked" />Room unavailable</span><small>Select a booking block for details.</small></div>
            <div className="booking-calendar-scroll">
              <div className="booking-calendar-grid" style={{ "--calendar-columns": calendarView === "Daily" ? 1 : calendarView === "Weekly" ? 7 : 30 } as React.CSSProperties}>
                <div className="calendar-room-head">ROOM</div>
                {Array.from({ length: calendarView === "Daily" ? 1 : calendarView === "Weekly" ? 7 : 30 }, (_, index) => {
                  const day = new Date(`${calendarDate}T00:00:00Z`);
                  day.setUTCDate(day.getUTCDate() + index);
                  const iso = day.toISOString().slice(0, 10);
                  return <div className={`calendar-day-head${iso === today ? " calendar-is-today" : ""}`} key={iso}><span>{new Intl.DateTimeFormat("en-LK", { weekday: "short", timeZone: "UTC" }).format(day)}</span><strong>{new Intl.DateTimeFormat("en-LK", { day: "2-digit", timeZone: "UTC" }).format(day)}</strong></div>;
                })}
                {rooms.filter(roomSearchMatches).map((room) => {
                  const dayCount = calendarView === "Daily" ? 1 : calendarView === "Weekly" ? 7 : 30;
                  const end = new Date(`${calendarDate}T00:00:00Z`);
                  end.setUTCDate(end.getUTCDate() + dayCount);
                  const endDate = end.toISOString().slice(0, 10);
                  const roomReservations = reservations.filter((reservation) =>
                    reservation.roomNumber === room.number &&
                    isReservationBlocking(reservation) &&
                    datesOverlap(calendarDate, endDate, reservation.checkIn, reservation.checkOut),
                  );
                  return <div className="calendar-room-row" key={room.number}>
                    <button className="calendar-room-name" onClick={() => setSelectedRoom(room.number)}><strong>{room.number}</strong><small>{room.type}</small></button>
                    <div className="calendar-room-track">
                      {Array.from({ length: dayCount }, (_, index) => <i className={new Date(`${calendarDate}T00:00:00Z`).toISOString().slice(0, 10) === today ? "calendar-today-cell" : ""} key={index} />)}
                      {["Maintenance", "Out of Service"].includes(room.status) && <span className="calendar-booking calendar-blocked" style={{ gridColumn: `1 / span ${dayCount}` }} title={`${room.status} · Room unavailable`}><span>{room.status}</span></span>}
                      {roomReservations.map((reservation) => {
                        const startDiff = Math.max(0, Math.floor((Date.parse(`${reservation.checkIn}T00:00:00Z`) - Date.parse(`${calendarDate}T00:00:00Z`)) / 86_400_000));
                        const endDiff = Math.min(dayCount, Math.ceil((Date.parse(`${reservation.checkOut}T00:00:00Z`) - Date.parse(`${calendarDate}T00:00:00Z`)) / 86_400_000));
                        const span = Math.max(1, endDiff - startDiff);
                        return <button key={reservation.id} title={`${reservation.guestName} · ${reservation.id} · ${dateLabel(reservation.checkIn)} – ${dateLabel(reservation.checkOut)}`} className={`calendar-booking calendar-${reservation.status.toLowerCase().replaceAll(" ", "-")}`} style={{ gridColumn: `${startDiff + 1} / span ${span}` }} onClick={() => setSelectedReservation(reservation.id)}><span>{reservation.guestName}</span></button>;
                      })}
                    </div>
                  </div>;
                })}
              </div>
            </div>
          </div>
          <p className="calendar-note"><Icon name="calendar" size={15} /> Check-out dates are shown as the end of a stay, so rooms become bookable again that day.</p>
        </section>
      )}

      {view === "room-types" && canSeeRooms && (
        <section className="room-content">
          <div className="room-type-intro panel"><span className="room-type-intro-icon"><Icon name="building" size={21} /></span><div><strong>{roomTypes.length} room categories</strong><p>Changes to a category update the rate, capacity and amenities shown for its rooms.</p></div>{canManageRoomTypes && <button className="primary-button" onClick={() => { setEditingTypeName(null); setTypeDraft(roomTypeDraft()); setTypeError(""); setTypeModal(true); }}><span>+</span> Add room type</button>}</div>
          {!canManageRoomTypes && <div className="room-permission-note"><Icon name="shield" size={15} /> Room type pricing can be managed by a Hotel Manager or Super Admin.</div>}
          <div className="room-type-grid">{roomTypes.map((type, index) => {
            const count = rooms.filter((room) => room.type === type.name).length;
            return <article className="room-type-card panel" key={type.name}>
              <div className={`room-type-art room-type-art-${index % 7}`} style={{ backgroundImage: `linear-gradient(180deg,rgba(25,34,49,.03),rgba(25,34,49,.12)),url("${rooms.find((room) => room.type === type.name)?.image ?? initialRooms[index % initialRooms.length].image}")` }}><span>{count} {count === 1 ? "room" : "rooms"}</span><span className="room-type-tier">AURELIA COLLECTION</span></div>
              <div className="room-type-card-copy"><div className="room-type-heading"><h2>{type.name}</h2>{canManageRoomTypes && <button className="room-row-action" aria-label={`Edit ${type.name}`} onClick={() => { setEditingTypeName(type.name); setTypeDraft(roomTypeDraft(type)); setTypeError(""); setTypeModal(true); }}>···</button>}</div><p>{type.description}</p>
                <div className="room-type-rate"><strong>{currency(type.price)}</strong><span>per room / night</span></div>
                <div className="room-type-specs"><span>Up to {type.occupancy} guests</span><i /><span>{type.bed} bed</span></div>
                <div className="room-amenities">{type.amenities.map((amenity) => <span key={amenity}>{amenity}</span>)}</div>
              </div>
            </article>;
          })}</div>
        </section>
      )}

      {view === "overview" && !canSeeRooms && <PermissionNotice />}
      {view === "reservations" && !canSeeReservations && <PermissionNotice />}
      {view === "operations" && !canUseFrontDesk && <PermissionNotice />}
      {view === "room-service" && !canUseFrontDesk && <PermissionNotice />}

      {activeRoom && <div className="room-drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedRoom(null); }}>
        <aside className="room-detail-drawer" aria-label={`Room ${activeRoom.number} details`}>
          <div className="room-drawer-top"><div><span className="panel-overline">ROOM DETAILS</span><h2>Room {activeRoom.number}</h2></div><button className="icon-button" aria-label="Close room details" onClick={() => setSelectedRoom(null)}><Icon name="close" size={19} /></button></div>
          <div className="room-drawer-image" role="img" aria-label={`${activeRoom.type} room`} style={{ backgroundImage: `url("${activeRoom.image}")` }} />
          <div className="room-drawer-status"><StatusBadge status={activeRoom.status} /><span>Floor {activeRoom.floor} · {activeRoom.type}</span></div>
          <div className="room-drawer-tabs"><button className={detailTab === "details" ? "active" : ""} onClick={() => setDetailTab("details")}>Details</button><button className={detailTab === "activity" ? "active" : ""} onClick={() => setDetailTab("activity")}>Stay information</button></div>
          {detailTab === "details" ? <div className="room-detail-fields">
            <div><span>Room category</span><strong>{activeRoom.type}</strong></div><div><span>Bed configuration</span><strong>{activeRoom.bed}</strong></div><div><span>Maximum occupancy</span><strong>{activeRoom.capacity} guests</strong></div><div><span>Nightly rate</span><strong>{currency(activeRoom.price)}</strong></div>
            <div className="room-detail-amenities"><span>Amenities</span><div className="room-amenities">{activeRoom.amenities.map((amenity) => <span key={amenity}>{amenity}</span>)}</div></div>
            <label className="room-field"><span>Update current status</span><select value={activeRoom.status} onChange={(event) => changeRoomStatus(activeRoom, event.target.value as RoomStatus)}>{roomStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>
            {canSeeReservations && activeRoom.status === "Available" && <button className="primary-button" onClick={() => { setSelectedRoom(null); openReservation(activeRoom.number); setView("reservations"); }}>Create reservation</button>}
          </div> : <div className="room-detail-fields">
            {reservations.filter((reservation) => reservation.roomNumber === activeRoom.number).sort((a, b) => b.checkIn.localeCompare(a.checkIn)).map((reservation) => <button className="room-stay-record" key={reservation.id} onClick={() => { setSelectedRoom(null); setSelectedReservation(reservation.id); }}><span><strong>{reservation.guestName}</strong><small>{reservation.id}</small></span><StatusBadge status={reservation.status} /><small>{dateLabel(reservation.checkIn)} – {dateLabel(reservation.checkOut)}</small></button>)}
            {!reservations.some((reservation) => reservation.roomNumber === activeRoom.number) && <p className="room-empty-copy">No stay history for this room yet.</p>}
          </div>}
        </aside>
      </div>}

      {activeReservation && <div className="room-drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedReservation(null); }}>
        <aside className="room-detail-drawer reservation-detail-drawer" aria-label={`Reservation ${activeReservation.id}`}>
          <div className="room-drawer-top"><div><span className="panel-overline">RESERVATION DETAILS</span><h2>{activeReservation.id}</h2></div><button className="icon-button" aria-label="Close reservation details" onClick={() => setSelectedReservation(null)}><Icon name="close" size={19} /></button></div>
          <div className="reservation-detail-guest"><Avatar name={activeReservation.guestName} /><div><strong>{activeReservation.guestName}</strong><span>{activeReservation.email || "Email not provided"}</span><span>{activeReservation.phone}</span></div></div>
          <div className="room-drawer-status"><StatusBadge status={activeReservation.status} /><span>Room {activeReservation.roomNumber} · {activeReservation.roomType}</span></div>
          <div className="reservation-detail-list">
            <div><span>Check-in</span><strong>{dateLabel(activeReservation.checkIn, { weekday: "short", month: "long", day: "numeric", year: "numeric" })}</strong></div>
            <div><span>Check-out</span><strong>{dateLabel(activeReservation.checkOut, { weekday: "short", month: "long", day: "numeric", year: "numeric" })}</strong></div>
            <div><span>Guests</span><strong>{activeReservation.guests}</strong></div>
            <div><span>Length of stay</span><strong>{getNights(activeReservation.checkIn, activeReservation.checkOut)} nights</strong></div>
            <div><span>Reservation total</span><strong>{currency(activeReservation.total)}</strong></div>
            <div><span>Paid so far</span><strong>{currency(activeReservation.paid)}</strong></div>
            <div><span>Outstanding</span><strong className={activeReservation.total > activeReservation.paid ? "balance-outstanding" : ""}>{currency(Math.max(0, activeReservation.total - activeReservation.paid))}</strong></div>
            <div><span>Payment status</span><StatusBadge status={activeReservation.paid >= activeReservation.total ? "Paid" : activeReservation.paid > 0 ? "Partial" : "Unpaid"} /></div>
            {activeReservation.specialRequests && <div className="reservation-special-request"><span>Special requests</span><p>{activeReservation.specialRequests}</p></div>}
          </div>
          <div className="reservation-detail-actions">
            {["Pending", "Confirmed"].includes(activeReservation.status) && <button className="outline-button" onClick={() => { setSelectedReservation(null); openReservation(undefined, activeReservation); }}>Edit reservation</button>}
            {activeReservation.status === "Pending" && <button className="primary-button" onClick={() => { setReservations((current) => current.map((item) => item.id === activeReservation.id ? { ...item, status: "Confirmed" } : item)); notify("Reservation confirmed."); }}>Confirm reservation</button>}
            {activeReservation.status === "Confirmed" && canUseFrontDesk && activeReservation.checkIn <= today && <button className="primary-button" onClick={() => checkInGuest(activeReservation)}>Confirm check-in</button>}
            {activeReservation.status === "Checked In" && canUseFrontDesk && <button className="primary-button" onClick={() => checkOutGuest(activeReservation)}>Check out guest</button>}
            {["Pending", "Confirmed"].includes(activeReservation.status) && <button className="danger-text-button" onClick={() => cancelReservation(activeReservation)}>Cancel reservation</button>}
          </div>
        </aside>
      </div>}

      {reservationModal && <div className="room-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setReservationModal(false); }}>
        <section className="room-modal reservation-modal" role="dialog" aria-modal="true" aria-labelledby="reservation-modal-title">
          <div className="room-modal-heading"><div><span className="panel-overline">{editingReservation ? "UPDATE BOOKING" : "NEW GUEST BOOKING"}</span><h2 id="reservation-modal-title">{editingReservation ? "Edit reservation" : "Create reservation"}</h2><p>Choose dates and guest count to show only rooms that can be booked.</p></div><button className="icon-button" aria-label="Close reservation form" onClick={() => setReservationModal(false)}><Icon name="close" size={19} /></button></div>
          <form onSubmit={saveReservation}>
            <div className="room-form-section-title"><span>01</span> Guest details</div>
            <div className="room-form-grid"><label className="room-field"><span>Guest name *</span><input value={draft.guestName} onChange={(event) => setDraft({ ...draft, guestName: event.target.value })} placeholder="Full name" autoComplete="name" required /></label><label className="room-field"><span>Phone number *</span><input value={draft.phone} onChange={(event) => setDraft({ ...draft, phone: event.target.value })} placeholder="+94 77 000 0000" autoComplete="tel" required /></label><label className="room-field"><span>Email address</span><input type="email" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} placeholder="guest@example.com" autoComplete="email" /></label><label className="room-field"><span>Number of guests</span><select value={draft.guests} onChange={(event) => setDraft({ ...draft, guests: event.target.value, roomNumber: "" })}>{[1, 2, 3, 4, 5, 6].map((number) => <option key={number} value={number}>{number} {number === 1 ? "guest" : "guests"}</option>)}</select></label></div>
            <div className="room-form-section-title"><span>02</span> Stay & room</div>
            <div className="room-form-grid"><label className="room-field"><span>Check-in *</span><input type="date" value={draft.checkIn} onChange={(event) => setDraft({ ...draft, checkIn: event.target.value, roomNumber: "" })} required /></label><label className="room-field"><span>Check-out *</span><input type="date" value={draft.checkOut} min={draft.checkIn} onChange={(event) => setDraft({ ...draft, checkOut: event.target.value, roomNumber: "" })} required /></label><label className="room-field"><span>Room type</span><select value={draft.roomType} onChange={(event) => setDraft({ ...draft, roomType: event.target.value, roomNumber: "" })}><option value="">Any room type</option>{roomTypes.map((type) => <option key={type.name}>{type.name}</option>)}</select></label><label className="room-field"><span>Available room *</span><select value={draft.roomNumber} onChange={(event) => setDraft({ ...draft, roomNumber: event.target.value })} required><option value="">Select a room</option>{formAvailableRooms.map((room) => <option key={room.number} value={room.number}>{room.number} · {room.type} · {currency(room.price)} / night</option>)}</select><small>{formAvailableRooms.length} rooms available for these dates</small></label>
              <label className="room-field room-full-field"><span>Special requests</span><textarea rows={2} value={draft.specialRequests} onChange={(event) => setDraft({ ...draft, specialRequests: event.target.value })} placeholder="Accessibility needs, arrival time, occasion..." /></label>
            </div>
            <div className="room-price-summary"><span><strong>{draftNights}</strong> {draftNights === 1 ? "night" : "nights"} · {selectedDraftRoom ? `Room ${selectedDraftRoom.number}` : "Choose a room"}</span><strong>{currency(draftTotal)}</strong></div>
            <div className="room-form-grid room-booking-settings"><label className="room-field"><span>Reservation status</span><select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as "Pending" | "Confirmed" })}><option>Confirmed</option><option>Pending</option></select></label><label className="room-field"><span>Payment status</span><select value={draft.payment} onChange={(event) => setDraft({ ...draft, payment: event.target.value as PaymentStatus })}><option>Unpaid</option><option>Partial</option><option>Paid</option></select></label></div>
            {formError && <p className="room-form-error" role="alert">{formError}</p>}
            <div className="room-modal-actions"><button type="button" className="outline-button" onClick={() => setReservationModal(false)}>Discard</button><button type="submit" className="primary-button" disabled={!selectedDraftRoom}>{editingReservation ? "Save changes" : "Create reservation"}</button></div>
          </form>
        </section>
      </div>}

      {typeModal && <div className="room-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setTypeModal(false); }}>
        <section className="room-modal type-modal" role="dialog" aria-modal="true" aria-labelledby="type-modal-title">
          <div className="room-modal-heading"><div><span className="panel-overline">ROOM CATALOGUE</span><h2 id="type-modal-title">{editingTypeName ? "Edit room type" : "Add room type"}</h2><p>Set the room category details used throughout this workspace.</p></div><button className="icon-button" aria-label="Close room type form" onClick={() => setTypeModal(false)}><Icon name="close" size={19} /></button></div>
          <form onSubmit={saveRoomType}><div className="room-form-grid">
            <label className="room-field room-full-field"><span>Room type name *</span><input value={typeDraft.name} onChange={(event) => setTypeDraft({ ...typeDraft, name: event.target.value })} required /></label>
            <label className="room-field room-full-field"><span>Description *</span><textarea rows={2} value={typeDraft.description} onChange={(event) => setTypeDraft({ ...typeDraft, description: event.target.value })} required /></label>
            <label className="room-field"><span>Price per night (LKR) *</span><input type="number" min="1" value={typeDraft.price} onChange={(event) => setTypeDraft({ ...typeDraft, price: event.target.value })} required /></label>
            <label className="room-field"><span>Maximum guests *</span><select value={typeDraft.occupancy} onChange={(event) => setTypeDraft({ ...typeDraft, occupancy: event.target.value })}>{[1, 2, 3, 4, 5, 6, 8].map((number) => <option key={number} value={number}>{number} guests</option>)}</select></label>
            <label className="room-field"><span>Bed configuration *</span><input value={typeDraft.bed} onChange={(event) => setTypeDraft({ ...typeDraft, bed: event.target.value })} placeholder="King / twin / sofa bed" required /></label>
            <label className="room-field"><span>Amenities</span><input value={typeDraft.amenities} onChange={(event) => setTypeDraft({ ...typeDraft, amenities: event.target.value })} placeholder="Wi-Fi, Balcony, Mini bar" /><small>Separate amenities with commas.</small></label>
          </div>{typeError && <p className="room-form-error" role="alert">{typeError}</p>}<div className="room-modal-actions"><button type="button" className="outline-button" onClick={() => setTypeModal(false)}>Discard</button><button type="submit" className="primary-button">{editingTypeName ? "Save room type" : "Add room type"}</button></div></form>
        </section>
      </div>}

      {toast && <div className="room-toast" role="status"><Icon name="check" size={16} /><span>{toast}</span><button aria-label="Dismiss notification" onClick={() => setToast("")}><Icon name="close" size={14} /></button></div>}
    </div>
  );
}

function PermissionNotice() {
  return <div className="panel room-permission-panel"><span className="placeholder-icon"><Icon name="shield" size={23} /></span><strong>This area is not available to your role.</strong><p>Ask your administrator to review your room operations permissions.</p></div>;
}
