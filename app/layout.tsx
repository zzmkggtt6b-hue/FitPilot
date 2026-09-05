import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FitPilot",
  description: "AI fitness coach MVP1",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
