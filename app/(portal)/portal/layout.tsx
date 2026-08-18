import { ShieldCheck } from "lucide-react";

/**
 * Every route under this group is already protected by proxy.ts's portal branch (fail
 * closed by default, except /portal/login) before it ever renders — this layout doesn't
 * re-check the session, matching app/(internal)/layout.tsx's equivalent comment. The
 * sign-out control lives on each page individually (login has none), not here, since this
 * layout also wraps the unauthenticated login page.
 *
 * DESIGN-SYSTEM.md §1: the portal is a deliberately different density language from the
 * internal console — low density, generous spacing, plain language, 16px minimum body
 * text (`text-base` here, not `text-sm`). Not the bold gradient treatment DECISIONS.md 025
 * sanctions for the internal console — a vendor SPOC filling out a long questionnaire is
 * the audience §1 calls out by name, not a buyer being sold on a dashboard.
 *
 * Fixes a real bug from the pre-revamp header: `border-border` was set without `border-b`,
 * so the header had no visible bottom border at all.
 *
 * UI Revamp Round 2 Phase F (`docs/UI-REVAMP-2-PLAN.md`, `DECISIONS.md` 028) — the header
 * gets a restrained `.glass-panel-sm` touch (sticky, subtle blur) so the portal reads as
 * part of the same modern-SaaS system as the internal console, without adopting its
 * density, motion, or KPI surfaces — §1/§7 are unchanged: this remains the low-density,
 * plain-language, no-charts surface built for someone who did not ask to be there.
 */
export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-background min-h-screen text-base">
      <header className="glass-panel-sm sticky top-0 z-(--z-nav) flex h-16 items-center gap-2 px-6">
        <ShieldCheck className="text-primary size-5" aria-hidden="true" />
        <span className="text-foreground text-base font-semibold">
          MV-VRA Vendor Portal
        </span>
      </header>
      <main className="mx-auto max-w-2xl px-6 py-8">{children}</main>
    </div>
  );
}
