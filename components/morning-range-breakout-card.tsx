"use client";

import React, { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { RefreshCw, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMarketData } from "./market-data-context";
import { transformCandle } from "../lib/utils";
import { Interval, APIResponse, OHLCData } from "../app/types";

interface MorningRangeBreakoutCardProps {
  title?: string;
  instrument: string;
  interval: Interval;
  refreshTrigger: number;
  onRefresh: () => void;
}

export default function MorningRangeBreakoutCard({
  title = "Morning Range Breakout",
  instrument,
  interval,
  refreshTrigger,
  onRefresh,
}: MorningRangeBreakoutCardProps): JSX.Element {
  const [morningRange, setMorningRange] = useState<{
    high: number;
    low: number;
  } | null>(null);

  const [breakouts, setBreakouts] = useState<{
    highBreakout: { price: number; timestamp: string } | null;
    lowBreakout: { price: number; timestamp: string } | null;
  }>({
    highBreakout: null,
    lowBreakout: null,
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { isConnected, marketData } = useMarketData();

  // Fetch morning range and check for breakouts
  const fetchData = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    // Get today's date
    const today = new Date();
    const formattedDate = format(today, "yyyy-MM-dd");

    try {
      // Fetch today's candles
      const response = await fetch(
        `https://api.upstox.com/v2/historical-candle/${instrument}/${interval}/${formattedDate}/${formattedDate}`
      );

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const result: APIResponse = await response.json();

      if (
        result.status === "success" &&
        result.data.candles &&
        result.data.candles.length > 0
      ) {
        const candles = result.data.candles.map(transformCandle);

        // Sort candles by timestamp in ascending order (oldest first)
        candles.sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        // Filter morning candles (9:15 AM to 10:00 AM)
        const morningCandles = candles.filter((candle) => {
          const candleTime = new Date(candle.timestamp);
          const hours = candleTime.getHours();
          const minutes = candleTime.getMinutes();

          // Check if time is between 9:15 AM and 10:00 AM
          return (
            (hours === 9 && minutes >= 15) || (hours === 10 && minutes === 0)
          );
        });

        // Calculate morning high and low
        if (morningCandles.length > 0) {
          const morningHigh = Math.max(...morningCandles.map((c) => c.high));
          const morningLow = Math.min(...morningCandles.map((c) => c.low));

          setMorningRange({ high: morningHigh, low: morningLow });

          // Filter candles after 10:00 AM
          const postMorningCandles = candles.filter((candle) => {
            const candleTime = new Date(candle.timestamp);
            const hours = candleTime.getHours();
            const minutes = candleTime.getMinutes();

            // Check if time is after 10:00 AM
            return hours > 10 || (hours === 10 && minutes > 0);
          });

          // Check for breakouts
          let highBreakout = null;
          let lowBreakout = null;

          // Find first high breakout
          for (const candle of postMorningCandles) {
            if (candle.high > morningHigh) {
              highBreakout = {
                price: candle.high,
                timestamp: candle.timestamp,
              };
              break;
            }
          }

          // Find first low breakout
          for (const candle of postMorningCandles) {
            if (candle.low < morningLow) {
              lowBreakout = {
                price: candle.low,
                timestamp: candle.timestamp,
              };
              break;
            }
          }

          setBreakouts({
            highBreakout,
            lowBreakout,
          });
        } else {
          setError("No morning range data available (9:15 AM - 10:00 AM)");
        }
      } else {
        setError("No data available for today");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Error: ${errorMessage}`);
      console.error("Error fetching morning range data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Format timestamp for display
  const formatTimestamp = (timestamp: string): string => {
    try {
      const date = parseISO(timestamp);
      return format(date, "HH:mm:ss");
    } catch (error) {
      return timestamp;
    }
  };

  // Fetch data when component mounts or dependencies change
  useEffect(() => {
    fetchData();
  }, [instrument, interval, refreshTrigger]);

  // Handle manual refresh
  const handleRefresh = (): void => {
    fetchData();
    if (onRefresh) onRefresh();
  };

  // Check for real-time breakouts if using WebSocket
  useEffect(() => {
    if (isConnected && marketData[instrument] && morningRange) {
      const currentPrice = parseFloat(marketData[instrument].ltp);
      const currentTime = new Date();
      const hours = currentTime.getHours();
      const minutes = currentTime.getMinutes();

      // Only check after 10:00 AM
      if (hours > 10 || (hours === 10 && minutes > 0)) {
        // Check for high breakout if not already detected
        if (!breakouts.highBreakout && currentPrice > morningRange.high) {
          setBreakouts((prev) => ({
            ...prev,
            highBreakout: {
              price: currentPrice,
              timestamp: currentTime.toISOString(),
            },
          }));
        }

        // Check for low breakout if not already detected
        if (!breakouts.lowBreakout && currentPrice < morningRange.low) {
          setBreakouts((prev) => ({
            ...prev,
            lowBreakout: {
              price: currentPrice,
              timestamp: currentTime.toISOString(),
            },
          }));
        }
      }
    }
  }, [marketData[instrument]?.ltp, isConnected, morningRange]);

  if (isLoading) {
    return (
      <Card className="col-span-1">
        <CardHeader>
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !morningRange) {
    return (
      <Card className="col-span-1">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Button variant="ghost" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-gray-500">
            {error || "No morning range data available"}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-1">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="flex items-center space-x-2">
          {isConnected && (
            <Badge
              variant="outline"
              className="text-green-500 border-green-500"
            >
              Live
            </Badge>
          )}
          <Button variant="ghost" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Morning Range */}
        <div>
          <h3 className="text-xs text-gray-500 mb-2">
            Morning Range (9:15-10:00)
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-xs text-gray-500">High</span>
              <div className="text-lg font-bold">
                {morningRange.high.toFixed(2)}
              </div>
            </div>
            <div>
              <span className="text-xs text-gray-500">Low</span>
              <div className="text-lg font-bold">
                {morningRange.low.toFixed(2)}
              </div>
            </div>
          </div>
        </div>

        {/* Breakouts */}
        <div>
          <h3 className="text-xs text-gray-500 mb-2">First Breakouts</h3>
          <div className="space-y-2">
            {/* High Breakout */}
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center">
                <TrendingUp className="h-4 w-4 text-green-500 mr-2" />
                <span className="text-sm">High Breakout</span>
              </div>
              <div className="text-right">
                {breakouts.highBreakout ? (
                  <div>
                    <div className="font-medium">
                      {breakouts.highBreakout.price.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatTimestamp(breakouts.highBreakout.timestamp)}
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-gray-500">Not yet</span>
                )}
              </div>
            </div>

            {/* Low Breakout */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <TrendingDown className="h-4 w-4 text-red-500 mr-2" />
                <span className="text-sm">Low Breakout</span>
              </div>
              <div className="text-right">
                {breakouts.lowBreakout ? (
                  <div>
                    <div className="font-medium">
                      {breakouts.lowBreakout.price.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatTimestamp(breakouts.lowBreakout.timestamp)}
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-gray-500">Not yet</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
