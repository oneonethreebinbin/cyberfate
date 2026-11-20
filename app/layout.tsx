import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Cyberfate · 数字命理观星台",
    template: "%s · Cyberfate",
  },
  description: "紫微斗数、子平八字与姻缘结构，皆在阁下浏览器中本地推演；算法出处分明，生辰资料不入云端。",
  applicationName: "Cyberfate",
  keywords: ["紫微斗数", "八字", "姻缘", "真太阳时", "传统文化", "本地排盘"],
  category: "traditional culture",
  manifest: "/manifest.webmanifest",
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0a1214",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
