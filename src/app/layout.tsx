import type { Metadata } from "next";
import TransferManager from "@/components/TransferManager";
import "./globals.css";

export const metadata: Metadata = {
  title: "S3 Browser",
  description: "macOS S3 / OBS client focused on browse, copy, OBS scripts, and fast uploads.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        {children}
        <TransferManager />
      </body>
    </html>
  );
}
