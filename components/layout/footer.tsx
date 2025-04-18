"use client";

import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border/40 bg-background">
      <div className="container mx-auto max-w-7xl px-4 py-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} OHLCV.com. All rights reserved.
            </p>
          </div>
          <div className="flex items-center gap-6">
            <Link
              href="/about"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              About
            </Link>
            <Link
              href="/privacy"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Terms
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
