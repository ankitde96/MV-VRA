"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  FileStack,
  ShieldAlert,
  Share2,
  BarChart3,
  Users,
  Plus,
} from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

const DESTINATIONS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/vendors", label: "Vendors", icon: Building2 },
  { href: "/vendors/new", label: "New vendor intake", icon: Plus },
  { href: "/templates", label: "Templates", icon: FileStack },
  { href: "/risks", label: "Risk Register", icon: ShieldAlert },
  { href: "/sharing", label: "Sharing", icon: Share2 },
  { href: "/rollup", label: "Executive Roll-up", icon: BarChart3 },
  { href: "/admin/users", label: "Users", icon: Users },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Jump to">
      <Command>
        <CommandInput placeholder="Jump to a page..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Go to">
            {DESTINATIONS.map((d) => (
              <CommandItem key={d.href} onSelect={() => go(d.href)}>
                <d.icon />
                <span>{d.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
