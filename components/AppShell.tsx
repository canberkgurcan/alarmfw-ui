"use client";

import { MenuFoldOutlined } from "@ant-design/icons";
import { Breadcrumb, Button, Drawer, FloatButton, Grid, Layout, Tag } from "antd";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import ProfileMenu from "@/components/ProfileMenu";
import Sidebar from "@/components/Sidebar";

const { Content, Sider } = Layout;
const { useBreakpoint } = Grid;

type UserRole = "admin" | "operator" | "readonly";

const PAGE_META: Array<{
  title: string;
  description: string;
  match: (pathname: string) => boolean;
}> = [
  {
    title: "Operational Dashboard",
    description: "Alarm akisini, bildirim sagligini ve son olaylari tek ekranda takip edin.",
    match: (pathname) => pathname.startsWith("/dashboard"),
  },
  {
    title: "Monitor Workspace",
    description: "Pod sagligini, restart sinyallerini ve olay detaylarini hizli aksiyon almak icin izleyin.",
    match: (pathname) => pathname.startsWith("/monitor"),
  },
  {
    title: "Observe Studio",
    description: "Prometheus, events ve pod analizini ayni akista gorebileceginiz gozlem yuzeyi.",
    match: (pathname) => pathname.startsWith("/observe"),
  },
  {
    title: "Maintenance Manager",
    description: "Silence pencerelerini guvenli sekilde planlayin, dry-run ile etkisini onceden gorun.",
    match: (pathname) => pathname.startsWith("/maintenance"),
  },
  {
    title: "Manual Run",
    description: "Alarm pipeline calistirma ve sonuclarini tek tikla yonetin.",
    match: (pathname) => pathname.startsWith("/run"),
  },
  {
    title: "Configuration Hub",
    description: "Cluster, namespace ve davranis ayarlarini duzenleyin.",
    match: (pathname) => pathname.startsWith("/config"),
  },
  {
    title: "Checks Library",
    description: "Alarm kurallarini ve check tanimlarini tek yerden yonetin.",
    match: (pathname) => pathname.startsWith("/checks"),
  },
  {
    title: "Secrets Vault",
    description: "Token ve kimlik bilgilerini daha kontrollu bir deneyimle yonetin.",
    match: (pathname) => pathname.startsWith("/secrets"),
  },
  {
    title: "Admin Console",
    description: "Operasyon araclarini ve terminal tabanli akislarini daha duzenli bir arayuzde kullanin.",
    match: (pathname) => pathname.startsWith("/admin-console"),
  },
];

function prettifySegment(segment: string) {
  return segment
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function AppShell({
  children,
  username,
  role,
  loginAt,
}: {
  children: React.ReactNode;
  username: string;
  role: UserRole;
  loginAt?: number;
}) {
  const pathname = usePathname();
  const screens = useBreakpoint();
  const [navOpen, setNavOpen] = useState(false);

  const currentPage = useMemo(
    () => PAGE_META.find((item) => item.match(pathname)) ?? {
      title: "AlarmFW Workspace",
      description: "Operasyon akislarini sade, hizli ve izlenebilir bir arayuzde yonetin.",
    },
    [pathname]
  );

  const breadcrumbItems = useMemo(() => {
    const segments = pathname.split("/").filter(Boolean);
    return [
      { title: "AlarmFW" },
      ...segments.map((segment) => ({
        title: prettifySegment(segment),
      })),
    ];
  }, [pathname]);

  return (
    <Layout className="min-h-screen bg-transparent">
      {screens.lg ? (
        <Sider width={312} className="!bg-transparent px-4 py-4">
          <div className="sticky top-4">
            <Sidebar role={role} />
          </div>
        </Sider>
      ) : (
        <Drawer
          title={null}
          placement="left"
          closable={false}
          width={320}
          open={navOpen}
          onClose={() => setNavOpen(false)}
          styles={{ body: { padding: 12, background: "transparent" } }}
        >
          <Sidebar role={role} />
        </Drawer>
      )}

      <Layout className="!bg-transparent">
        <Content className="px-4 pb-8 pt-4 md:px-8">
          <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
            <div className="rounded-[28px] border border-white/60 bg-white/72 px-4 py-4 shadow-[0_24px_64px_rgba(15,23,42,0.08)] backdrop-blur-xl md:px-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  {!screens.lg && (
                    <Button
                      type="default"
                      icon={<MenuFoldOutlined />}
                      onClick={() => setNavOpen(true)}
                      aria-label="Open navigation"
                    />
                  )}
                  <div className="min-w-0">
                    <Breadcrumb items={breadcrumbItems} className="mb-2" />
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="m-0 text-[28px] font-semibold tracking-tight text-slate-900">
                        {currentPage.title}
                      </h1>
                      <Tag color="blue" className="rounded-full px-3 py-1 text-[11px] font-semibold">
                        Live workspace
                      </Tag>
                    </div>
                    <p className="mb-0 mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                      {currentPage.description}
                    </p>
                  </div>
                </div>
                <ProfileMenu username={username || role} role={role} loginAt={loginAt} />
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col">{children}</div>
          </div>
        </Content>
      </Layout>

      <FloatButton.BackTop visibilityHeight={280} />
    </Layout>
  );
}
