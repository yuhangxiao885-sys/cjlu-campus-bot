import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "中国计量大学校园问答机器人",
  description:
    "中国计量大学专属校园问答助手，支持加载本地校园知识库，回答校区、学习、生活与办事相关问题。",
  applicationName: "量大校园助手",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#06152e",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
