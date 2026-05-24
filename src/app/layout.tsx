import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Shell } from "@/components/shell/Shell";
import { Toaster } from "@/components/ui/Toast";
import { ConfirmHost } from "@/components/ui/ConfirmDialog";
import { CommandPalette } from "@/components/cmdk/CommandPalette";
import { GlobalModalsHost } from "@/components/shell/GlobalModalsHost";
import { Cheatsheet } from "@/components/shell/Cheatsheet";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hive",
  description:
    "Agentic OS — one place to manage every AI project you're running in parallel.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-hive-bg text-hive-text">
        <Toaster />
        <ConfirmHost />
        <CommandPalette />
        <GlobalModalsHost />
        <Cheatsheet />
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
