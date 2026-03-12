import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import ProfileMenu from "@/components/ProfileMenu";
import { auth } from "@/auth";

export const metadata: Metadata = { title: "AlarmFW UI" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const user = session?.user;
  const role = user
    ? (user.role === "admin" || user.role === "operator" || user.role === "readonly" ? user.role : "readonly")
    : null;

  return (
    <html lang="en">
      <body className="flex bg-gray-50 h-screen text-gray-800">
        {user && role && <Sidebar username={user.name ?? ""} role={role} />}
        <main className="flex-1 px-6 py-4 md:px-8 md:py-6 overflow-auto min-h-0 flex flex-col">
          {user && role && (
            <div className="mb-4 flex items-center justify-end">
              <ProfileMenu username={user.name ?? role} role={role} />
            </div>
          )}
          {children}
        </main>
      </body>
    </html>
  );
}
