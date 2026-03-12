"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";

type UserRole = "admin" | "operator" | "readonly";

const ROLE_BADGE: Record<UserRole, string> = {
  admin: "bg-blue-100 text-blue-700 border-blue-200",
  operator: "bg-amber-100 text-amber-700 border-amber-200",
  readonly: "bg-gray-100 text-gray-700 border-gray-200",
};

export default function ProfileMenu({ username, role }: { username: string; role: UserRole }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const safeName = (username || role || "user").trim();
  const avatarText = (safeName[0] || "U").toUpperCase();

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Open profile menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2 py-1.5 shadow-sm hover:bg-gray-50"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
          {avatarText}
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className={`h-4 w-4 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.168l3.71-3.938a.75.75 0 1 1 1.08 1.04l-4.25 4.51a.75.75 0 0 1-1.08 0l-4.25-4.51a.75.75 0 0 1 .02-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-56 rounded-lg border border-gray-200 bg-white p-3 shadow-lg"
        >
          <div className="mb-3 border-b border-gray-100 pb-3">
            <p className="truncate text-sm font-semibold text-gray-800">{safeName}</p>
            <span
              className={`mt-2 inline-flex rounded-md border px-2 py-0.5 text-[11px] font-medium ${ROLE_BADGE[role]}`}
            >
              {role}
            </span>
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full rounded-md border border-red-200 bg-red-50 px-3 py-2 text-left text-sm font-medium text-red-700 hover:bg-red-100"
          >
            Çıkış yap
          </button>
        </div>
      )}
    </div>
  );
}
