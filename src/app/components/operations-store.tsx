"use client";

import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import {
  initialHousekeepers,
  initialInventory,
  initialMenu,
  initialOrders,
  initialShifts,
  initialStockRequests,
  initialStockMovements,
  initialTasks,
  type Housekeeper,
  type HousekeepingTask,
  type InventoryItem,
  type MenuItem,
  type RestaurantOrder,
  type StaffShift,
  type StockRequest,
  type StockMovement,
} from "@/lib/operations-data";
import { initialReservations, initialRooms, type HotelRoom, type Reservation } from "@/lib/room-management-data";

type OperationsStore = {
  rooms: HotelRoom[];
  setRooms: Dispatch<SetStateAction<HotelRoom[]>>;
  reservations: Reservation[];
  setReservations: Dispatch<SetStateAction<Reservation[]>>;
  employees: Housekeeper[];
  setEmployees: Dispatch<SetStateAction<Housekeeper[]>>;
  tasks: HousekeepingTask[];
  setTasks: Dispatch<SetStateAction<HousekeepingTask[]>>;
  shifts: StaffShift[];
  setShifts: Dispatch<SetStateAction<StaffShift[]>>;
  inventory: InventoryItem[];
  setInventory: Dispatch<SetStateAction<InventoryItem[]>>;
  requests: StockRequest[];
  setRequests: Dispatch<SetStateAction<StockRequest[]>>;
  movements: StockMovement[];
  setMovements: Dispatch<SetStateAction<StockMovement[]>>;
  menu: MenuItem[];
  setMenu: Dispatch<SetStateAction<MenuItem[]>>;
  orders: RestaurantOrder[];
  setOrders: Dispatch<SetStateAction<RestaurantOrder[]>>;
  roomBalances: Record<string, number>;
  setRoomBalances: Dispatch<SetStateAction<Record<string, number>>>;
};

const OperationsContext = createContext<OperationsStore | null>(null);

export function OperationsProvider({ children }: { children: ReactNode }) {
  const [rooms, setRooms] = useState(initialRooms);
  const [reservations, setReservations] = useState(initialReservations);
  const [employees, setEmployees] = useState(initialHousekeepers);
  const [tasks, setTasks] = useState(initialTasks);
  const [shifts, setShifts] = useState(initialShifts);
  const [inventory, setInventory] = useState(initialInventory);
  const [requests, setRequests] = useState(initialStockRequests);
  const [movements, setMovements] = useState(initialStockMovements);
  const [menu, setMenu] = useState(initialMenu);
  const [orders, setOrders] = useState(initialOrders);
  const [roomBalances, setRoomBalances] = useState<Record<string, number>>({});

  return (
    <OperationsContext.Provider value={{
      rooms, setRooms, reservations, setReservations,
      employees, setEmployees, tasks, setTasks, shifts, setShifts,
      inventory, setInventory, requests, setRequests, movements, setMovements, menu, setMenu,
      orders, setOrders, roomBalances, setRoomBalances,
    }}>
      {children}
    </OperationsContext.Provider>
  );
}

export function useOperationsStore() {
  const store = useContext(OperationsContext);
  if (!store) throw new Error("OperationsProvider is missing from this workspace.");
  return store;
}
