"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";
import type { AppRole } from "@/lib/roles";
import { isSportsManager } from "@/lib/roles";

interface NavItem {
  label: string;
  href: string;
}

function buildNavItems(role: AppRole): NavItem[] {
  const items: NavItem[] = [
    { label: "Inicio",             href: "/"         },
    { label: "Aprobaciones",       href: "/approvals" },
    { label: "Reservaciones",      href: "/bookings"  },
    { label: "Miembros",           href: "/members"   },
    { label: "Calendario escolar", href: "/holidays"  },
    { label: "Buzón de ideas",     href: "/ideas"     },
    { label: "Faltas y sanciones", href: "/strikes"   },
  ];

  if (isSportsManager(role)) {
    items.push({ label: "Tabla de precios", href: "/prices" });
  }

  return items;
}

interface SidebarProps {
  role: string;
  userName: string;
}

export function Sidebar({ role, userName }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const navItems = buildNavItems(role as AppRole);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex w-56 flex-shrink-0 flex-col border-r border-border bg-card">
      {/* Logo */}
      <div className="flex h-14 items-center border-b border-border px-4">
        <span className="text-sm font-semibold text-foreground">
          Terraza Sports
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center rounded-md px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User footer */}
      <div className="border-t border-border px-4 py-3">
        <p className="truncate text-xs font-medium text-foreground">
          {userName}
        </p>
        <p className="mt-0.5 truncate text-xs capitalize text-muted-foreground">
          {role.replace("_", " ")}
        </p>
        <button
          onClick={handleSignOut}
          className="mt-2 text-xs text-muted-foreground hover:text-foreground"
        >
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
