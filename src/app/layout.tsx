import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CivicResolve | AI-Powered Civic Issue Reporting & Management",
  description:
    "Report local infrastructure issues, classify urgency and municipal departments automatically with Google Gemini, and track resolution transparently.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased selection:bg-indigo-500/30 selection:text-indigo-100">
        {children}
      </body>
    </html>
  );
}
