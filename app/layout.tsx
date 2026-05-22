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
    icon: [
      { url: "/runcomp-icon.png", sizes: "1254x1254", type: "image/png" },
      { url: "/track-mark.svg", type: "image/svg+xml" },
    ],
    shortcut: "/runcomp-icon.png",
    apple: [{ url: "/apple-touch-icon.png", sizes: "1254x1254", type: "image/png" }],
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
