"use client";

import { signOut } from "next-auth/react";
import { Avatar, Dropdown, Space, Tag, Typography } from "antd";
import type { MenuProps } from "antd";
import { DownOutlined, LogoutOutlined } from "@ant-design/icons";

const { Text } = Typography;

type UserRole = "admin" | "operator" | "readonly";

const ROLE_COLOR: Record<UserRole, string> = {
  admin: "blue",
  operator: "gold",
  readonly: "default",
};

export default function ProfileMenu({ username, role }: { username: string; role: UserRole }) {
  const safeName = (username || role || "user").trim();
  const avatarText = (safeName[0] || "U").toUpperCase();

  const items: MenuProps["items"] = [
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "Çıkış yap",
      danger: true,
      onClick: () => signOut({ callbackUrl: "/login" }),
    },
  ];

  return (
    <Dropdown menu={{ items }} trigger={["click"]} placement="bottomRight">
      <Space
        style={{ cursor: "pointer", padding: "6px 10px", borderRadius: 10, background: "rgba(255,255,255,0.7)", border: "1px solid #e3eaf4" }}
      >
        <Avatar size={28} style={{ backgroundColor: "#155eef", fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
          {avatarText}
        </Avatar>
        <Space direction="vertical" size={0} style={{ lineHeight: 1 }}>
          <Text strong style={{ fontSize: 12, display: "block" }}>
            {safeName}
          </Text>
          <Tag color={ROLE_COLOR[role]} style={{ fontSize: 10, lineHeight: "16px", marginInlineEnd: 0 }}>
            {role}
          </Tag>
        </Space>
        <DownOutlined style={{ fontSize: 11, color: "#667085" }} />
      </Space>
    </Dropdown>
  );
}
