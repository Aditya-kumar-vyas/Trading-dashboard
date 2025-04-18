"use client";

import { Header } from "./header";
import { Footer } from "./footer";
import { ThemeProvider } from "next-themes";
import { MarketDataProvider } from "../market-data-context";

interface PageLayoutProps {
  children: React.ReactNode;
}

export function PageLayout({ children }: PageLayoutProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <MarketDataProvider>
        <div className="flex min-h-screen flex-col bg-background text-foreground">
          <Header />
          <main className="flex-1 container mx-auto py-6 px-4 max-w-7xl">
            {children}
          </main>
          <Footer />
        </div>
      </MarketDataProvider>
    </ThemeProvider>
  );
}
