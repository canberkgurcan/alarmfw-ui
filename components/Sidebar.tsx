"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  BarChartOutlined,
  CaretRightOutlined,
  CheckSquareOutlined,
  ClockCircleOutlined,
  CodeOutlined,
  KeyOutlined,
  LogoutOutlined,
  MonitorOutlined,
  RadarChartOutlined,
  SettingOutlined,
  ToolOutlined,
} from "@ant-design/icons";
import { Button, Menu, Typography } from "antd";
import type { MenuProps } from "antd";

const { Text } = Typography;

type UserRole = "admin" | "operator" | "readonly";

const ALL_KEYS = [
  "/dashboard",
  "/monitor",
  "/observe",
  "/checks",
  "/config",
  "/maintenance",
  "/run",
  "/secrets",
  "/admin-console",
];

const MANAGE_KEYS = ["/checks", "/config", "/maintenance", "/run", "/secrets", "/admin-console"];

interface SidebarProps {
  username: string;
  role: UserRole;
}

export default function Sidebar({ username, role }: SidebarProps) {
  const pathname = usePathname();
  const selectedKey = ALL_KEYS.find((p) => pathname.startsWith(p)) ?? "";

  const topItems: MenuProps["items"] = [
    { key: "/dashboard", icon: <BarChartOutlined />, label: <Link href="/dashboard">Dashboard</Link> },
    { key: "/monitor", icon: <MonitorOutlined />, label: <Link href="/monitor">Monitor</Link> },
    { key: "/observe", icon: <RadarChartOutlined />, label: <Link href="/observe">Observe</Link> },
  ];

  const manageItems: MenuProps["items"] =
    role !== "readonly"
      ? [
          {
            key: "manage",
            icon: <ToolOutlined />,
            label: "Manage",
            children: [
              { key: "/checks", icon: <CheckSquareOutlined />, label: <Link href="/checks">Checks</Link> },
              { key: "/config", icon: <SettingOutlined />, label: <Link href="/config">Config</Link> },
              { key: "/maintenance", icon: <ClockCircleOutlined />, label: <Link href="/maintenance">Maintenance</Link> },
              { key: "/run", icon: <CaretRightOutlined />, label: <Link href="/run">Run</Link> },
              { key: "/secrets", icon: <KeyOutlined />, label: <Link href="/secrets">Secrets</Link> },
              { key: "/admin-console", icon: <CodeOutlined />, label: <Link href="/admin-console">Admin Console</Link> },
            ],
          },
        ]
      : [];

  const items: MenuProps["items"] = [...topItems, ...manageItems];
  const defaultOpenKeys = MANAGE_KEYS.includes(selectedKey) ? ["manage"] : [];

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 py-5">
        <Text strong style={{ fontSize: 18, color: "var(--alarmfw-color-primary)" }}>
          AlarmFW
        </Text>
        <br />
        <Text type="secondary" style={{ fontSize: 11 }}>
          monitoring ui
        </Text>
      </div>

      <div className="flex-1 overflow-y-auto">
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          defaultOpenKeys={defaultOpenKeys}
          items={items}
          style={{ border: "none", background: "transparent" }}
        />
      </div>

      <div className="px-3 pb-4">
        <Button
          type="text"
          size="small"
          icon={<LogoutOutlined />}
          onClick={() => signOut({ callbackUrl: "/login" })}
          block
          style={{ justifyContent: "flex-start", color: "#8c939d" }}
        >
          Çıkış yap
        </Button>
      </div>
    </div>
  );
}
