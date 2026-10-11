"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ApiResponse, BillingSummary, CheckoutResult, Plan } from "@/types/contracts";
import { PLANS, PLAN_ROWS } from "@/lib/billing/plans";
import { Atmosphere } from "@/components/dashboard/atmosphere";
import { useWidgetTheme } from "@/components/dashboard/use-workspace-widgets";

type BillingState = { status: "loading" } | { status: "signed_out" } | { status: "ready"; billing: BillingSummary };

export function PricingPage() {
  const theme = useWidgetTheme();
  const [state, setState] = useState<BillingState>({ status: "loading" });
  const [busyPlan, setBusyPlan] = useState<Plan | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/billing", { credentials: "same-origin", cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (response.status === 401) { setState({ status: "signed_out" }); return; }
        const result = (await response.json()) as ApiResponse<BillingSummary>;
        setState(result.data ? { status: "ready", billing: result.data } : { status: "signed_out" });
      })
      .catch(() => { if (!controller.signal.aborted) setState({ status: "signed_out" }); });
    return () => controller.abort();
  }, []);

  async function choose(plan: Plan) {
    if (plan === "free" || busyPlan) return;
    setBusyPlan(plan); setNotice("");
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ plan }),
      });
      const result = (await response.json().catch(() => null)) as ApiResponse<CheckoutResult> | null;
      if (response.ok && result?.data?.url) { window.location.assign(result.data.url); return; }
      setNotice(result?.error?.message ?? "Checkout could not be started.");
    } catch { setNotice("Checkout could not be started."); }
    finally { setBusyPlan(null); }
  }

  const current = state.status === "ready" ? state.billing.plan : null;
  const checkoutAvailable = state.status === "ready" && state.billing.checkoutAvailable;

  return <div className="dashboard-shell pricing-shell" data-theme={theme}><Atmosphere />
    <main className="pricing-main">
      <nav className="pricing-nav"><Link href="/">← Workspace</Link></nav>
      <header className="pricing-intro">
        <p className="eyebrow"><span className="live-dot" />Plans</p>
        <h1>Small software, priced small.</h1>
        <p className="pricing-lede">Every plan includes the shared workspace, tasks, and AI-generated tools. Pick how many tools your team needs.</p>
        {state.status === "ready" && <p className="pricing-usage">You are on the <strong>{PLANS.find((plan) => plan.id === current)?.name}</strong> plan · {state.billing.widgetCount} of {state.billing.widgetLimit ?? "unlimited"} tools · {state.billing.generationCount} of {state.billing.generationLimit} generations this month</p>}
        {state.status === "signed_out" && <p className="pricing-usage">Sign in to your workspace to change plans.</p>}
      </header>
      {notice && <p className="feedback error pricing-notice" role="alert">{notice}</p>}
      <div className="pricing-grid">
        {PLANS.map((plan) => {
          const isCurrent = current === plan.id;
          const highlighted = plan.id === "pro";
          return <section key={plan.id} className={`pricing-card${highlighted ? " is-highlighted" : ""}${isCurrent ? " is-current" : ""}`} aria-label={`${plan.name} plan`}>
            <span className="eyebrow">{plan.name}{isCurrent && <span className="pricing-badge">Current</span>}</span>
            <p className="pricing-price"><span className="pricing-amount">${plan.priceMonthly}</span><span className="pricing-period">/month</span></p>
            <p className="pricing-tagline">{plan.tagline}</p>
            <p className="pricing-limit">{plan.generationLimit} AI generations / month · {plan.widgetLimit === null ? "unlimited" : plan.widgetLimit} tools</p>
            {plan.id === "free"
              ? <button type="button" className="pricing-button" disabled>{isCurrent ? "Your current plan" : "Included"}</button>
              : <button type="button" className={`pricing-button${highlighted ? " primary" : ""}`} disabled={isCurrent || busyPlan !== null || state.status !== "ready"} onClick={() => choose(plan.id)}>
                  {isCurrent ? "Your current plan" : busyPlan === plan.id ? "Starting checkout…" : checkoutAvailable ? `Upgrade to ${plan.name}` : `${plan.name} · coming soon`}
                </button>}
          </section>;
        })}
      </div>
      <div className="pricing-table-wrap"><table className="pricing-table"><thead><tr><th scope="col">Feature</th>{PLANS.map((plan) => <th key={plan.id} scope="col" className={current === plan.id ? "is-current" : undefined}>{plan.name}</th>)}</tr></thead>
        <tbody>{PLAN_ROWS.map((row) => <tr key={row.label}><th scope="row">{row.label}</th>{PLANS.map((plan) => { const value = row.value(plan); return <td key={plan.id}>{value === true ? <span className="pricing-yes" aria-label="Included">✓</span> : value === false ? <span className="pricing-no" aria-label="Not included">✕</span> : value}</td>; })}</tr>)}</tbody></table></div>
      <p className="pricing-footnote">Paid plans activate only after payment is confirmed by our billing provider. Prices in USD; cancel any time.</p>
    </main>
  </div>;
}
