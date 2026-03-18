"use client";

import { signOut } from "next-auth/react";
import { Avatar, Dropdown, Space, Tag, Typography } from "antd";
import type { MenuProps } from "antd";
import { LogoutOutlined } from "@ant-design/icons";

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
      key: "info",
      label: (
        <Space direction="vertical" size={4} style={{ padding: "4px 0" }}>
          <Text strong style={{ fontSize: 13 }}>
            {safeName}
          </Text>
          <Tag color={ROLE_COLOR[role]}>{role}</Tag>
        </Space>
      ),
      disabled: true,
    },
    { type: "divider" },
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
      <Avatar
        size={36}
        style={{ backgroundColor: "var(--alarmfw-color-primary)", cursor: "pointer", fontSize: 14, fontWeight: 600 }}
      >
        {avatarText}
      </Avatar>
    </Dropdown>
  );
}
