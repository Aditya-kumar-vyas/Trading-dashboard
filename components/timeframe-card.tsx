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
  date?: string;
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

  // Add effect to update real-time price
  useEffect(() => {
    // Only update real-time price for current day timeframe when connected
    if (timeframe !== "currentDay" || !isConnected) {
      setRealTimePrice(null);
      return;
    }

    const handlePriceUpdate = () => {
      // Skip if no market data for this instrument
      if (!marketData[instrument]) return;

      // Try to get latest price from various formats
      let price = null;
      let source = "";

      // First try the feedData format - indexFF for index feeds
      if (marketData[instrument]?.ff?.indexFF?.ltpc?.ltp) {
        price = parseFloat(marketData[instrument].ff.indexFF.ltpc.ltp);
        source = "indexFF.ltpc.ltp";
      }
      // Try marketFF for stock feeds
      else if (marketData[instrument]?.ff?.marketFF?.ltpc?.ltp) {
        price = parseFloat(marketData[instrument].ff.marketFF.ltpc.ltp);
        source = "marketFF.ltpc.ltp";
      }
      // Generic ff.ltp for any feed type
      else if (marketData[instrument]?.ff?.ltp) {
        price = parseFloat(marketData[instrument].ff.ltp);
        source = "ff.ltp";
      }
      // Then try lastPrice if available
      else if (marketData[instrument]?.lastPrice) {
        price = parseFloat(marketData[instrument].lastPrice);
        source = "lastPrice";
      }
      // Then try the dailyOHLC format
      else if (marketData[instrument]?.dailyOHLC?.close) {
        price = parseFloat(marketData[instrument].dailyOHLC.close);
        source = "dailyOHLC.close";
      }

      if (price !== null && !isNaN(price)) {
        // Only log when the price changes or it's the first update
        if (realTimePrice === null || price !== realTimePrice) {
          console.log(
            `Real-time price updated for ${instrument}: ${price} (source: ${source})`
          );
          setRealTimePrice(price);
        }
      } else if (timeframe === "currentDay" && title === "Today") {
        // Log debugging info for today's card when we can't find a price
        console.log(
          `Could not find real-time price for ${instrument}. Available data:`,
          JSON.stringify(marketData[instrument]).substring(0, 200) + "..."
        );
      }
    };

    // Initial update
    handlePriceUpdate();

    // Set up interval to update price every second
    const interval = setInterval(handlePriceUpdate, 1000);

    // Clean up interval on unmount or when deps change
    return () => clearInterval(interval);
  }, [timeframe, isConnected, marketData, instrument, title, realTimePrice]);

  // Check if we should use real-time data for this timeframe
  const useRealTimeData = (): boolean => {
    // Only attempt to use real-time data for current day timeframe
    if (timeframe !== "currentDay") return false;

    // Only use real-time data if we're connected
    if (!isConnected) return false;

    // Check if we have data for this instrument
    if (!marketData[instrument]) {
      console.log(`No market data for ${instrument}`);
      return false;
    }

    // Debug log all available data formats
    console.log(
      `Available data for ${instrument}:`,
      Object.keys(marketData[instrument]).filter((key) => key !== "lastUpdated")
    );

    // Try to find any available data for this instrument
    // Check all possible data formats in order of preference
    if (marketData[instrument]?.ff?.indexFF?.ltpc?.ltp) {
      console.log(`Found real-time indexFF.ltpc.ltp data for ${instrument}`);
      return true;
    }

    if (marketData[instrument]?.ff?.marketFF?.ltpc?.ltp) {
      console.log(`Found real-time marketFF.ltpc.ltp data for ${instrument}`);
      return true;
    }

    if (marketData[instrument]?.ff?.ltp) {
      console.log(`Found real-time ff.ltp data for ${instrument}`);
      return true;
    }

    if (marketData[instrument]?.lastPrice) {
      console.log(`Found real-time lastPrice data for ${instrument}`);
      return true;
    }

    if (marketData[instrument]?.dailyOHLC) {
      console.log(`Found real-time dailyOHLC data for ${instrument}`);
      return true;
    }

    // No data found for this instrument
    console.log(`No real-time data found for ${instrument}`);
    return false;
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

    // For previousDay timeframe, we need to fetch data from the most recent trading day
    if (timeframe === "previousDay") {
      try {
        // Use our new API endpoint to find the last trading day with data
        const response = await fetch(
          `/api/last-trading-day?instrument=${encodeURIComponent(instrument)}`
        );

        if (!response.ok) return null;

        const result = await response.json();

        if (
          result.status === "success" &&
          result.data.candles &&
          result.data.candles.length > 0
        ) {
          const candles = result.data.candles.map(transformCandle);
          console.log("Previous trading day's candles:", candles);
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

    try {
      // Get previous day's close for correct change calculation
      const previousClose = await fetchPreviousDayClose();

      // Check if we should use real-time data
      if (useRealTimeData()) {
        console.log(`Using real-time data for ${instrument}`);
        try {
          // First try to get data from the full feed (ff)
          if (marketData[instrument]?.ff) {
            const feedData = marketData[instrument].ff;

            const newData: StatsData = {
              opening: feedData.opr || 0,
              closing: feedData.ltp || 0,
              highest: feedData.high || 0,
              lowest: feedData.low || 0,
              previousClose: previousClose || undefined,
            };

            setData(newData);
            setIsLoading(false);
            return;
          }

          // Then try to get dailyOHLC data
          else if (marketData[instrument]?.dailyOHLC) {
            const dailyOHLC = marketData[instrument].dailyOHLC;

            const newData: StatsData = {
              opening: parseFloat(dailyOHLC.open),
              closing: parseFloat(dailyOHLC.close || dailyOHLC.ltp),
              highest: parseFloat(dailyOHLC.high),
              lowest: parseFloat(dailyOHLC.low),
              previousClose: previousClose || undefined,
            };

            setData(newData);
            setIsLoading(false);
            return;
          }

          // If we have just LTP data
          else if (marketData[instrument]?.ltp) {
            const ltp = marketData[instrument].ltp;

            // We might not have full OHLC data, but we at least have current price
            const newData: StatsData = {
              opening: previousClose || 0, // Use previous close as opening if we don't have it
              closing: ltp,
              highest: ltp, // Use current price as high if we don't have it
              lowest: ltp, // Use current price as low if we don't have it
              previousClose: previousClose || undefined,
            };

            setData(newData);
            setIsLoading(false);
            return;
          }
        } catch (error) {
          console.error("Error processing real-time data:", error);
          // Fall through to fetch historical data
        }
      }

      // If we reach here, either we don't have real-time data or there was an error processing it
      // Fallback to historical API data
      try {
        // For the "previousDay" timeframe, use the last-trading-day endpoint
        if (timeframe === "previousDay") {
          const response = await fetch(
            `/api/last-trading-day?instrument=${encodeURIComponent(instrument)}`
          );

          if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }

          const result = await response.json();

          if (
            result.status === "success" &&
            result.data.candles &&
            result.data.candles.length > 0
          ) {
            const candles = result.data.candles.map(transformCandle);

            // Calculate OHLC data
            const newData = {
              opening: candles[0].open,
              closing: candles[0].close,
              highest: candles[0].high,
              lowest: candles[0].low,
              previousClose: previousClose || undefined,
              // Add the date we found to display in the UI
              date: result.lastTradingDate,
            };

            setData(newData);

            // Notify parent component about loaded data
            if (onDataLoaded) onDataLoaded(newData);
            setIsLoading(false);
          } else {
            setError("No data available for previous trading day");
            setIsLoading(false);
          }
        } else {
          // For other timeframes, use the original logic
          const { fromDate, toDate } = getDateRangeForTimeframe();

          // The API expects dates in format: to_date/from_date
          const formattedFromDate = format(fromDate, "yyyy-MM-dd");
          const formattedToDate = format(toDate, "yyyy-MM-dd");

          const response = await fetch(
            `/api/historical-data?instrument=${encodeURIComponent(
              instrument
            )}&interval=${interval}&to_date=${formattedToDate}&from_date=${formattedFromDate}`
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
                new Date(b.timestamp).getTime() -
                new Date(a.timestamp).getTime()
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
            setIsLoading(false);
          } else {
            setError("No data available for this timeframe");
            setIsLoading(false);
          }
        }
      } catch (error) {
        console.error(`Error fetching ${timeframe} data:`, error);
        setError("Could not fetch market data. Please try again later.");
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Error in fetchData:", error);
      setError("An unexpected error occurred. Please try again.");
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
      const currentPrice = realTimePrice;
      if (currentPrice !== null) {
        setRealTimePrice(currentPrice);
      }
    }
  }, [marketData, isConnected, realTimePrice]);

  const handleRefresh = (): void => {
    fetchData();
    if (onRefresh) onRefresh();
  };

  // Calculate change data (with real-time updates)
  const calculateChangeData = () => {
    if (!data) return { changeValue: 0, changePercent: 0, isRealTime: false };

    // Determine which price to use (real-time or closing)
    const currentPrice =
      timeframe === "currentDay" && realTimePrice !== null
        ? realTimePrice
        : data.closing;

    const isRealTime = timeframe === "currentDay" && realTimePrice !== null;

    // For current day, use previous day's close as base price if available
    const basePrice =
      timeframe === "currentDay" && data.previousClose
        ? data.previousClose
        : data.opening;

    const changeValue = currentPrice - basePrice;
    const changePercent = (changeValue / basePrice) * 100;

    return {
      changeValue,
      changePercent,
      isRealTime,
    };
  };

  // Render stock data
  const renderStockData = () => {
    if (isLoading) {
      return <p className="text-center py-4">Loading...</p>;
    }

    if (error) {
      return <p className="text-center text-red-500 py-4">{error}</p>;
    }

    if (!data || !data.closing) {
      return (
        <p className="text-center text-gray-500 py-4">No data available</p>
      );
    }

    // Determine current price based on timeframe
    const currentPrice =
      timeframe === "currentDay" && realTimePrice !== null
        ? realTimePrice
        : data.closing;

    // For current day, use previous day's close as base price if available
    const basePrice =
      timeframe === "currentDay" && data.previousClose
        ? data.previousClose
        : data.opening;

    // Calculate change
    const change = currentPrice - basePrice;
    const percentChange = (change / basePrice) * 100;

    // Format display values
    const priceDisplay = currentPrice.toFixed(2);
    const changeDisplay = change.toFixed(2);
    const percentDisplay = percentChange.toFixed(2);

    // Determine if change is positive, negative, or neutral
    const isPositive = change > 0;
    const isNegative = change < 0;

    // CSS classes for positive/negative values
    const changeColorClass = isPositive
      ? "text-green-600"
      : isNegative
      ? "text-red-600"
      : "text-gray-600";

    return (
      <div className="space-y-4">
        {/* Main price and change */}
        <div className="flex flex-col items-center">
          <div className="flex items-center space-x-2">
            <span className="text-2xl font-bold">{priceDisplay}</span>
            {timeframe === "currentDay" && realTimePrice !== null && (
              <Badge
                variant="outline"
                className="bg-green-100 text-green-800 text-xs animate-pulse"
              >
                LIVE
              </Badge>
            )}
          </div>

          <div className={`flex items-center ${changeColorClass}`}>
            <span>
              {isPositive ? "+" : ""}
              {changeDisplay} ({isPositive ? "+" : ""}
              {percentDisplay}%)
            </span>
          </div>
        </div>

        {/* OHLC Data Grid */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <div className="text-gray-500">Open</div>
            <div>{data.opening.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-gray-500">Close</div>
            <div>{data.closing.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-gray-500">High</div>
            <div>{data.highest.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-gray-500">Low</div>
            <div>{data.lowest.toFixed(2)}</div>
          </div>
          {data.previousClose && (
            <div className="col-span-2">
              <div className="text-gray-500">Prev Close</div>
              <div>{data.previousClose.toFixed(2)}</div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card className="col-span-1">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">
          {title}
          {timeframe === "previousDay" && data?.date && (
            <span className="block text-xs text-gray-500 font-normal">
              {new Date(data.date).toLocaleDateString()}
            </span>
          )}
        </CardTitle>
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
      <CardContent className="space-y-4">{renderStockData()}</CardContent>
    </Card>
  );
}
