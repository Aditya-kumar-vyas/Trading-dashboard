"use client";

import React, { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { RefreshCw, TrendingUp, TrendingDown, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMarketData } from "./market-data-context";
import { transformCandle } from "../lib/utils";
import { Interval, APIResponse, OHLCData } from "../app/types";

interface MorningRangeBreakoutCardProps {
  title?: string;
  instrument: string;
  refreshTrigger: number;
  onRefresh: () => void;
}

export default function MorningRangeBreakoutCard({
  title = "Morning Range Breakout",
  instrument,
  refreshTrigger,
  onRefresh,
}: MorningRangeBreakoutCardProps): JSX.Element {
  const [morningRange, setMorningRange] = useState<{
    high: number;
    low: number;
    hasData: boolean;
  }>({
    high: 0,
    low: 0,
    hasData: false,
  });

  const [breakouts, setBreakouts] = useState<{
    highBreakout: { price: number; timestamp: string } | null;
    lowBreakout: { price: number; timestamp: string } | null;
  }>({
    highBreakout: null,
    lowBreakout: null,
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [morningPeriodComplete, setMorningPeriodComplete] =
    useState<boolean>(false);

  // Get market data context for real-time updates
  const { isConnected, marketData } = useMarketData();

  // Initialize and check if we're in the morning range period (9:15-10:00 AM)
  useEffect(() => {
    const checkMorningPeriod = () => {
      const now = new Date();
      const hours = now.getHours();
      const minutes = now.getMinutes();

      // Check if current time is past 10:00 AM
      if (hours > 10 || (hours === 10 && minutes >= 0)) {
        setMorningPeriodComplete(true);
      } else if (hours === 9 && minutes >= 15) {
        // We're in the morning range period (9:15-10:00)
        setMorningPeriodComplete(false);
      } else {
        // Before market open at 9:15
        setMorningPeriodComplete(false);
      }
    };

    // Check immediately
    checkMorningPeriod();

    // Set up interval to check every minute
    const intervalId = setInterval(checkMorningPeriod, 60000);

    return () => clearInterval(intervalId);
  }, []);

  // Fetch historical data for the morning range if we missed it
  const fetchMorningRangeData = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    // Get today's date
    const today = new Date();
    const formattedDate = format(today, "yyyy-MM-dd");

    try {
      // Fetch today's minute candles
      const response = await fetch(
        `https://api.upstox.com/v2/historical-candle/${instrument}/1minute/${formattedDate}/${formattedDate}`
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

          setMorningRange({
            high: morningHigh,
            low: morningLow,
            hasData: true,
          });

          // If we already have data for the complete morning period,
          // check for historical breakouts
          if (morningPeriodComplete) {
            checkForBreakoutsInHistoricalData(candles, morningHigh, morningLow);
          }
        } else {
          setError("No morning range data available yet (9:15 AM - 10:00 AM)");
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

  // Check historical data for breakouts
  const checkForBreakoutsInHistoricalData = (
    candles: OHLCData[],
    morningHigh: number,
    morningLow: number
  ): void => {
    // Filter candles after 10:00 AM
    const postMorningCandles = candles.filter((candle) => {
      const candleTime = new Date(candle.timestamp);
      const hours = candleTime.getHours();
      const minutes = candleTime.getMinutes();

      // Check if time is after 10:00 AM
      return hours > 10 || (hours === 10 && minutes > 0);
    });

    // Find first high breakout
    let highBreakout = null;
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
    let lowBreakout = null;
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
  };

  // Get current price from WebSocket data
  const getCurrentPriceFromWebSocket = () => {
    if (!isConnected || !marketData[instrument]) return null;

    // Extract price from the WebSocket data structure
    try {
      const price = marketData[instrument]?.ff?.marketFF?.ltpc?.ltp;
      return typeof price === "number" ? price : null;
    } catch (err) {
      console.error("Error extracting price from WebSocket data:", err);
      return null;
    }
  };

  // Get timestamp from WebSocket data
  const getTimestampFromWebSocket = () => {
    if (!isConnected || !marketData[instrument]) return null;

    try {
      const timestamp = marketData[instrument]?.ff?.marketFF?.ltpc?.ltt;
      if (timestamp) {
        // Convert timestamp to ISO string - it's usually in milliseconds
        return new Date(parseInt(timestamp)).toISOString();
      }
      return null;
    } catch (err) {
      console.error("Error extracting timestamp from WebSocket data:", err);
      return null;
    }
  };

  // Update morning range in real-time while in the 9:15-10:00 period
  useEffect(() => {
    if (!isConnected || !marketData[instrument]) return;

    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();

    // Only update morning range if we're in the 9:15-10:00 period
    if ((hours === 9 && minutes >= 15) || (hours === 10 && minutes === 0)) {
      const currentPrice = getCurrentPriceFromWebSocket();

      if (currentPrice === null) return;

      // Initialize morning range if it's the first data point
      if (!morningRange.hasData) {
        setMorningRange({
          high: currentPrice,
          low: currentPrice,
          hasData: true,
        });
        return;
      }

      // Update high and low if current price exceeds them
      setMorningRange((prev) => ({
        high: Math.max(prev.high, currentPrice),
        low: Math.min(prev.low, currentPrice),
        hasData: true,
      }));
    }
  }, [marketData, isConnected]);

  // Check for breakouts in real-time after 10:00 AM
  useEffect(() => {
    if (
      !isConnected ||
      !marketData[instrument] ||
      !morningRange.hasData ||
      !morningPeriodComplete
    )
      return;

    const currentPrice = getCurrentPriceFromWebSocket();
    if (currentPrice === null) return;

    // Check for high breakout if not already detected
    if (!breakouts.highBreakout && currentPrice > morningRange.high) {
      const timestamp = getTimestampFromWebSocket() || new Date().toISOString();

      setBreakouts((prev) => ({
        ...prev,
        highBreakout: {
          price: currentPrice,
          timestamp,
        },
      }));
    }

    // Check for low breakout if not already detected
    if (!breakouts.lowBreakout && currentPrice < morningRange.low) {
      const timestamp = getTimestampFromWebSocket() || new Date().toISOString();

      setBreakouts((prev) => ({
        ...prev,
        lowBreakout: {
          price: currentPrice,
          timestamp,
        },
      }));
    }
  }, [marketData, isConnected, morningRange, morningPeriodComplete]);

  // Initial data fetch when component mounts or refreshed
  useEffect(() => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();

    // If we're past market open (9:15 AM), fetch the data
    if (hours > 9 || (hours === 9 && minutes >= 15)) {
      fetchMorningRangeData();
    } else {
      // Before market open, show appropriate message
      setError(
        "Market not open yet. Morning range will be available after 9:15 AM"
      );
      setIsLoading(false);
    }
  }, [instrument, refreshTrigger]);

  // Format timestamp for display
  const formatTimestamp = (timestamp: string): string => {
    try {
      const date = parseISO(timestamp);
      return format(date, "HH:mm:ss");
    } catch (error) {
      return timestamp;
    }
  };

  // Handle manual refresh
  const handleRefresh = (): void => {
    fetchMorningRangeData();
    if (onRefresh) onRefresh();
  };

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

  // If it's before 9:15 AM, show waiting message
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const beforeMarketOpen = hours < 9 || (hours === 9 && minutes < 15);

  if (beforeMarketOpen) {
    return (
      <Card className="col-span-1">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Button variant="ghost" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-center py-4">
            Waiting for market open at 9:15 AM to calculate morning range
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error && !morningRange.hasData) {
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
          {isConnected && marketData[instrument] && (
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
            {!morningPeriodComplete && (
              <span className="ml-2 text-yellow-500">
                <Activity className="h-3 w-3 inline animate-pulse" /> Updating
              </span>
            )}
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
          <h3 className="text-xs text-gray-500 mb-2">
            First Breakouts
            {morningPeriodComplete &&
              !breakouts.highBreakout &&
              !breakouts.lowBreakout && (
                <span className="ml-2 text-green-500">
                  <Activity className="h-3 w-3 inline animate-pulse" />{" "}
                  Monitoring
                </span>
              )}
          </h3>
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
                  <span className="text-xs text-gray-500">
                    {morningPeriodComplete ? "Not yet" : "Waiting for 10:00 AM"}
                  </span>
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
                  <span className="text-xs text-gray-500">
                    {morningPeriodComplete ? "Not yet" : "Waiting for 10:00 AM"}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Current Price Indicator for comparison */}
        {isConnected && marketData[instrument] && (
          <div className="border-t pt-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Current Price</span>
              <span className="font-medium">
                {getCurrentPriceFromWebSocket()?.toFixed(2) || "Loading..."}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
