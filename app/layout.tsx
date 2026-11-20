import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cyberfate · 数字命理观星台",
  description: "以可验证的开源算法生成紫微斗数与八字命盘。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
