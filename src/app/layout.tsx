import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AC Reply Desk",
  description: "Ample Couture customer service reply desk",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
