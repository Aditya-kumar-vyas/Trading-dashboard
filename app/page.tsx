"use client";

import TradingView from "../components/trading-view";
import { MarketDataProvider } from "../components/market-data-context";

export default function TradingViewPage() {
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-8">OHLCV.com</h1>
      <MarketDataProvider>
        <TradingView />
      </MarketDataProvider>
    </div>
  );
}
