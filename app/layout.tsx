import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

export const metadata: Metadata = { title: "AlarmFW UI" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex bg-gray-50 h-screen text-gray-800">
        <Sidebar />
        <main className="flex-1 p-8 overflow-auto min-h-0 flex flex-col">{children}</main>
      </body>
    </html>
  );
}
