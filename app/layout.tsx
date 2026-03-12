import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { auth } from "@/auth";

export const metadata: Metadata = { title: "AlarmFW UI" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <html lang="en">
      <body className="flex bg-gray-50 h-screen text-gray-800">
        {session && <Sidebar username={session.user.name ?? ""} role={session.user.role} />}
        <main className="flex-1 p-8 overflow-auto min-h-0 flex flex-col">{children}</main>
      </body>
    </html>
  );
}
