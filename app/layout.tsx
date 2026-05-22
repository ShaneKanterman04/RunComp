import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RunComp",
  description: "Private running competitions for families and friends.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "RunComp",
  },
  icons: {
    icon: "/track-mark.svg",
    shortcut: "/track-mark.svg",
    apple: "/track-mark.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#f7f4ec",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
