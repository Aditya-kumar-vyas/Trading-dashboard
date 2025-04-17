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
      } else {
        setDebugInfo({
          error: `Failed to fetch debug info: ${response.status}`,
        });
      }
    } catch (error: any) {
      setDebugInfo({ error: `Error: ${error.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  const checkTokenValidity = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/check-token");
      if (response.ok) {
        const data = await response.json();
        setDebugInfo({
          ...debugInfo,
          tokenCheck: data,
        });
      } else {
        setDebugInfo({
          ...debugInfo,
          tokenCheck: { error: `Failed to check token: ${response.status}` },
        });
      }
    } catch (error: any) {
      setDebugInfo({
        ...debugInfo,
        tokenCheck: { error: `Error: ${error.message}` },
      });
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
    <div className="fixed bottom-4 right-4 z-50">
      {isOpen ? (
        <Card className="w-96 max-h-[80vh] overflow-auto shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between py-2">
            <CardTitle className="text-sm font-medium">
              <Activity className="h-4 w-4 inline-block mr-2" />
              Debug Information
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchDebugInfo}
                disabled={isLoading}
              >
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
          <CardContent className="text-xs">
            <div className="flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2 mb-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={fetchDebugInfo}
                  disabled={isLoading}
                >
                  Refresh Status
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={checkTokenValidity}
                  disabled={isLoading}
                >
                  Check API Token
                </Button>
              </div>
              <div className="rounded border p-2 bg-muted/50">
                <p className="font-medium mb-1">WebSocket Status:</p>
                <Badge
                  variant={isConnected ? "default" : "destructive"}
                  className="mb-1"
                >
                  {isConnected ? "Connected" : "Disconnected"}
                </Badge>
                <p className="text-muted-foreground">
                  {Object.keys(marketData).length} instruments loaded
                </p>
              </div>

              {/* Debug info display */}
              {debugInfo && (
                <div className="p-2 rounded border bg-muted/50 break-all">
                  <pre className="text-[10px] leading-tight">
                    {JSON.stringify(debugInfo, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setIsOpen(true)}>
          <Info className="h-4 w-4 mr-2" />
          Debug
        </Button>
      )}
    </div>
  );
}
