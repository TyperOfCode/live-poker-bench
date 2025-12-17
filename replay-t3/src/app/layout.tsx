import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";

import { TRPCReactProvider } from "~/trpc/react";
import { DesktopGate } from "~/components/layout";

export const metadata: Metadata = {
  title: "Poker Tournament Replay",
  description: "Interactive poker tournament replay viewer with AI decision analysis",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable}`}>
      <body className="bg-gray-950 text-white antialiased">
        <TRPCReactProvider>
          <DesktopGate>{children}</DesktopGate>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
