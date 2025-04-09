"use client";

import React, { useState, useEffect } from "react";
import {
  format,
  subDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subMonths,
} from "date-fns";
import { RefreshCw, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { Interval, Timeframe, APIResponse, OHLCData } from "../app/types";
import { useMarketData } from "./market-data-context";
import { transformCandle } from "../lib/utils";

interface TimeframeCardProps {
  title: string;
  timeframe: Timeframe;
  instrument: string;
  interval: Interval;
  refreshTrigger: number;
  onRefresh: () => void;
  previousTimeframeData?: {
    closing: number;
  } | null;
  onDataLoaded?: (data: any) => void;
}

interface StatsData {
  opening: number;
  closing: number;
  highest: number;
  lowest: number;
  previousClose?: number;
}

export default function TimeframeCard({
  title,
  timeframe,
  instrument,
  interval,
  refreshTrigger,
  onRefresh,
  previousTimeframeData = null,
  onDataLoaded,
}: TimeframeCardProps): JSX.Element {
  const [data, setData] = useState<StatsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [realTimePrice, setRealTimePrice] = useState<number | null>(null);
  const { isConnected, marketData } = useMarketData();

  // Get current real-time price from WebSocket data
  const getCurrentRealTimePrice = () => {
    if (!isConnected || !marketData[instrument]) return null;

    try {
      // Extract last traded price from the WebSocket data
      const ltp = marketData[instrument]?.ff?.marketFF?.ltpc?.ltp;
      return typeof ltp === "number" ? ltp : null;
    } catch (err) {
      console.error("Error extracting real-time price:", err);
      return null;
    }
  };

  // Check if we should use real-time data for this timeframe
  const useRealTimeData = (): boolean => {
    // Only attempt to use real-time data for current day timeframe
    if (timeframe !== "currentDay") return false;

    // Make sure we're connected AND have data for this instrument
    return (
      isConnected &&
      marketData[instrument] &&
      marketData[instrument].dailyOHLC !== undefined
    );
  };

  const getDateRangeForTimeframe = (): { fromDate: Date; toDate: Date } => {
    const today = new Date();
    let fromDate: Date;
    let toDate: Date = today;

    switch (timeframe) {
      case "currentDay":
        // For current day, set fromDate to start of today
        fromDate = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate()
        );
        break;
      case "previousDay":
        // For previous day, set both from and to date to yesterday
        fromDate = subDays(today, 1);
        toDate = subDays(today, 1);
        break;
      case "threeDays":
        // Last 3 days including today
        fromDate = subDays(today, 2);
        break;
      case "currentWeek":
        // From Monday of current week to today
        fromDate = startOfWeek(today, { weekStartsOn: 1 }); // Monday
        break;
      case "previousWeek":
        // Previous full week (Monday to Friday)
        const lastWeekStart = startOfWeek(subDays(today, 7), {
          weekStartsOn: 1,
        });
        fromDate = lastWeekStart;
        toDate = endOfWeek(lastWeekStart, { weekStartsOn: 1 });
        break;
      case "currentMonth":
        // From 1st of current month to today
        fromDate = startOfMonth(today);
        break;
      case "previousMonth":
        // Full previous month
        const lastMonth = subMonths(today, 1);
        fromDate = startOfMonth(lastMonth);
        toDate = endOfMonth(lastMonth);
        break;
      case "currentQuarter":
        // Current quarter (Q1: Jan-Mar, Q2: Apr-Jun, Q3: Jul-Sep, Q4: Oct-Dec)
        const currentMonth = today.getMonth();
        const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
        fromDate = new Date(today.getFullYear(), quarterStartMonth, 1);
        break;
      case "previousQuarter":
        // Previous quarter
        const currentQuarter = Math.floor(today.getMonth() / 3);
        let prevQuarter, prevQuarterYear;

        if (currentQuarter === 0) {
          prevQuarter = 3; // Q4
          prevQuarterYear = today.getFullYear() - 1;
        } else {
          prevQuarter = currentQuarter - 1;
          prevQuarterYear = today.getFullYear();
        }

        const prevQuarterStartMonth = prevQuarter * 3;
        fromDate = new Date(prevQuarterYear, prevQuarterStartMonth, 1);
        toDate = new Date(prevQuarterYear, prevQuarterStartMonth + 3, 0);
        break;
      case "currentYear":
        // From January 1st of current year to today
        fromDate = new Date(today.getFullYear(), 0, 1);
        break;
      case "previousYear":
        // Full previous year (Jan 1 to Dec 31)
        fromDate = new Date(today.getFullYear() - 1, 0, 1);
        toDate = new Date(today.getFullYear() - 1, 11, 31);
        break;
      default:
        fromDate = subDays(today, 7); // Default to 7 days
    }

    return { fromDate, toDate };
  };

  // Fetch previous day's closing price
  const fetchPreviousDayClose = async (): Promise<number | null> => {
    // If we have previousTimeframeData, use that
    if (previousTimeframeData && previousTimeframeData.closing) {
      return previousTimeframeData.closing;
    }

    // For previousDay timeframe, we need to fetch data from 2 days ago
    if (timeframe === "previousDay") {
      const twoDaysAgo = subDays(new Date(), 1);
      const formattedDate = format(twoDaysAgo, "yyyy-MM-dd");

      try {
        const response = await fetch(
          `https://api.upstox.com/v2/historical-candle/${instrument}/day/${formattedDate}/${formattedDate}`
        );

        if (!response.ok) return null;

        const result: APIResponse = await response.json();

        if (
          result.status === "success" &&
          result.data.candles &&
          result.data.candles.length > 0
        ) {
          const candles = result.data.candles.map(transformCandle);
          console.log("Previous day's candles:", candles);
          return candles[0].close;
        }
      } catch (err) {
        console.error("Error fetching previous day's close:", err);
      }
    }

    return null;
  };

  const fetchData = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    // Get previous day's close for correct change calculation
    const previousClose = await fetchPreviousDayClose();

    // Check if we should use real-time data
    if (useRealTimeData()) {
      const realTimeData = marketData[instrument];
      const dailyOHLC = realTimeData.dailyOHLC;

      const newData = {
        opening: parseFloat(dailyOHLC.open),
        closing: parseFloat(dailyOHLC.close),
        highest: parseFloat(dailyOHLC.high),
        lowest: parseFloat(dailyOHLC.low),
        previousClose: previousClose || undefined,
      };

      setData(newData);
      setIsLoading(false);

      // Notify parent component about loaded data
      if (onDataLoaded) onDataLoaded(newData);
      return;
    }

    const { fromDate, toDate } = getDateRangeForTimeframe();

    // The API expects dates in format: to_date/from_date
    const formattedFromDate = format(fromDate, "yyyy-MM-dd");
    const formattedToDate = format(toDate, "yyyy-MM-dd");

    try {
      const response = await fetch(
        `https://api.upstox.com/v2/historical-candle/${instrument}/${interval}/${formattedToDate}/${formattedFromDate}`
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

        // Sort candles by timestamp in descending order (newest first)
        candles.sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        // Calculate OHLC properly for the entire timeframe
        const newData = {
          // Opening price is the first candle's open (earliest date)
          opening: candles[candles.length - 1].open,
          // Closing price is the last candle's close (latest date)
          closing: candles[0].close,
          // Highest is max of all high prices in timeframe
          highest: Math.max(...candles.map((d) => d.high)),
          // Lowest is min of all low prices in timeframe
          lowest: Math.min(...candles.map((d) => d.low)),
          previousClose: previousClose || undefined,
        };

        setData(newData);

        // Notify parent component about loaded data
        if (onDataLoaded) onDataLoaded(newData);
      } else {
        setError("No data available for this timeframe");
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Error: ${errorMessage}`);
      console.error(`Error fetching ${timeframe} data:`, err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch data when component mounts or dependencies change
  useEffect(() => {
    fetchData();
  }, [
    instrument,
    interval,
    refreshTrigger,
    timeframe,
    isConnected,
    previousTimeframeData,
  ]);

  // Also refetch data when WebSocket first connects or when marketData becomes available
  useEffect(() => {
    if (
      timeframe === "currentDay" &&
      isConnected &&
      marketData[instrument]?.dailyOHLC
    ) {
      fetchData();
    }
  }, [isConnected, !!marketData[instrument]?.dailyOHLC]);

  // Update data when real-time data changes
  useEffect(() => {
    // For Today timeframe, update whenever the marketData changes
    if (
      timeframe === "currentDay" &&
      isConnected &&
      marketData[instrument]?.dailyOHLC &&
      data // Make sure we have previous data to preserve previousClose
    ) {
      const dailyOHLC = marketData[instrument].dailyOHLC;
      setData({
        opening: parseFloat(dailyOHLC.open),
        closing: parseFloat(dailyOHLC.close),
        highest: parseFloat(dailyOHLC.high),
        lowest: parseFloat(dailyOHLC.low),
        previousClose: data.previousClose, // Preserve the previous close
      });
      setIsLoading(false);
      setError(null); // Clear any previous error state
    }
  }, [marketData[instrument]?.dailyOHLC, instrument, timeframe, isConnected]);

  // Update real-time price when WebSocket data changes
  useEffect(() => {
    if (isConnected && marketData[instrument]) {
      const currentPrice = getCurrentRealTimePrice();
      if (currentPrice !== null) {
        setRealTimePrice(currentPrice);
      }
    }
  }, [marketData, isConnected, instrument]);

  const handleRefresh = (): void => {
    fetchData();
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

  if (error || !data) {
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
            {error || "No data available"}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Determine if bullish (closing > opening) for candlestick color
  const isBullish = data.closing > data.opening;
  const priceColor = isBullish ? "text-green-600" : "text-red-600";
  const bodyColor = isBullish ? "bg-green-500" : "bg-red-500";

  // Calculate change compared to previous day/timeframe close
  const previousClose = data.previousClose || 0;
  const hasValidPreviousClose = previousClose > 0;

  // Day-to-day change calculation
  const dayToDayChange = hasValidPreviousClose
    ? data.closing - previousClose
    : data.closing - data.opening; // Fallback to intraday change

  const dayToDayPercentChange = hasValidPreviousClose
    ? (dayToDayChange / previousClose) * 100
    : ((data.closing - data.opening) / data.opening) * 100;

  const dayToDayChangeColor =
    dayToDayChange >= 0 ? "text-green-600" : "text-red-600";

  // Calculate candlestick dimensions
  const candleHeight = 80; // Total height for the candlestick
  const maxPrice = Math.max(data.highest, data.opening, data.closing);
  const minPrice = Math.min(data.lowest, data.opening, data.closing);
  const priceRange = maxPrice - minPrice;

  // Calculate positions for the candlestick parts (as percentages of total height)
  const getPosition = (price: number) => {
    if (priceRange === 0) return 50; // Default to middle if no range
    return ((maxPrice - price) / priceRange) * candleHeight;
  };

  const highPosition = getPosition(data.highest);
  const lowPosition = getPosition(data.lowest);
  const openPosition = getPosition(data.opening);
  const closePosition = getPosition(data.closing);

  // Calculate body start, end, and height
  const bodyTop = isBullish ? closePosition : openPosition;
  const bodyBottom = isBullish ? openPosition : closePosition;
  const bodyHeight = Math.max(1, Math.abs(bodyBottom - bodyTop)); // Ensure minimum height of 1px

  // Calculate wick dimensions
  const upperWickHeight = bodyTop;
  const lowerWickHeight = candleHeight - bodyBottom;

  // Current price position (if available)
  const currentPricePosition = realTimePrice
    ? getPosition(realTimePrice)
    : null;

  return (
    <Card className="col-span-1">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="flex items-center space-x-2">
          {timeframe === "currentDay" &&
            isConnected &&
            marketData[instrument]?.dailyOHLC && (
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
        {/* OHLC Values */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-xs text-gray-500">Open</span>
            <div className="text-lg font-bold">{data.opening.toFixed(2)}</div>
          </div>
          <div>
            <span className="text-xs text-gray-500">Close</span>
            <div className={`text-lg font-bold ${priceColor}`}>
              {data.closing.toFixed(2)}
            </div>
          </div>
          <div>
            <span className="text-xs text-gray-500">High</span>
            <div className="text-lg font-bold">{data.highest.toFixed(2)}</div>
          </div>
          <div>
            <span className="text-xs text-gray-500">Low</span>
            <div className="text-lg font-bold">{data.lowest.toFixed(2)}</div>
          </div>
        </div>

        {/* Day-to-Day Price Change */}
        <div className={`flex justify-end ${dayToDayChangeColor}`}>
          <span className="font-medium">
            {dayToDayChange >= 0 ? "+" : ""}
            {dayToDayChange.toFixed(2)} ({dayToDayPercentChange.toFixed(2)}%)
          </span>
        </div>

        {/* Candlestick Visualization */}
        <div className="relative h-20 mt-2 flex items-center justify-center">
          {/* Container for the candlestick */}
          <div className="relative h-full w-20">
            {/* Upper Wick */}
            {upperWickHeight > 0 && (
              <div
                className="absolute w-px bg-gray-800 left-1/2 transform -translate-x-1/2"
                style={{
                  top: `${highPosition}px`,
                  height: `${upperWickHeight}px`,
                }}
              ></div>
            )}

            {/* Candle Body */}
            <div
              className={`absolute w-10 left-1/2 transform -translate-x-1/2 ${bodyColor}`}
              style={{
                top: `${bodyTop}px`,
                height: `${bodyHeight}px`,
              }}
            ></div>

            {/* Lower Wick */}
            {lowerWickHeight > 0 && (
              <div
                className="absolute w-px bg-gray-800 left-1/2 transform -translate-x-1/2"
                style={{
                  top: `${bodyBottom}px`,
                  height: `${lowerWickHeight}px`,
                }}
              ></div>
            )}

            {/* Current Price Line (if real-time data available) */}
            {currentPricePosition !== null && (
              <div
                className="absolute w-full h-px bg-blue-500 left-0 z-10"
                style={{ top: `${currentPricePosition}px` }}
              >
                <div className="absolute right-full mr-1 text-xs text-blue-500 font-medium">
                  {realTimePrice?.toFixed(2)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Previous close reference if available */}
        {hasValidPreviousClose && (
          <div className="text-xs text-gray-500 text-right">
            Previous close: {previousClose.toFixed(2)}
          </div>
        )}

        {timeframe === "currentDay" && isConnected && (
          <div className="flex items-center justify-end mt-1">
            <Activity className="h-3 w-3 text-green-500 animate-pulse mr-1" />
            <span className="text-xs text-gray-500">Real-time data</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
