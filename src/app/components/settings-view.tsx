"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/app/components/ui-icon";
import { PortalShell } from "@/app/components/portal-shell";
import type { CurrentUser } from "@/lib/auth";

type SettingsData = {
  hotel: Record<string, string>;
  profile: {
    firstName: string;
    lastName: string;
    email: string;
    preferences: Record<string, unknown>;
  };
};

const defaultPreferences = {
  emailUpdates: true,
  securityAlerts: true,
  weeklyReports: false,
};

export function SettingsView({
  user,
  dateLabel,
  canManageHotel,
  hotelName,
  demoMode = false,
}: {
  user: CurrentUser;
  dateLabel: string;
  canManageHotel: boolean;
  hotelName: string;
  demoMode?: boolean;
}) {
  const router = useRouter();
  const [data, setData] = useState<SettingsData>({
    hotel: { currency: "LKR", timezone: "Asia/Colombo" },
    profile: { firstName: user.firstName, lastName: user.lastName, email: user.email, preferences: {} },
  });
  const [tab, setTab] = useState(canManageHotel ? "hotel" : "profile");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/settings", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as SettingsData & { error?: string };
        if (!response.ok) throw new Error(result.error ?? "Unable to load settings.");
        if (active) {
          setData({
            hotel: { currency: "LKR", timezone: "Asia/Colombo", ...result.hotel },
            profile: {
              ...result.profile,
              preferences: {
                ...defaultPreferences,
                ...(typeof result.profile.preferences === "object" && result.profile.preferences !== null
                  ? result.profile.preferences
                  : {}),
              },
            },
          });
        }
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Unable to load settings.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    const formData = new FormData(event.currentTarget);
    const profile = {
      firstName: String(formData.get("firstName") ?? ""),
      lastName: String(formData.get("lastName") ?? ""),
      email: String(formData.get("email") ?? ""),
    };
    const hotel = {
      hotelName: String(formData.get("hotelName") ?? ""),
      hotelAddress: String(formData.get("hotelAddress") ?? ""),
      hotelEmail: String(formData.get("hotelEmail") ?? ""),
      hotelPhone: String(formData.get("hotelPhone") ?? ""),
      hotelLogoUrl: String(formData.get("hotelLogoUrl") ?? ""),
      currency: String(formData.get("currency") ?? "LKR"),
      timezone: String(formData.get("timezone") ?? "Asia/Colombo"),
    };
    const preferences = {
      emailUpdates: formData.get("emailUpdates") === "on",
      securityAlerts: formData.get("securityAlerts") === "on",
      weeklyReports: formData.get("weeklyReports") === "on",
    };

    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(tab === "profile" && { profile }),
          ...(tab === "notifications" && { preferences }),
          ...(tab === "hotel" && canManageHotel && { hotel }),
          ...(newPassword && { currentPassword, newPassword }),
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to save settings.");
      setMessage(newPassword ? "Settings saved. Sign in again with your new password." : "Your settings have been saved.");
      setCurrentPassword("");
      setNewPassword("");
      router.refresh();
      if (newPassword) {
        window.setTimeout(async () => {
          await fetch("/api/auth/logout", { method: "POST" });
          router.replace("/");
          router.refresh();
        }, 1200);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save settings.");
    } finally {
      setSaving(false);
    }
  }

  function updatePreference(key: string, value: boolean) {
    setData((current) => ({
      ...current,
      profile: {
        ...current.profile,
        preferences: { ...current.profile.preferences, [key]: value },
      },
    }));
  }

  const preference = (key: string) => data.profile.preferences[key] !== false;

  return (
    <PortalShell user={user} dateLabel={dateLabel} hotelName={hotelName} demoMode={demoMode}>
      <div className="settings-page">
        <div className="page-heading">
          <div><div className="breadcrumb">Workspace <Icon name="chevron" size={14} /> Settings</div><h1>Settings</h1><p>Make this workspace feel like yours.</p></div>
        </div>
        {error && <div className="inline-alert" role="alert"><Icon name="alert" size={18} />{error}</div>}
        {message && <div className="inline-success" role="status"><Icon name="check" size={18} />{message}</div>}
        <div className="settings-layout">
          <aside className="settings-nav">
            <span className="settings-nav-label">PREFERENCES</span>
            {canManageHotel && <button className={tab === "hotel" ? "active" : ""} onClick={() => setTab("hotel")}><Icon name="building" size={18} />Hotel information</button>}
            <button className={tab === "profile" ? "active" : ""} onClick={() => setTab("profile")}><Icon name="user" size={18} />My profile</button>
            <button className={tab === "notifications" ? "active" : ""} onClick={() => setTab("notifications")}><Icon name="bell" size={18} />Notifications</button>
            <button className={tab === "system" ? "active" : ""} onClick={() => setTab("system")}><Icon name="settings" size={18} />System preferences</button>
            <div className="settings-nav-note"><Icon name="shield" size={17} /><span>Your account access is protected by role-based permissions.</span></div>
          </aside>

          <form className="panel settings-form" onSubmit={save}>
            {loading ? <div className="table-loading"><span className="spinner" />Loading preferences...</div> : (
              <>
                {tab === "hotel" && canManageHotel && (
                  <>
                    <div className="settings-form-heading"><span className="settings-large-icon"><Icon name="building" size={21} /></span><div><h2>Hotel information</h2><p>These details are used across your hotel workspace.</p></div></div>
                    <div className="settings-fields">
                      <div className="setting-field full-width"><label className="field-label" htmlFor="hotelName">Hotel name</label><input className="text-input" id="hotelName" name="hotelName" defaultValue={data.hotel.hotelName ?? ""} placeholder="Your hotel name" maxLength={120} /></div>
                      <div className="setting-field full-width"><label className="field-label" htmlFor="hotelAddress">Address</label><textarea className="text-input text-area" id="hotelAddress" name="hotelAddress" defaultValue={data.hotel.hotelAddress ?? ""} placeholder="Hotel street address" maxLength={500} rows={3} /></div>
                      <div className="setting-field"><label className="field-label" htmlFor="hotelEmail">Contact email</label><input className="text-input" id="hotelEmail" name="hotelEmail" type="email" defaultValue={data.hotel.hotelEmail ?? ""} placeholder="hello@yourhotel.com" /></div>
                      <div className="setting-field"><label className="field-label" htmlFor="hotelPhone">Phone number</label><input className="text-input" id="hotelPhone" name="hotelPhone" defaultValue={data.hotel.hotelPhone ?? ""} placeholder="+94 11 000 0000" maxLength={60} /></div>
                      <div className="setting-field full-width"><label className="field-label" htmlFor="hotelLogoUrl">Hotel logo URL</label><input className="text-input" id="hotelLogoUrl" name="hotelLogoUrl" type="url" defaultValue={data.hotel.hotelLogoUrl ?? ""} placeholder="https://example.com/logo.png" /></div>
                      <div className="setting-field"><label className="field-label" htmlFor="currency">Currency</label><select className="text-input" name="currency" id="currency" defaultValue={data.hotel.currency ?? "LKR"}><option value="LKR">Sri Lankan Rupee (LKR)</option><option value="USD">US Dollar (USD)</option><option value="EUR">Euro (EUR)</option><option value="GBP">British Pound (GBP)</option></select></div>
                      <div className="setting-field"><label className="field-label" htmlFor="timezone">Timezone</label><select className="text-input" name="timezone" id="timezone" defaultValue={data.hotel.timezone ?? "Asia/Colombo"}><option value="Asia/Colombo">Asia/Colombo (UTC+05:30)</option><option value="Asia/Dubai">Asia/Dubai (UTC+04:00)</option><option value="Asia/Singapore">Asia/Singapore (UTC+08:00)</option><option value="Europe/London">Europe/London</option><option value="America/New_York">America/New_York</option></select></div>
                    </div>
                  </>
                )}
                {tab === "profile" && (
                  <>
                    <div className="settings-form-heading"><span className="settings-large-icon"><Icon name="user" size={21} /></span><div><h2>My profile</h2><p>Update your personal details and password.</p></div></div>
                    <div className="settings-fields">
                      <div className="setting-field"><label className="field-label" htmlFor="firstName">First name</label><input className="text-input" id="firstName" name="firstName" defaultValue={data.profile.firstName} maxLength={80} required /></div>
                      <div className="setting-field"><label className="field-label" htmlFor="lastName">Last name</label><input className="text-input" id="lastName" name="lastName" defaultValue={data.profile.lastName} maxLength={80} required /></div>
                      <div className="setting-field full-width"><label className="field-label" htmlFor="profileEmail">Email address</label><input className="text-input" id="profileEmail" name="email" type="email" defaultValue={data.profile.email} required maxLength={254} /></div>
                    </div>
                    <div className="settings-subsection"><h3>Change password</h3><p>Use a unique password with at least 12 characters.</p><div className="settings-fields"><div className="setting-field"><label className="field-label" htmlFor="currentPassword">Current password</label><input className="text-input" id="currentPassword" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></div><div className="setting-field"><label className="field-label" htmlFor="newPassword">New password</label><input className="text-input" id="newPassword" type="password" autoComplete="new-password" minLength={12} maxLength={200} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></div></div></div>
                  </>
                )}
                {tab === "notifications" && (
                  <>
                    <div className="settings-form-heading"><span className="settings-large-icon"><Icon name="bell" size={21} /></span><div><h2>Notifications</h2><p>Choose what updates you’d like to receive.</p></div></div>
                    <div className="preference-list">
                      <PreferenceToggle title="Email updates" detail="Receive important property and reservation updates." name="emailUpdates" checked={preference("emailUpdates")} onChange={updatePreference} />
                      <PreferenceToggle title="Security alerts" detail="Be notified when account access or permissions change." name="securityAlerts" checked={preference("securityAlerts")} onChange={updatePreference} />
                      <PreferenceToggle title="Weekly reports" detail="Receive a weekly summary of your hotel’s performance." name="weeklyReports" checked={preference("weeklyReports")} onChange={updatePreference} />
                    </div>
                  </>
                )}
                {tab === "system" && (
                  <>
                    <div className="settings-form-heading"><span className="settings-large-icon"><Icon name="settings" size={21} /></span><div><h2>System preferences</h2><p>Workspace defaults for your account.</p></div></div>
                    <div className="system-preference-card"><span className="system-pref-icon"><Icon name="building" size={18} /></span><span><strong>Default currency</strong><small>Used for hotel reports and displayed amounts.</small></span><b>{data.hotel.currency ?? "LKR"}</b></div>
                    <div className="system-preference-card"><span className="system-pref-icon"><Icon name="calendar" size={18} /></span><span><strong>Property timezone</strong><small>Used for arrival dates and scheduled activities.</small></span><b>{data.hotel.timezone ?? "Asia/Colombo"}</b></div>
                    <div className="system-preference-card"><span className="system-pref-icon"><Icon name="shield" size={18} /></span><span><strong>Appearance</strong><small>Light theme is active for this workspace.</small></span><b>Light</b></div>
                  </>
                )}
                <div className="settings-save-row"><span><Icon name="shield" size={15} />Changes are saved securely to your account.</span><button className="primary-button" type="submit" disabled={saving}>{saving ? <span className="spinner" /> : <Icon name="check" size={16} />}{saving ? "Saving..." : "Save changes"}</button></div>
              </>
            )}
          </form>
        </div>
      </div>
    </PortalShell>
  );
}

function PreferenceToggle({
  title,
  detail,
  name,
  checked,
  onChange,
}: {
  title: string;
  detail: string;
  name: string;
  checked: boolean;
  onChange: (name: string, value: boolean) => void;
}) {
  return (
    <label className="preference-row">
      <span><strong>{title}</strong><small>{detail}</small></span>
      <span className={`switch${checked ? " switch-on" : ""}`}><input type="checkbox" name={name} checked={checked} onChange={(event) => onChange(name, event.target.checked)} /><i /></span>
    </label>
  );
}
