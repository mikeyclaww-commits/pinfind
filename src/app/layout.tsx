import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PinFind — Turn Pinterest Boards into Shopping Lists",
  description: "Scan your Pinterest boards, identify every product, and find where to buy them. AI-powered visual shopping from your pins.",
  openGraph: {
    title: "PinFind — Turn Pinterest Boards into Shopping Lists",
    description: "AI identifies products in your pins and finds where to buy them.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
