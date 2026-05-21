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
    "Private-beta AI-assisted QA intelligence for requirement refinement, structured test-suite review, QA artifact export, and deterministic release readiness evaluation.",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
  openGraph: {
    title: "Release Signal",
    description:
      "Private-beta AI-assisted QA intelligence for requirement refinement, structured test-suite review, QA artifact export, and deterministic release readiness evaluation.",
    type: "website",
    siteName: "Release Signal",
  },
  twitter: {
    card: "summary",
    title: "Release Signal",
    description:
      "Private-beta AI-assisted QA intelligence for requirement refinement, structured test-suite review, QA artifact export, and deterministic release readiness evaluation.",
  },
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
