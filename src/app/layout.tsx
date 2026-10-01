import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ordi",
  description: "Acesso à área do seller Ordi.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
