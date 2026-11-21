import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CivicResolve",
  description: "Civic issue reporting, incident clustering, and resolution tracking.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
