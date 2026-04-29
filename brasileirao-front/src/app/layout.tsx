import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Brasileirão 2026",
  description: "Acompanhe o Campeonato Brasileiro 2026",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="flex min-h-screen flex-col bg-zinc-950 text-white antialiased">
        <div className="flex-1">{children}</div>
        <footer className="border-t border-zinc-800 bg-zinc-900 py-5 text-center text-sm text-zinc-500">
          Desenvolvido por{" "}
          <a
            href="https://portifilio-paulo-francisco-marsiglia.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-zinc-300 underline underline-offset-4 transition hover:text-white"
          >
            Paulo Francisco Marsiglia
          </a>
        </footer>
      </body>
    </html>
  );
}
