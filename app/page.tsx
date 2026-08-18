import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/current-session";

/**
 * Was a static "Phase 0 scaffold" stub (UI-REVAMP-PLAN.md Phase 2) — every real visit to
 * `/` should land the caller on something useful, not a placeholder. proxy.ts already
 * decides whether `/dashboard` is reachable; this just picks the right destination.
 */
export default async function Home() {
  const session = await getCurrentSession();
  redirect(session ? "/dashboard" : "/login");
}
