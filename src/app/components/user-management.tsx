"use client";

import { useCallback, useMemo, useState, type FormEvent } from "react";
import { Icon } from "@/app/components/ui-icon";
import { PortalShell } from "@/app/components/portal-shell";
import type { CurrentUser } from "@/lib/auth";

type ManagedUser = {
  id: string;
  email: string;
  username: string | null;
  firstName: string;
  lastName: string;
  isActive: boolean;
  roleId: string;
  createdAt: string;
  updatedAt: string;
  role: { name: string };
};
type RoleOption = { id: string; name: string };
type UserResponse = { users: ManagedUser[]; roles: RoleOption[] };

export function UserManagement({
  user,
  dateLabel,
  initialUsers,
  initialRoles,
  hotelName,
  demoMode = false,
}: {
  user: CurrentUser;
  dateLabel: string;
  initialUsers: ManagedUser[];
  initialRoles: RoleOption[];
  hotelName: string;
  demoMode?: boolean;
}) {
  const [users, setUsers] = useState<ManagedUser[]>(initialUsers);
  const [roles, setRoles] = useState<RoleOption[]>(initialRoles);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modal, setModal] = useState<"create" | "edit" | "view" | "password" | null>(null);
  const [selected, setSelected] = useState<ManagedUser | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/users", { cache: "no-store" });
      const result = (await response.json()) as UserResponse & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to load users.");
      setError("");
      setUsers(result.users);
      setRoles(result.roles);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load users.");
    } finally {
      setLoading(false);
    }
  }, []);

  const filteredUsers = useMemo(() => users.filter((item) => {
    const matchesText = `${item.firstName} ${item.lastName} ${item.email} ${item.username ?? ""}`
      .toLowerCase()
      .includes(query.trim().toLowerCase());
    const matchesRole = roleFilter === "all" || item.roleId === roleFilter;
    const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? item.isActive : !item.isActive);
    return matchesText && matchesRole && matchesStatus;
  }), [users, query, roleFilter, statusFilter]);
  const activeCount = users.filter((item) => item.isActive).length;

  function openModal(kind: typeof modal, account: ManagedUser | null = null) {
    setSelected(account);
    setModal(kind);
    setError("");
    setSuccess("");
  }

  async function submitUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!modal || modal === "view" || modal === "password") return;
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const payload: Record<string, string> = {
      firstName: String(form.get("firstName") ?? ""),
      lastName: String(form.get("lastName") ?? ""),
      email: String(form.get("email") ?? ""),
      roleId: String(form.get("roleId") ?? ""),
      username: String(form.get("username") ?? ""),
    };
    if (modal === "create") payload.password = String(form.get("password") ?? "");

    try {
      const response = await fetch(modal === "create" ? "/api/users" : `/api/users/${selected?.id}`, {
        method: modal === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to save this user.");
      setSuccess(modal === "create" ? "User created successfully." : "User details updated.");
      setModal(null);
      await reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save this user.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(account: ManagedUser) {
    setError("");
    const action = account.isActive ? "deactivate" : "reactivate";
    if (!window.confirm(`Are you sure you want to ${action} ${account.firstName} ${account.lastName}?`)) return;
    try {
      const response = await fetch(`/api/users/${account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !account.isActive }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? `Unable to ${action} this user.`);
      setSuccess(`User ${account.isActive ? "deactivated" : "reactivated"}.`);
      await reload();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : `Unable to ${action} this user.`);
    }
  }

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/users/${selected.id}/password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to reset the password.");
      setModal(null);
      setSuccess(`Password reset for ${selected.firstName} ${selected.lastName}.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to reset the password.");
    } finally {
      setSaving(false);
    }
  }

  const availableRoles = user.roleName === "Super Admin"
    ? roles
    : roles.filter((role) => role.name !== "Super Admin");

  return (
    <PortalShell user={user} dateLabel={dateLabel} hotelName={hotelName} demoMode={demoMode}>
      <div className="management-page">
        <div className="page-heading management-heading">
          <div>
            <div className="breadcrumb">Workspace <Icon name="chevron" size={14} /> User management</div>
            <h1>People & access</h1>
            <p>Manage your team, account access, and role assignments.</p>
          </div>
          <button className="primary-button" onClick={() => openModal("create")}><Icon name="users" size={17} />Add user</button>
        </div>

        {error && !modal && <div className="inline-alert" role="alert"><Icon name="alert" size={18} />{error}</div>}
        {success && <div className="inline-success" role="status"><Icon name="check" size={18} />{success}<button onClick={() => setSuccess("")} aria-label="Dismiss"><Icon name="close" size={16} /></button></div>}

        <section className="user-summary-grid">
          <article className="user-summary-card"><span className="user-summary-icon navy"><Icon name="users" size={20} /></span><span><small>Total accounts</small><strong>{users.length}</strong></span></article>
          <article className="user-summary-card"><span className="user-summary-icon green"><Icon name="check" size={20} /></span><span><small>Active users</small><strong>{activeCount}</strong></span></article>
          <article className="user-summary-card"><span className="user-summary-icon gold"><Icon name="shield" size={20} /></span><span><small>Access roles</small><strong>{roles.length}</strong></span></article>
          <article className="user-summary-card"><span className="user-summary-icon purple"><Icon name="activity" size={20} /></span><span><small>Inactive accounts</small><strong>{users.length - activeCount}</strong></span></article>
        </section>

        <section className="panel users-panel">
          <div className="users-panel-top">
            <div><h2>Team directory</h2><p>{filteredUsers.length} account{filteredUsers.length === 1 ? "" : "s"} shown</p></div>
            <div className="user-filters">
              <label className="table-search"><Icon name="search" size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search people..." aria-label="Search users" /></label>
              <label className="select-wrap"><span className="sr-only">Filter by role</span><select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}><option value="all">All roles</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label>
              <label className="select-wrap"><span className="sr-only">Filter by status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="all">Any status</option><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
            </div>
          </div>
          {loading ? <div className="table-loading"><span className="spinner" />Loading team accounts...</div> : filteredUsers.length ? (
            <div className="table-scroll users-table-scroll">
              <table className="users-table">
                <thead><tr><th>TEAM MEMBER</th><th>ROLE</th><th>STATUS</th><th>CREATED</th><th><span className="sr-only">Actions</span></th></tr></thead>
                <tbody>{filteredUsers.map((account) => (
                  <tr key={account.id}>
                    <td><span className="user-cell"><span className="avatar user-table-avatar">{`${account.firstName[0]}${account.lastName[0]}`.toUpperCase()}</span><span><strong>{account.firstName} {account.lastName}</strong><small>{account.email}{account.username ? ` · @${account.username}` : ""}</small></span></span></td>
                    <td><span className="role-tag"><Icon name="shield" size={14} />{account.role.name}</span></td>
                    <td><span className={`account-status ${account.isActive ? "is-active" : "is-inactive"}`}><i />{account.isActive ? "Active" : "Inactive"}</span></td>
                    <td className="created-date">{new Intl.DateTimeFormat("en-LK", { dateStyle: "medium", timeZone: "Asia/Colombo" }).format(new Date(account.createdAt))}</td>
                    <td><div className="user-actions">
                      <button className="icon-button" title="View details" aria-label={`View ${account.firstName}`} onClick={() => openModal("view", account)}><Icon name="eye" size={17} /></button>
                      <button className="icon-button" title="Edit user" aria-label={`Edit ${account.firstName}`} onClick={() => openModal("edit", account)}><Icon name="settings" size={17} /></button>
                      <button className="icon-button" title="Reset password" aria-label={`Reset ${account.firstName}'s password`} onClick={() => openModal("password", account)}><Icon name="key" size={17} /></button>
                      {account.id !== user.id && <button className="icon-button" title={account.isActive ? "Deactivate user" : "Reactivate user"} aria-label={`${account.isActive ? "Deactivate" : "Reactivate"} ${account.firstName}`} onClick={() => void toggleActive(account)}><Icon name={account.isActive ? "close" : "check"} size={17} /></button>}
                    </div></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <div className="users-empty"><span className="empty-state-icon"><Icon name="users" size={20} /></span><strong>{users.length ? "No matching accounts" : "No users have been added"}</strong><p>{users.length ? "Try adjusting your search or filters." : "Create a user account to start building your team."}</p>{!users.length && <button className="outline-button" onClick={() => openModal("create")}>Add your first user</button>}</div>}
        </section>
        <p className="user-management-footnote"><Icon name="shield" size={15} />User access changes are recorded in the system activity log.</p>
      </div>

      {modal && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null); }}>
          <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="user-modal-title">
            <div className="modal-header">
              <div><span className="panel-overline">{modal === "create" ? "TEAM ACCESS" : modal === "password" ? "ACCOUNT SECURITY" : "USER PROFILE"}</span><h2 id="user-modal-title">{modal === "create" ? "Add a team member" : modal === "edit" ? "Edit user" : modal === "view" ? "User details" : "Reset password"}</h2></div>
              <button className="icon-button" aria-label="Close dialog" onClick={() => setModal(null)}><Icon name="close" size={19} /></button>
            </div>
            {modal === "password" ? (
              <form className="modal-form" onSubmit={submitPassword}>
                <p className="modal-description">Set a new password for {selected?.firstName} {selected?.lastName}. They will need to sign in again.</p>
                <label className="field-label" htmlFor="reset-password">New password</label>
                <input className="text-input" id="reset-password" name="password" type="password" minLength={12} maxLength={200} required autoComplete="new-password" />
                <small className="field-hint">Use at least 12 characters. Resetting a password invalidates the user’s existing sessions.</small>
                {error && <div className="form-alert" role="alert"><Icon name="alert" size={17} />{error}</div>}
                <div className="modal-actions"><button type="button" className="outline-button" onClick={() => setModal(null)}>Cancel</button><button type="submit" className="primary-button" disabled={saving}>{saving ? <span className="spinner" /> : <Icon name="key" size={16} />}{saving ? "Saving..." : "Reset password"}</button></div>
              </form>
            ) : modal === "view" ? (
              <div className="user-detail-list">
                <div><small>Full name</small><strong>{selected?.firstName} {selected?.lastName}</strong></div>
                <div><small>Email</small><strong>{selected?.email}</strong></div>
                <div><small>Username</small><strong>{selected?.username ? `@${selected.username}` : "Not set"}</strong></div>
                <div><small>Assigned role</small><strong>{selected?.role.name}</strong></div>
                <div><small>Account status</small><strong>{selected?.isActive ? "Active" : "Inactive"}</strong></div>
                <div><small>Created on</small><strong>{selected ? new Intl.DateTimeFormat("en-LK", { dateStyle: "long", timeZone: "Asia/Colombo" }).format(new Date(selected.createdAt)) : ""}</strong></div>
                <button className="primary-button" onClick={() => setModal("edit")}>Edit user</button>
              </div>
            ) : (
              <form className="modal-form" onSubmit={submitUser}>
                <div className="form-two-column">
                  <div><label className="field-label" htmlFor="firstName">First name</label><input className="text-input" id="firstName" name="firstName" defaultValue={selected?.firstName ?? ""} required maxLength={80} /></div>
                  <div><label className="field-label" htmlFor="lastName">Last name</label><input className="text-input" id="lastName" name="lastName" defaultValue={selected?.lastName ?? ""} required maxLength={80} /></div>
                </div>
                <div><label className="field-label" htmlFor="email">Email address</label><input className="text-input" id="email" name="email" type="email" defaultValue={selected?.email ?? ""} required maxLength={254} /></div>
                <div><label className="field-label" htmlFor="username">Username <span className="field-optional">Optional</span></label><input className="text-input" id="username" name="username" defaultValue={selected?.username ?? ""} minLength={3} maxLength={40} /></div>
                <div><label className="field-label" htmlFor="roleId">Role</label><select className="text-input" id="roleId" name="roleId" defaultValue={selected?.roleId ?? availableRoles[0]?.id ?? ""} required>{availableRoles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></div>
                {modal === "create" && <div><label className="field-label" htmlFor="password">Temporary password</label><input className="text-input" id="password" name="password" type="password" minLength={12} maxLength={200} required autoComplete="new-password" /><small className="field-hint">At least 12 characters. The password is never shown again.</small></div>}
                {error && <div className="form-alert" role="alert"><Icon name="alert" size={17} />{error}</div>}
                <div className="modal-actions"><button type="button" className="outline-button" onClick={() => setModal(null)}>Cancel</button><button type="submit" className="primary-button" disabled={saving}>{saving ? <span className="spinner" /> : <Icon name="check" size={16} />}{saving ? "Saving..." : modal === "create" ? "Create user" : "Save changes"}</button></div>
              </form>
            )}
          </section>
        </div>
      )}
    </PortalShell>
  );
}
