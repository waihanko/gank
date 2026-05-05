import type { Metadata, Viewport } from "next";
import "./globals.css";
import ClientProviders from "@/components/ClientProviders";

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "Good Game — Automated MLBB Escrow & Matchmaking",
  description:
    "The ultimate automated escrow platform for Mobile Legends: Bang Bang. Post custom stakes, get matched, and let our AI referee judge your battle. Zero friction. Maximum trust.",
  keywords: ["MLBB", "Mobile Legends", "escrow", "matchmaking", "esports", "betting", "good game"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Orbitron:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased" style={{ overscrollBehavior: 'none' }}>
        {/* Background orbs — desktop only, hidden when mobile layout overrides with its own fixed bg */}
        <div
          className="bg-glow-orb desktop-only-bg"
          style={{
            width: 500,
            height: 500,
            top: '-10%',
            right: '-5%',
            background: 'radial-gradient(circle, rgba(124,58,237,0.15), transparent 70%)',
          }}
        />
        <div
          className="bg-glow-orb desktop-only-bg"
          style={{
            width: 400,
            height: 400,
            bottom: '10%',
            left: '-5%',
            background: 'radial-gradient(circle, rgba(6,182,212,0.1), transparent 70%)',
          }}
        />
        <div className="bg-grid" style={{ position: 'relative', zIndex: 1, minHeight: '100vh' }}>
          <ClientProviders>{children}</ClientProviders>
        </div>
      </body>
    </html>
  );
}

