import type { Metadata } from "next";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "./globals.css";
import { ClaimProvider } from "@/lib/ClaimContext";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";

export const metadata: Metadata = {
  title: "SME Grant Copilot | Grant Hub",
  description: "Automated, event-driven grant claims for Malaysian SMEs: MDEC, SME Corp and MATRADE.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-dvh">
        <ClaimProvider>
          <div className="grid min-h-dvh grid-cols-1 grid-rows-[48px_1fr] md:grid-cols-[var(--sidebar-width)_minmax(0,1fr)]">
            <Sidebar />
            <Header />
            <main className="col-start-1 min-w-0 bg-surface md:self-start md:col-start-2 md:mb-2 md:mr-2 md:rounded-[var(--radius-sheet)] md:border md:border-line">
              {children}
            </main>
          </div>
        </ClaimProvider>
      </body>
    </html>
  );
}
