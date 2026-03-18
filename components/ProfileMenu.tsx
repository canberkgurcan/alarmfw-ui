"use client";

import { signOut } from "next-auth/react";
import { Avatar, Button, Divider, Popover, Tag, Typography } from "antd";
import { ClockCircleOutlined, LogoutOutlined, UserOutlined } from "@ant-design/icons";

const { Text } = Typography;

type UserRole = "admin" | "operator" | "readonly";

const ROLE_COLOR: Record<UserRole, string> = {
  admin: "blue",
  operator: "gold",
  readonly: "default",
};

function formatLoginTime(ts?: number): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ProfileMenu({
  username,
  role,
  loginAt,
}: {
  username: string;
  role: UserRole;
  loginAt?: number;
}) {
  const safeName = (username || role || "user").trim();
  const avatarText = (safeName[0] || "U").toUpperCase();

  const content = (
    <div style={{ width: 230 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <Avatar size={44} style={{ backgroundColor: "#155eef", fontSize: 18, fontWeight: 700, flexShrink: 0 }}>
          {avatarText}
        </Avatar>
        <div>
          <Text strong style={{ fontSize: 15, display: "block" }}>
            {safeName}
          </Text>
          <Tag color={ROLE_COLOR[role]} style={{ marginTop: 4, marginInlineEnd: 0 }}>
            {role}
          </Tag>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <Text type="secondary" style={{ fontSize: 11, display: "block", marginBottom: 2 }}>
            Kullanıcı Adı
          </Text>
          <Text style={{ fontSize: 13 }}>{safeName}</Text>
        </div>
        <div>
          <Text type="secondary" style={{ fontSize: 11, display: "block", marginBottom: 2 }}>
            Rol
          </Text>
          <Tag color={ROLE_COLOR[role]}>{role}</Tag>
        </div>
        <div>
          <Text type="secondary" style={{ fontSize: 11, display: "block", marginBottom: 2 }}>
            <ClockCircleOutlined style={{ marginRight: 4 }} />
            Giriş Saati
          </Text>
          <Text style={{ fontSize: 12 }}>{formatLoginTime(loginAt)}</Text>
        </div>
      </div>

      <Divider style={{ margin: "14px 0" }} />

      <Button
        danger
        icon={<LogoutOutlined />}
        onClick={() => signOut({ callbackUrl: "/login" })}
        block
        size="small"
      >
        Çıkış yap
      </Button>
    </div>
  );

  return (
    <Popover content={content} trigger="click" placement="bottomRight" arrow={false}>
      <Avatar
        size={36}
        icon={<UserOutlined />}
        style={{ backgroundColor: "#155eef", cursor: "pointer", flexShrink: 0 }}
      />
    </Popover>
  );
}
