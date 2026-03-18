"use client";

import { App as AntdApp, ConfigProvider, type ThemeConfig } from "antd";
import trTR from "antd/locale/tr_TR";

const themeConfig: ThemeConfig = {
  cssVar: {
    key: "alarmfw",
  },
  token: {
    colorPrimary: "#155eef",
    colorSuccess: "#16a34a",
    colorWarning: "#d97706",
    colorError: "#dc2626",
    colorInfo: "#0ea5e9",
    colorTextBase: "#10203a",
    colorBgBase: "#f4f7fb",
    colorBgLayout: "#edf3fb",
    colorBorderSecondary: "#d9e2ef",
    borderRadius: 18,
    borderRadiusLG: 24,
    fontFamily: "\"Segoe UI Variable\", \"Segoe UI\", \"Helvetica Neue\", Arial, sans-serif",
    boxShadowSecondary: "0 22px 54px rgba(15, 23, 42, 0.12)",
  },
  components: {
    Layout: {
      bodyBg: "transparent",
      headerBg: "transparent",
      siderBg: "transparent",
    },
    Card: {
      headerBg: "transparent",
      borderRadiusLG: 24,
    },
    Button: {
      borderRadius: 14,
      controlHeight: 40,
    },
    Input: {
      controlHeight: 42,
    },
    Table: {
      headerBg: "#f6f8fc",
      borderColor: "#e3eaf4",
    },
    Tabs: {
      itemSelectedColor: "#155eef",
      itemColor: "#667085",
      inkBarColor: "#155eef",
    },
  },
};

export default function AntdProvider({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider locale={trTR} theme={themeConfig} componentSize="middle">
      <AntdApp>{children}</AntdApp>
    </ConfigProvider>
  );
}
