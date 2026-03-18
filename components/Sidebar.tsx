"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  BarChartOutlined,
  MonitorOutlined,
  RadarChartOutlined,
  CheckSquareOutlined,
  SettingOutlined,
  ClockCircleOutlined,
  CaretRightOutlined,
  KeyOutlined,
  CodeOutlined,
  ToolOutlined,
  LogoutOutlined,
} from "@ant-design/icons";
import { Avatar, Button, Divider, Menu, Space, Tag, Typography } from "antd";
import type { MenuProps } from "antd";

const { Text } = Typography;

type UserRole = "admin" | "operator" | "readonly";

const ROLE_COLOR: Record<UserRole, string> = {
  admin: "blue",
  operator: "gold",
  readonly: "default",
};

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

      <Divider style={{ margin: "0 0 12px 0" }} />
      <div className="px-4 pb-4">
        <Space direction="vertical" size={8} className="w-full">
          <Space>
            <Avatar
              size={28}
              style={{ backgroundColor: "var(--alarmfw-color-primary)", fontSize: 12, fontWeight: 600 }}
            >
              {(username?.[0] || "U").toUpperCase()}
            </Avatar>
            <Space direction="vertical" size={0}>
              <Text style={{ fontSize: 12 }} strong>
                {username}
              </Text>
              <Tag color={ROLE_COLOR[role]} style={{ fontSize: 10, lineHeight: "16px", marginInlineEnd: 0 }}>
                {role}
              </Tag>
            </Space>
          </Space>
          <Button
            type="text"
            danger
            size="small"
            icon={<LogoutOutlined />}
            onClick={() => signOut({ callbackUrl: "/login" })}
            block
            style={{ justifyContent: "flex-start" }}
          >
            Çıkış yap
          </Button>
        </Space>
      </div>
    </div>
  );
}
