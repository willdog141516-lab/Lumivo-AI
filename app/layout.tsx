import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";

import ThemeProvider from "@/components/theme-provider";

import "./globals.css";
import "streamdown/styles.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lumivo AI · 让问题成为地图",
  description: "用自然语言探索中国旅行，把答案变成一张可以走进去的地图。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <link rel="stylesheet" href="https://at.alicdn.com/t/c/font_5234803_avfswqha8t.css" />
      </head>
      <body className="min-h-full flex flex-col">
        <Script
          src="https://at.alicdn.com/t/c/font_5234803_avfswqha8t.js"
          strategy="beforeInteractive"
        />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
