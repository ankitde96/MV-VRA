import { getCurrentSession } from "@/lib/auth/current-session";
import { getCurrentMembership } from "@/lib/auth/current-membership";
import { dbConnect } from "@/lib/db/connect";
import { User } from "@/lib/db/models/user";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { CommandPalette } from "@/components/layout/command-palette";
import { UserMenu } from "@/components/layout/user-menu";
import { Separator } from "@/components/ui/separator";

/**
 * Every route under this group is already protected by proxy.ts (fail-closed by default)
 * before it ever renders — this layout doesn't re-check the session, it just provides the
 * shared shell for pages that middleware has already let through. `role` and `email` are
 * fetched once here (not per-page) so the sidebar/user-menu don't each re-derive them.
 */
export default async function InternalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentSession();
  if (!session) return null;

  await dbConnect();
  const [membership, user] = await Promise.all([
    getCurrentMembership(session),
    User.findById(session.userId).select("email").lean(),
  ]);
  const role = membership?.role ?? "viewer";

  return (
    <SidebarProvider>
      <AppSidebar role={role} />
      <SidebarInset>
        <header className="bg-background/80 sticky top-0 z-(--z-sticky-header) flex h-14 shrink-0 items-center gap-2 border-b px-4 backdrop-blur">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            {user ? <UserMenu email={user.email} role={role} /> : null}
          </div>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </SidebarInset>
      <CommandPalette />
    </SidebarProvider>
  );
}
