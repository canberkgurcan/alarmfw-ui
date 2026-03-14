import { redirect } from "next/navigation";
import { auth } from "@/auth";
import Sidebar from "@/components/Sidebar";
import ProfileMenu from "@/components/ProfileMenu";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const user = session?.user;

  if (!user) redirect("/login");

  const role =
    user.role === "admin" || user.role === "operator" || user.role === "readonly"
      ? user.role
      : "readonly";

  return (
    <div className="flex bg-gray-50 h-screen text-gray-800">
      <Sidebar username={user.name ?? ""} role={role} />
      <main className="flex-1 px-6 py-4 md:px-8 md:py-6 overflow-auto min-h-0 flex flex-col">
        <div className="mb-4 flex items-center justify-end">
          <ProfileMenu username={user.name ?? role} role={role} />
        </div>
        {children}
      </main>
    </div>
  );
}
