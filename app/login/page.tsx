"use client";
import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const username = (form.get("username") as string).trim();
    const password = form.get("password") as string;

    startTransition(async () => {
      const res = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });
      if (res?.error) {
        setError("Kullanıcı adı veya şifre hatalı.");
      } else {
        router.replace("/dashboard");
      }
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <p className="text-white font-bold text-2xl tracking-wide">AlarmFW</p>
          <p className="text-white/40 text-sm mt-1">monitoring ui</p>
        </div>

        {/* Card */}
        <div className="bg-[#1a1f2e] rounded-xl border border-white/10 p-8 shadow-2xl">
          <h1 className="text-white font-semibold text-lg mb-6">Giriş</h1>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-white/60 text-sm mb-1.5" htmlFor="username">
                Kullanıcı adı
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                autoFocus
                required
                className="w-full bg-gray-900 border border-white/10 rounded-lg px-3.5 py-2.5
                           text-white text-sm placeholder-white/25
                           focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="admin"
              />
            </div>

            <div>
              <label className="block text-white/60 text-sm mb-1.5" htmlFor="password">
                Şifre
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="w-full bg-gray-900 border border-white/10 rounded-lg px-3.5 py-2.5
                           text-white text-sm
                           focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50
                         text-white text-sm font-medium rounded-lg py-2.5
                         transition-colors mt-2"
            >
              {isPending ? "Giriş yapılıyor…" : "Giriş yap"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
