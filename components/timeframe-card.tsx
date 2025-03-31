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
}

interface StatsData {
  opening: number;
  closing: number;
  highest: number;
  lowest: number;
}

export default function TimeframeCard({
  title,
  timeframe,
  instrument,
  interval,
  refreshTrigger,
  onRefresh,
}: TimeframeCardProps): JSX.Element {
  const [data, setData] = useState<StatsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const { isConnected, marketData } = useMarketData();

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

  const fetchData = async (): Promise<void> => {
    // Check if we should use real-time data
    if (useRealTimeData()) {
      const realTimeData = marketData[instrument];
      const dailyOHLC = realTimeData.dailyOHLC;

      setData({
        opening: parseFloat(dailyOHLC.open),
        closing: parseFloat(dailyOHLC.close),
        highest: parseFloat(dailyOHLC.high),
        lowest: parseFloat(dailyOHLC.low),
      });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

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
        setData({
          // Opening price is the first candle's open (earliest date)
          opening: candles[candles.length - 1].open,
          // Closing price is the last candle's close (latest date)
          closing: candles[0].close,
          // Highest is max of all high prices in timeframe
          highest: Math.max(...candles.map((d) => d.high)),
          // Lowest is min of all low prices in timeframe
          lowest: Math.min(...candles.map((d) => d.low)),
        });
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
  }, [instrument, interval, refreshTrigger, timeframe, isConnected]);

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
      marketData[instrument]?.dailyOHLC
    ) {
      const dailyOHLC = marketData[instrument].dailyOHLC;
      setData({
        opening: parseFloat(dailyOHLC.open),
        closing: parseFloat(dailyOHLC.close),
        highest: parseFloat(dailyOHLC.high),
        lowest: parseFloat(dailyOHLC.low),
      });
      setIsLoading(false);
      setError(null); // Clear any previous error state
    }
  }, [marketData[instrument]?.dailyOHLC, instrument, timeframe, isConnected]);

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
      <CardContent className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-xs text-gray-500">Open</span>
            <div className="text-lg font-bold">{data.opening.toFixed(2)}</div>
          </div>
          <div>
            <span className="text-xs text-gray-500">Close</span>
            <div className="text-lg font-bold">{data.closing.toFixed(2)}</div>
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

        {timeframe === "currentDay" && isConnected && (
          <div className="flex items-center justify-end mt-2">
            <Activity className="h-3 w-3 text-green-500 animate-pulse mr-1" />
            <span className="text-xs text-gray-500">Real-time data</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
