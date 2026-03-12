"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut } from "next-auth/react";

const TOP_NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "◈" },
  { href: "/monitor",   label: "Monitor",   icon: "◉" },
  { href: "/observe",   label: "Observe",   icon: "🔭" },
];

const MANAGE_NAV = [
  { href: "/checks",         label: "Checks",         icon: "✓" },
  { href: "/config",         label: "Config",         icon: "⊞" },
  { href: "/maintenance",    label: "Maintenance",    icon: "🕒" },
  { href: "/run",            label: "Run",            icon: "▶" },
  { href: "/secrets",        label: "Secrets",        icon: "🔑" },
  { href: "/admin-console",  label: "Admin Console",  icon: "⌨" },
];

const ROLE_BADGE: Record<string, string> = {
  admin:    "bg-blue-600/30 text-blue-300",
  operator: "bg-yellow-600/30 text-yellow-300",
  readonly: "bg-gray-600/30 text-gray-300",
};

interface SidebarProps {
  username: string;
  role: "admin" | "operator" | "readonly";
}

export default function Sidebar({ username, role }: SidebarProps) {
  const path = usePathname();
  const manageActive = MANAGE_NAV.some((n) => path.startsWith(n.href));
  const [manageOpen, setManageOpen] = useState(manageActive);

  function NavLink({ href, label, icon, indent = false }: { href: string; label: string; icon: string; indent?: boolean }) {
    const active = path.startsWith(href);
    return (
      <Link
        href={href}
        className={`flex items-center gap-3 py-2.5 text-sm transition-colors
          ${indent ? "pl-9 pr-5" : "px-5"}
          ${active
            ? "bg-blue-600/20 text-blue-400 border-r-2 border-blue-500"
            : "text-white/60 hover:bg-sidebar-hover hover:text-white"
          }`}
      >
        <span className="text-base w-5 text-center">{icon}</span>
        {label}
      </Link>
    );
  }

  return (
    <aside className="w-56 min-h-screen bg-sidebar flex flex-col">
      <div className="px-5 py-5 border-b border-white/10">
        <p className="text-white font-bold text-lg tracking-wide">AlarmFW</p>
        <p className="text-white/40 text-xs mt-0.5">monitoring ui</p>
      </div>
      <nav className="flex-1 py-4">
        {TOP_NAV.map((n) => (
          <NavLink key={n.href} href={n.href} label={n.label} icon={n.icon} />
        ))}

        {/* Manage group — hidden for readonly */}
        {role !== "readonly" && (
          <>
            <button
              onClick={() => setManageOpen((o) => !o)}
              className={`w-full flex items-center gap-3 px-5 py-2.5 text-sm transition-colors
                ${manageActive
                  ? "text-blue-400"
                  : "text-white/60 hover:bg-sidebar-hover hover:text-white"
                }`}
            >
              <span className="text-base w-5 text-center">⚙</span>
              <span className="flex-1 text-left">Manage</span>
              <span className="text-xs opacity-60">{manageOpen ? "▲" : "▼"}</span>
            </button>

            {manageOpen && (
              <div>
                {MANAGE_NAV.map((n) => (
                  <NavLink key={n.href} href={n.href} label={n.label} icon={n.icon} indent />
                ))}
              </div>
            )}
          </>
        )}
      </nav>

      {/* Footer: user info + logout */}
      <div className="px-5 py-4 border-t border-white/10 space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-white/70 text-xs font-medium truncate">{username}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${ROLE_BADGE[role] ?? ROLE_BADGE.readonly}`}>
            {role}
          </span>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full text-left text-white/30 hover:text-white/60 text-xs transition-colors"
        >
          Çıkış yap
        </button>
      </div>
    </aside>
  );
}
