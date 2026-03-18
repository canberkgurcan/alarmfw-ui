import type { Metadata } from "next";
import "./globals.css";
import AntdProvider from "@/components/AntdProvider";

export const metadata: Metadata = { title: "AlarmFW UI" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AntdProvider>{children}</AntdProvider>
      </body>
    </html>
  );
}
