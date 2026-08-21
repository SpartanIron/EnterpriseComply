/**
 * PlanGate — Plan-tier access control wrapper for the frontend (P1-07).
 *
 * Usage:
 *   <PlanGate requiredPlan="federal">
 *     <POAMPage />
 *   </PlanGate>
 *
 * When the current org's plan is below the required tier, renders a locked
 * overlay with an upgrade CTA instead of the feature content.
 *
 * Plan hierarchy: starter(0) < professional(1) < enterprise(2) < federal(3)
 */

import { type ReactNode } from "react";
import { useOrg } from "@/hooks/useOrg";
import { useLocation } from "wouter";

const BASE_PATH = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export type PlanTier = "starter" | "professional" | "enterprise" | "federal";

export const PLAN_HIERARCHY: Record<PlanTier, number> = {
  starter: 0,
  professional: 1,
  enterprise: 2,
  federal: 3,
};

export const PLAN_LABELS: Record<PlanTier, string> = {
  starter: "Essentials",
  professional: "Professional",
  enterprise: "Enterprise",
  federal: "Federal",
};

export const PLAN_DESCRIPTIONS: Record<PlanTier, string> = {
  starter: "Core compliance automation for growing teams.",
  professional: "Multi-framework, auditor portal, and advanced risk management.",
  enterprise: "SSO/SAML, custom data retention, and large-scale deployment.",
  federal: "CMMC, FedRAMP, POA&M, SPRS, SSP, STIGs, and eMASS integration.",
};

const PLAN_FEATURES: Record<PlanTier, string[]> = {
  starter: [],
  professional: [
    "Unlimited commercial frameworks",
    "Auditor Portal with access tokens",
    "Access reviews and attestation campaigns",
    "Risk register with heat map",
    "Custom frameworks builder",
  ],
  enterprise: [
    "SSO / SAML integration",
    "Custom audit log retention policies",
    "Dedicated Customer Success Manager",
    "SLA guarantees (99.9% uptime)",
    "White-glove onboarding",
  ],
  federal: [
    "CMMC Level 2 (NIST SP 800-171)",
    "Native POA&M management",
    "SPRS score tracking (DoD required)",
    "SSP Generator (NIST SP 800-18)",
    "STIG checklist management",
    "SCAP / XCCDF import",
    "eMASS bridge integration",
    "FedRAMP Moderate preparation",
  ],
};

interface PlanGateProps {
  requiredPlan: PlanTier;
  children: ReactNode;
  /** Optional override for the feature name shown in the upgrade overlay */
  featureName?: string;
}

export default function PlanGate({ requiredPlan, children, featureName }: PlanGateProps) {
  const { org, isLoading } = useOrg();
  const [, navigate] = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  const currentPlan = (org?.plan ?? "starter") as PlanTier;
  const currentLevel = PLAN_HIERARCHY[currentPlan] ?? 0;
  const requiredLevel = PLAN_HIERARCHY[requiredPlan] ?? 0;

  // Access granted — render the protected content
  if (currentLevel >= requiredLevel) {
    return <>{children}</>;
  }

  // Access denied — show upgrade overlay
  const handleUpgrade = () => {
    navigate(`/pricing?required=${requiredPlan}`);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 py-16 text-center">
      <div className="max-w-lg w-full">
        {/* Lock icon */}
        <div className="mx-auto h-16 w-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-6">
          <svg className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </div>

        {/* Plan badge */}
        <div className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold px-3 py-1.5 rounded-full mb-4 uppercase tracking-widest">
          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clipRule="evenodd" />
          </svg>
          {PLAN_LABELS[requiredPlan]} Plan Required
        </div>

        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          {featureName ?? `${PLAN_LABELS[requiredPlan]}-tier feature`}
        </h2>
        <p className="text-slate-500 text-sm leading-relaxed mb-2">
          {PLAN_DESCRIPTIONS[requiredPlan]}
        </p>
        <p className="text-xs text-slate-400 mb-8">
          Your current plan: <span className="font-semibold text-slate-600 capitalize">{PLAN_LABELS[currentPlan] ?? currentPlan}</span>
        </p>

        {/* Feature list */}
        {PLAN_FEATURES[requiredPlan].length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6 text-left">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              What you unlock with {PLAN_LABELS[requiredPlan]}
            </p>
            <ul className="space-y-2">
              {PLAN_FEATURES[requiredPlan].map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-slate-700">
                  <svg className="h-4 w-4 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={handleUpgrade}
            className="px-6 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
          >
            Upgrade to {PLAN_LABELS[requiredPlan]}
          </button>
          <a
            href={BASE_PATH + "/pricing"}
            className="px-6 py-3 border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-colors"
          >
            View all plans
          </a>
        </div>
      </div>
    </div>
  );
}
