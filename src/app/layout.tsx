import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "King Legacy Global Event Tracker | Real-Time Server Scanner",
  description:
    "Real-Time King Legacy Global Event Tracker & Public Server Scanner across First Sea, Second Sea, and Third Sea.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#07090f] text-slate-100 antialiased selection:bg-blue-600/40 selection:text-white">
        {children}
      </body>
    </html>
  );
}
