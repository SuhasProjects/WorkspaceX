"use client";

import { useState, type ReactNode } from "react";

const PRICING_COOKIE = "mai_pricing_url";
const PORTAL_COOKIE = "mai_billing_portal_url";

function readCookie(name: string): string | null {
  const match = document.cookie.split("; ").find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

interface LauncherProps { children: ReactNode; className?: string; onNavigate?: () => void }

/**
 * Sends the user to a page hosted by AWS Monetization. The URL was minted server-side at
 * sign-in and stored in a cookie, so clicking needs no backend call. A missing cookie means
 * the hosted session expired or was never started, which a fresh sign-in fixes.
 */
function HostedLauncher({ cookie, children, className, onNavigate }: LauncherProps & { cookie: string }) {
  const [error, setError] = useState("");
  return <>
    <button type="button" role="menuitem" className={className} onClick={() => {
      const url = readCookie(cookie);
      if (!url) { setError("Billing session expired. Sign out and back in."); return; }
      onNavigate?.();
      window.location.assign(url);
    }}>{children}</button>
    {error && <p className="feedback error" role="alert">{error}</p>}
  </>;
}

/** Opens the hosted pricing page, where plans are compared and subscribed to. */
export function ManagePlanButton(props: LauncherProps) { return <HostedLauncher cookie={PRICING_COOKIE} {...props} />; }

/** Opens the hosted billing portal: current plan, usage, invoices, change or cancel. */
export function ManageSubscriptionButton(props: LauncherProps) { return <HostedLauncher cookie={PORTAL_COOKIE} {...props} />; }
