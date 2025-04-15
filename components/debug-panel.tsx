"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Activity, Info, X } from "lucide-react";
import { useMarketData } from "./market-data-context";

export default function DebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { isConnected, marketData } = useMarketData();

  const fetchDebugInfo = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/debug-status");
      if (response.ok) {
        const data = await response.json();
        setDebugInfo(data.info);
      }
    } catch (error) {
      console.error("Error fetching debug info:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Check MarketData state
  const getMarketDataStatus = () => {
    const instruments = Object.keys(marketData);
    const hasData = instruments.length > 0;
    const hasOHLC = instruments.some((key) => marketData[key]?.dailyOHLC);
    const latestUpdate =
      instruments.length > 0
        ? Math.max(
            ...instruments.map((key) =>
              marketData[key]?.lastUpdated
                ? new Date(marketData[key].lastUpdated).getTime()
                : 0
            )
          )
        : 0;

    return {
      isConnected,
      instrumentCount: instruments.length,
      instruments: instruments.slice(0, 5), // Show first 5 only
      hasData,
      hasOHLC,
      latestUpdate: latestUpdate
        ? new Date(latestUpdate).toLocaleString()
        : "none",
    };
  };

  return (
    <>
      {!isOpen && (
        <Button
          variant="outline"
          size="sm"
          className="fixed bottom-4 right-4 bg-white shadow-md"
          onClick={() => {
            setIsOpen(true);
            fetchDebugInfo();
          }}
        >
          <Info className="h-4 w-4 mr-1" />
          Debug
        </Button>
      )}

      {isOpen && (
        <Card className="fixed bottom-4 right-4 w-96 shadow-lg z-50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Real-Time Debug Info
            </CardTitle>
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="sm" onClick={fetchDebugInfo}>
                <RefreshCw
                  className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
                />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            {/* WebSocket Status */}
            <div className="space-y-1">
              <h3 className="font-semibold">WebSocket Status</h3>
              <div className="flex items-center">
                Status:
                <Badge
                  variant="outline"
                  className={`ml-2 ${
                    isConnected
                      ? "text-green-500 border-green-500"
                      : "text-red-500 border-red-500"
                  }`}
                >
                  {isConnected ? "Connected" : "Disconnected"}
                </Badge>
                {isConnected && (
                  <Activity className="h-3 w-3 text-green-500 animate-pulse ml-1" />
                )}
              </div>
            </div>

            {/* Market Data Status */}
            <div className="space-y-1">
              <h3 className="font-semibold">Market Data</h3>
              {(() => {
                const status = getMarketDataStatus();
                return (
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                    <div>Instruments:</div>
                    <div>{status.instrumentCount}</div>

                    <div>Has OHLC:</div>
                    <div>
                      <Badge
                        variant="outline"
                        className={
                          status.hasOHLC
                            ? "text-green-500 border-green-500"
                            : "text-amber-500 border-amber-500"
                        }
                      >
                        {status.hasOHLC ? "Yes" : "No"}
                      </Badge>
                    </div>

                    <div>Latest Update:</div>
                    <div>{status.latestUpdate}</div>

                    {status.instruments.length > 0 && (
                      <>
                        <div className="col-span-2 mt-1">Instrument List:</div>
                        <div className="col-span-2 pl-2">
                          {status.instruments.map((instr, idx) => (
                            <div key={idx}>{instr}</div>
                          ))}
                          {status.instrumentCount > 5 && (
                            <div>...and {status.instrumentCount - 5} more</div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* API Debug Info */}
            {debugInfo && (
              <div className="space-y-1">
                <h3 className="font-semibold">API Diagnostics</h3>
                <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                  <div>API Token:</div>
                  <div>
                    <Badge
                      variant="outline"
                      className={
                        debugInfo.apiTokenPresent
                          ? "text-green-500 border-green-500"
                          : "text-red-500 border-red-500"
                      }
                    >
                      {debugInfo.apiTokenPresent ? "Present" : "Missing"}
                    </Badge>
                  </div>

                  <div>WS Auth:</div>
                  <div>
                    <Badge
                      variant="outline"
                      className={
                        debugInfo.wsAuthSuccess
                          ? "text-green-500 border-green-500"
                          : "text-red-500 border-red-500"
                      }
                    >
                      {debugInfo.wsAuthSuccess
                        ? "Success"
                        : `Failed (${debugInfo.wsAuthStatus})`}
                    </Badge>
                  </div>

                  <div>Today's Data:</div>
                  <div>
                    <Badge
                      variant="outline"
                      className={
                        debugInfo.hasTodayData
                          ? "text-green-500 border-green-500"
                          : "text-amber-500 border-amber-500"
                      }
                    >
                      {debugInfo.hasTodayData
                        ? `Yes (${debugInfo.candleCount} candles)`
                        : "No"}
                    </Badge>
                  </div>

                  <div>Time:</div>
                  <div>{new Date(debugInfo.timestamp).toLocaleString()}</div>
                </div>
              </div>
            )}

            <div className="text-xs text-gray-500">
              If you see "No data available" for today, check if today is a
              trading day. For WebSocket issues, try refreshing the page.
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
