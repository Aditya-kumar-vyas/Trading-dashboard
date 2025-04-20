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

// Interface for storing morning range data in localStorage
interface StoredMorningRangeData {
  instrument: string;
  date: string; // YYYY-MM-DD format
  rangeData: {
    high: number;
    low: number;
    open: number;
    close: number;
    timestamp: string;
  };
  breakouts: {
    highBreakout: { price: number; timestamp: string } | null;
    lowBreakout: { price: number; timestamp: string } | null;
  };
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
    open: number; // Added open price
    close: number; // Added close price at 10:00
    hasData: boolean;
    timestamp: string; // Added timestamp
  }>({
    high: 0,
    low: 0,
    open: 0,
    close: 0,
    hasData: false,
    timestamp: "",
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
  const [dataSource, setDataSource] = useState<
    "realtime" | "historical" | "localStorage"
  >("historical");

  // Get market data context for real-time updates
  const { isConnected, marketData } = useMarketData();

  // Get today's date in YYYY-MM-DD format for localStorage key
  const getTodayDateString = (): string => {
    const today = new Date();
    return format(today, "yyyy-MM-dd");
  };

  // LocalStorage keys
  const getLocalStorageKey = (): string => {
    return `morningRange_${instrument}_${getTodayDateString()}`;
  };

  // Save morning range data to localStorage
  const saveMorningRangeToLocalStorage = (
    rangeData: typeof morningRange,
    breakoutData: typeof breakouts
  ): void => {
    if (!rangeData.hasData) return;

    try {
      const dataToStore: StoredMorningRangeData = {
        instrument,
        date: getTodayDateString(),
        rangeData: {
          high: rangeData.high,
          low: rangeData.low,
          open: rangeData.open,
          close: rangeData.close,
          timestamp: rangeData.timestamp || new Date().toISOString(),
        },
        breakouts: breakoutData,
      };

      localStorage.setItem(getLocalStorageKey(), JSON.stringify(dataToStore));
      console.log("Morning range data saved to localStorage", dataToStore);
    } catch (error) {
      console.error("Error saving morning range to localStorage:", error);
    }
  };

  // Load morning range data from localStorage
  const loadMorningRangeFromLocalStorage = (): boolean => {
    try {
      const storedData = localStorage.getItem(getLocalStorageKey());
      if (!storedData) return false;

      const parsedData: StoredMorningRangeData = JSON.parse(storedData);

      // Verify data belongs to the current instrument and today
      if (
        parsedData.instrument === instrument &&
        parsedData.date === getTodayDateString()
      ) {
        // Set the morning range data from localStorage
        setMorningRange({
          high: parsedData.rangeData.high,
          low: parsedData.rangeData.low,
          open: parsedData.rangeData.open,
          close: parsedData.rangeData.close,
          hasData: true,
          timestamp: parsedData.rangeData.timestamp,
        });

        // Set breakouts if available
        setBreakouts(parsedData.breakouts);

        setDataSource("localStorage");
        console.log("Loaded morning range data from localStorage", parsedData);
        return true;
      }

      return false;
    } catch (error) {
      console.error("Error loading morning range from localStorage:", error);
      return false;
    }
  };

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

  // Every time the morning period status changes, check if we need to save data
  useEffect(() => {
    if (morningPeriodComplete && morningRange.hasData) {
      saveMorningRangeToLocalStorage(morningRange, breakouts);
    }
  }, [morningPeriodComplete, morningRange.hasData]);

  // When breakouts change, save the updated data
  useEffect(() => {
    if (morningRange.hasData) {
      saveMorningRangeToLocalStorage(morningRange, breakouts);
    }
  }, [breakouts]);

  const fetchMorningRangeData = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    // First try to load data from localStorage
    const dataLoaded = loadMorningRangeFromLocalStorage();
    if (dataLoaded) {
      setIsLoading(false);
      return;
    }

    try {
      // Get today's date
      const today = new Date();
      const formattedDate = format(today, "yyyy-MM-dd");

      // Use minute candles for more precise data
      const response = await fetch(
        `/api/historical-data?instrument=${encodeURIComponent(
          instrument
        )}&interval=minute&to_date=${formattedDate}&from_date=${formattedDate}`
      );

      if (!response.ok) {
        throw new Error(`Error fetching data: ${response.status}`);
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

          // Get open price (first candle of the morning range)
          const openPrice = morningCandles[0].open;

          // Get close price (last candle of the morning range)
          const closePrice = morningCandles[morningCandles.length - 1].close;

          // Get the timestamp of the 10:00 AM candle
          const lastCandleTimestamp =
            morningCandles[morningCandles.length - 1].timestamp;

          // Update state with all the data
          const updatedMorningRange = {
            high: morningHigh,
            low: morningLow,
            open: openPrice,
            close: closePrice,
            hasData: true,
            timestamp: lastCandleTimestamp,
          };

          setMorningRange(updatedMorningRange);
          setDataSource("historical");

          // Save to localStorage
          saveMorningRangeToLocalStorage(updatedMorningRange, breakouts);

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

    const updatedBreakouts = {
      highBreakout,
      lowBreakout,
    };

    setBreakouts(updatedBreakouts);

    // Save updated breakouts to localStorage
    saveMorningRangeToLocalStorage(morningRange, updatedBreakouts);
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
      const currentTimestamp =
        getTimestampFromWebSocket() || new Date().toISOString();

      if (currentPrice === null) return;

      // Initialize morning range if it's the first data point
      if (!morningRange.hasData) {
        const newRangeData = {
          high: currentPrice,
          low: currentPrice,
          open: currentPrice, // Set open price to first recorded price
          close: currentPrice, // Initially same as current price
          hasData: true,
          timestamp: currentTimestamp,
        };

        setMorningRange(newRangeData);
        setDataSource("realtime");

        // Save to localStorage
        saveMorningRangeToLocalStorage(newRangeData, breakouts);
        return;
      }

      // Update high, low, and close as needed
      setMorningRange((prev) => {
        const updatedData = {
          high: Math.max(prev.high, currentPrice),
          low: Math.min(prev.low, currentPrice),
          open: prev.open, // Keep the original opening price
          close: currentPrice, // Update the close price with each tick
          hasData: true,
          timestamp: currentTimestamp,
        };

        // Don't save to localStorage with every tick to avoid performance issues
        // We'll save when the morning period completes

        return updatedData;
      });
    }

    // If we just reached 10:00 AM, save the final data
    if (hours === 10 && minutes === 0) {
      const finalPrice = getCurrentPriceFromWebSocket();
      if (finalPrice !== null && morningRange.hasData) {
        const finalRangeData = {
          ...morningRange,
          close: finalPrice,
          timestamp: new Date().toISOString(),
        };

        setMorningRange(finalRangeData);
        saveMorningRangeToLocalStorage(finalRangeData, breakouts);
      }
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

      const updatedBreakouts = {
        ...breakouts,
        highBreakout: {
          price: currentPrice,
          timestamp,
        },
      };

      setBreakouts(updatedBreakouts);
      saveMorningRangeToLocalStorage(morningRange, updatedBreakouts);
    }

    // Check for low breakout if not already detected
    if (!breakouts.lowBreakout && currentPrice < morningRange.low) {
      const timestamp = getTimestampFromWebSocket() || new Date().toISOString();

      const updatedBreakouts = {
        ...breakouts,
        lowBreakout: {
          price: currentPrice,
          timestamp,
        },
      };

      setBreakouts(updatedBreakouts);
      saveMorningRangeToLocalStorage(morningRange, updatedBreakouts);
    }
  }, [marketData, isConnected, morningRange, morningPeriodComplete]);

  // Initial data fetch when component mounts or refreshed
  useEffect(() => {
    // First try to load from localStorage
    const loadedFromStorage = loadMorningRangeFromLocalStorage();

    if (loadedFromStorage) {
      setIsLoading(false);
      return;
    }

    // If not found in localStorage, fetch from API
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
        <CardTitle className="text-sm font-medium">
          {title}
          {morningRange.timestamp && (
            <span className="block text-xs text-gray-500 font-normal">
              {format(new Date(morningRange.timestamp), "yyyy-MM-dd")}
              {dataSource === "localStorage" && " (Stored)"}
            </span>
          )}
        </CardTitle>
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
              <span className="text-xs text-gray-500">Open</span>
              <div className="text-lg font-bold">
                {morningRange.open.toFixed(2)}
              </div>
            </div>
            <div>
              <span className="text-xs text-gray-500">Close (10:00)</span>
              <div className="text-lg font-bold">
                {morningRange.close.toFixed(2)}
              </div>
            </div>
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
