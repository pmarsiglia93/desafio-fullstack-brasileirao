import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Brasileirão Front",
  description: "Frontend mínimo viável do desafio full stack",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-zinc-950 text-white antialiased">
        {children}
      </body>
    </html>
  );
}