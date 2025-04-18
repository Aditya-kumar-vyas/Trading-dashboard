"use client";

import Link from "next/link";
import { Activity, Info, Moon, Sun, Github } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMarketData } from "../market-data-context";

export function Header() {
  const { isConnected } = useMarketData();
  const { theme, setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <span className="text-xl font-semibold tracking-tight">
              OHLCV.com
            </span>
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <Badge
            variant={isConnected ? "success" : "destructive"}
            className="hidden px-2 sm:flex"
          >
            {isConnected ? "Connected" : "Disconnected"}
          </Badge>

          <Link href="/about">
            <Button variant="ghost" size="sm" className="gap-2">
              <Info className="h-4 w-4" />
              <span className="hidden sm:inline">About</span>
            </Button>
          </Link>

          <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle theme"
            className="h-9 w-9"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>

          <Link
            href="https://github.com/yourusername/ohlcv"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Github className="h-4 w-4" />
              <span className="sr-only">GitHub</span>
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
