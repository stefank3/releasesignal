import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import AuthenticatedInactivityLogout from "./components/AuthenticatedInactivityLogout";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Release Signal",
  description:
    "QA intelligence workspace for structured test design, review, execution evidence, and release readiness.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthenticatedInactivityLogout />
        {children}
      </body>
    </html>
  );
}
