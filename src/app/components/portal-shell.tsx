"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { Icon } from "@/app/components/ui-icon";
import { OperationsProvider } from "@/app/components/operations-store";

type NavItem = {
  label: string;
  href: string;
  icon: "dashboard" | "building" | "calendar" | "users" | "wallet" | "wrench" | "chart" | "settings";
  permission: string;
};

const navigation: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: "dashboard", permission: "dashboard:view" },
  { label: "Room Management", href: "/modules/rooms", icon: "building", permission: "rooms:view" },
  { label: "Reservations", href: "/modules/reservations", icon: "calendar", permission: "reservations:view" },
  { label: "Front Desk", href: "/modules/front-desk", icon: "building", permission: "frontdesk:view" },
  { label: "Housekeeping", href: "/modules/housekeeping", icon: "users", permission: "housekeeping:view" },
  { label: "Restaurant", href: "/modules/restaurant", icon: "wallet", permission: "restaurant:view" },
  { label: "Inventory", href: "/modules/inventory", icon: "building", permission: "inventory:view" },
  { label: "Employees", href: "/modules/employees", icon: "users", permission: "employees:view" },
  { label: "Finance", href: "/modules/finance", icon: "wallet", permission: "finance:view" },
  { label: "Maintenance", href: "/modules/maintenance", icon: "wrench", permission: "maintenance:view" },
  { label: "Suppliers", href: "/modules/suppliers", icon: "building", permission: "suppliers:view" },
  { label: "Reports & Analytics", href: "/modules/reports", icon: "chart", permission: "reports:view" },
];

type UserSummary = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  roleName: string;
  permissions: string[];
};

type Activity = { id: string; action: string; entity: string; actor: string; createdAt: string };

export function PortalShell({
  user,
  dateLabel,
  activities = [],
  hotelName = "Aurelia Hotel Collection",
  demoMode = false,
  children,
}: {
  user: UserSummary;
  dateLabel: string;
  activities?: Activity[];
  hotelName?: string;
  demoMode?: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [logoutError, setLogoutError] = useState("");

  const visibleNavigation = useMemo(() => {
    const items = navigation.filter((item) => user.permissions.includes(item.permission));
    if (user.permissions.includes("users:manage")) {
      items.push({
        label: "User Management",
        href: "/users",
        icon: "users",
        permission: "users:manage",
      });
    }
    if (user.permissions.includes("settings:view")) {
      items.push({
        label: "Settings",
        href: "/settings",
        icon: "settings",
        permission: "settings:view",
      });
    }
    return items;
  }, [user.permissions]);
  const searchResults = search.trim()
    ? visibleNavigation.filter((item) => item.label.toLowerCase().includes(search.trim().toLowerCase()))
    : [];
  const initials = `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();

  async function logout() {
    setLogoutError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) {
        setLogoutError("Unable to sign out. Please try again.");
        return;
      }
      router.replace("/");
      router.refresh();
    } catch {
      setLogoutError("Unable to sign out. Please check your connection.");
    }
  }

  return (
    <div className={`app-frame${collapsed ? " sidebar-is-collapsed" : ""}${mobileOpen ? " mobile-sidebar-open" : ""}`}>
      {mobileOpen && <button className="mobile-backdrop" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <a className="brand-lockup" href="/dashboard" title={hotelName}>
            <span className="brand-mark"><Icon name="building" size={20} /></span>
            <span className="brand-name"><strong>{hotelName}</strong><small>HOTEL OPERATIONS</small></span>
          </a>
          <button className="icon-button sidebar-collapse" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            <Icon name="menu" size={19} />
          </button>
        </div>
        <div className="sidebar-section-label">WORKSPACE</div>
        <nav className="sidebar-navigation" aria-label="Main navigation">
          {visibleNavigation.map((item) => {
            const active = pathname === item.href || (item.href.startsWith("/modules/") && pathname === item.href);
            return (
              <Link
                className={`sidebar-link${active ? " active" : ""}`}
                href={item.href}
                key={item.href}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? item.label : undefined}
              >
                <Icon name={item.icon} size={19} />
                <span>{item.label}</span>
                {active && <i className="sidebar-active-mark" />}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-help-card">
            <span className="help-icon"><Icon name="shield" size={18} /></span>
            <div><strong>Need a hand?</strong><small>Your team is here to help.</small></div>
            <Icon name="chevron" size={15} />
          </div>
          <button className="sidebar-user" onClick={() => setProfileOpen(!profileOpen)}>
            <span className="avatar avatar-sidebar">{initials}</span>
            <span className="sidebar-user-copy"><strong>{user.firstName} {user.lastName}</strong><small>{user.roleName}</small></span>
            <Icon name="chevron" size={16} />
          </button>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu-button" onClick={() => setMobileOpen(true)} aria-label="Open navigation">
              <Icon name="menu" size={21} />
            </button>
            {demoMode && <span className="demo-mode-badge"><i />LOCAL DEMO · NOT SAVED</span>}
            <div className="global-search">
              <Icon name="search" size={18} />
              <input
                aria-label="Search navigation"
                placeholder="Search anything..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && searchResults[0]) {
                    router.push(searchResults[0].href);
                    setSearch("");
                  }
                  if (event.key === "Escape") setSearch("");
                }}
              />
              <kbd>⌘ K</kbd>
              {search && (
                <div className="search-results">
                  {searchResults.length ? searchResults.map((item) => (
                    <Link href={item.href} key={item.href} onClick={() => setSearch("")}>
                      <Icon name={item.icon} size={17} />{item.label}<Icon name="arrow" size={15} />
                    </Link>
                  )) : <span className="search-empty">No matching sections</span>}
                </div>
              )}
            </div>
          </div>
          <div className="topbar-right">
            <span className="topbar-date"><Icon name="calendar" size={16} />{dateLabel}</span>
            <div className="topbar-menu-wrap">
              <button className={`icon-button notification-button${notificationsOpen ? " selected" : ""}`} onClick={() => { setNotificationsOpen(!notificationsOpen); setProfileOpen(false); }} aria-label="Notifications">
                <Icon name="bell" size={19} />
                {activities.length > 0 && <span className="notification-dot" />}
              </button>
              {notificationsOpen && (
                <div className="popover notification-popover">
                  <div className="popover-heading"><strong>Recent activity</strong><span>{activities.length}</span></div>
                  {activities.length ? activities.slice(0, 4).map((activity) => (
                    <div className="notification-item" key={activity.id}>
                      <span className="notification-icon"><Icon name="activity" size={15} /></span>
                      <span><strong>{activity.action}</strong><small>{activity.actor} · {activity.entity}</small></span>
                    </div>
                  )) : <div className="popover-empty">You’re all caught up.</div>}
                </div>
              )}
            </div>
            <span className="topbar-divider" />
            <div className="topbar-menu-wrap">
              <button className="topbar-profile" onClick={() => { setProfileOpen(!profileOpen); setNotificationsOpen(false); }}>
                <span className="avatar">{initials}</span>
                <span className="topbar-profile-copy"><strong>{user.firstName} {user.lastName}</strong><small>{user.roleName}</small></span>
                <Icon name="chevron" size={16} />
              </button>
              {profileOpen && (
                <div className="popover profile-popover">
                  <div className="profile-popover-heading">
                    <span className="avatar">{initials}</span>
                    <span><strong>{user.firstName} {user.lastName}</strong><small>{user.email}</small></span>
                  </div>
                  <Link href="/settings" onClick={() => setProfileOpen(false)}><Icon name="settings" size={17} />Profile & settings</Link>
                  <button onClick={logout}><Icon name="logout" size={17} />Sign out</button>
                  {logoutError && <p className="popover-error" role="alert">{logoutError}</p>}
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="page-content"><OperationsProvider>{children}</OperationsProvider></main>
      </div>
    </div>
  );
}
