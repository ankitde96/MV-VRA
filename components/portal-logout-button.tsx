"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function PortalLogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/portal/auth/logout", { method: "POST" });
    router.push("/portal/login");
    router.refresh();
  }

  return (
    <Button variant="outline" size="sm" onClick={handleLogout}>
      Sign out
    </Button>
  );
}
