import type { Metadata } from "next";
import localFont from "next/font/local";
import { Amatic_SC } from "next/font/google";
import { Nav } from "@/components/Nav";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});
const amatic = Amatic_SC({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-amatic",
});

export const metadata: Metadata = {
  title: "Wildrock CRM",
  description: "Internal CRM for playscape events, school programs, and donor engagement",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${amatic.variable} font-sans min-h-screen antialiased`}
      >
        <Nav />
        <main className="container mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
