import { redirect } from "next/navigation";
import { auth } from "@/auth";
import AppShell from "@/components/AppShell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const user = session?.user;

  if (!user) redirect("/login");

  const role =
    user.role === "admin" || user.role === "operator" || user.role === "readonly"
      ? user.role
      : "readonly";

  return (
    <AppShell username={user.name ?? ""} role={role} loginAt={user.loginAt}>
      {children}
    </AppShell>
  );
}
