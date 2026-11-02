"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/app/components/ui-icon";

export function LoginForm({ hotelName }: { hotelName: string }) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: formData.get("identifier"),
          password: formData.get("password"),
          rememberMe,
        }),
      });
      const result = (await response.json()) as {
        redirectTo?: string;
        error?: string;
      };
      if (!response.ok || !result.redirectTo) {
        setError(result.error ?? "Unable to sign in right now.");
        return;
      }
      router.replace(result.redirectTo);
      router.refresh();
    } catch {
      setError("We couldn’t reach the sign-in service. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-showcase" aria-label="Hotel operations platform">
        <div className="showcase-orb showcase-orb-one" />
        <div className="showcase-orb showcase-orb-two" />
        <div className="showcase-content">
          <Link className="brand-lockup brand-lockup-light" href="/" aria-label={`${hotelName} sign in`}>
            <span className="brand-mark"><Icon name="building" size={22} /></span>
            <span className="brand-name"><strong>{hotelName}</strong><small>HOTEL OPERATIONS</small></span>
          </Link>
          <div className="showcase-copy">
            <span className="eyebrow eyebrow-light">THE ART OF HOSPITALITY</span>
            <h1>Every detail,<br />beautifully in sync.</h1>
            <p>
              A thoughtful space to run your hotel, empower your team, and create
              stays worth remembering.
            </p>
          </div>
          <div className="showcase-footer">
            <span className="showcase-line" />
            <span>One place for exceptional stays</span>
            <span className="showcase-location">COLOMBO · SRI LANKA</span>
          </div>
        </div>
        <div className="showcase-architecture" aria-hidden="true">
          <div className="arch-sun" />
          <div className="arch-wall">
            <div className="arch-opening"><div className="arch-window" /></div>
            <div className="arch-shadow" />
          </div>
          <div className="arch-floor" />
          <div className="arch-plant arch-plant-left"><i /><i /><i /><i /><i /></div>
        </div>
      </section>

      <section className="login-panel">
        <div className="login-panel-inner">
          <div className="login-mobile-brand brand-lockup">
            <span className="brand-mark"><Icon name="building" size={22} /></span>
            <span className="brand-name"><strong>{hotelName}</strong><small>HOTEL OPERATIONS</small></span>
          </div>
          <div className="login-heading">
            <span className="eyebrow">WELCOME BACK</span>
            <h2>Sign in to your workspace</h2>
            <p>Enter your account details to continue.</p>
          </div>
          <form className="login-form" onSubmit={submit}>
            <label className="field-label" htmlFor="identifier">Email or username</label>
            <div className="input-wrap">
              <Icon name="user" size={18} />
              <input
                autoComplete="username"
                id="identifier"
                name="identifier"
                placeholder="name@hotel.com"
                required
              />
            </div>

            <div className="field-label-row">
              <label className="field-label" htmlFor="password">Password</label>
              <button
                className="text-button forgot-button"
                type="button"
                onClick={() => setError("Please contact your Super Admin to securely reset your password.")}
              >
                Forgot password?
              </button>
            </div>
            <div className="input-wrap">
              <Icon name="key" size={18} />
              <input
                autoComplete="current-password"
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                required
              />
              <button
                className="icon-button password-toggle"
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((value) => !value)}
              >
                <Icon name={showPassword ? "eyeOff" : "eye"} size={18} />
              </button>
            </div>

            <label className="remember-option">
              <input
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
                type="checkbox"
              />
              <span className="custom-checkbox"><Icon name="check" size={13} /></span>
              <span>Keep me signed in</span>
            </label>

            {error && (
              <div className="form-alert" role="alert">
                <Icon name="alert" size={18} />
                <span>{error}</span>
              </div>
            )}

            <button className="primary-button login-submit" disabled={loading} type="submit">
              {loading ? <span className="spinner" /> : null}
              {loading ? "Signing in..." : "Sign in"}
              {!loading && <Icon name="arrow" size={18} />}
            </button>
          </form>

          <div className="login-security">
            <Icon name="shield" size={17} />
            <span>Your account is protected with secure, encrypted access.</span>
          </div>
          <div className="login-copyright">
            <span>© {new Date().getFullYear()} Aurelia Hotel Collection</span>
            <span>Privacy&nbsp; · &nbsp;Support</span>
          </div>
        </div>
      </section>
    </main>
  );
}
