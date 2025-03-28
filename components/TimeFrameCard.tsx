"use client";

import { useState, useEffect } from "react";
import {
  format,
  subDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subMonths,
} from "date-fns";
import { RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMarketData } from "@/hooks/useMarketData";
import { Interval, OHLCData, APIResponse, Candle } from "./types";

// Type definitions
export type Timeframe =
  | "currentDay"
  | "previousDay"
  | "threeDays"
  | "currentWeek"
  | "previousWeek"
  | "currentMonth"
  | "previousMonth"
  | "currentQuarter"
  | "previousQuarter"
  | "currentYear"
  | "previousYear";

export interface TimeframeCardProps {
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

const transformCandle = (candle: Candle): OHLCData => ({
  timestamp: candle[0],
  open: candle[1],
  high: candle[2],
  low: candle[3],
  close: candle[4],
});

export function TimeframeCard({
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
  const [isRealtime, setIsRealtime] = useState<boolean>(false);
  const { marketData, isConnected, lastUpdated } = useMarketData();

  // Maps exchange-specific instrument keys to the instrument format needed for our API
  const mapInstrumentKey = (key: string): string => {
    // Example: Convert NSE_INDEX|Nifty 50 to NSE_INDEX%7CNifty%2050
    if (key.includes("|")) {
      return key.replace("|", "%7C").replace(" ", "%20");
    }
    return key;
  };

  const getDateRangeForTimeframe = (): { fromDate: Date; toDate: Date } => {
    const today = new Date();
    let fromDate: Date;
    let toDate: Date = today;

    switch (timeframe) {
      case "currentDay":
        fromDate = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate()
        );
        break;
      case "previousDay":
        fromDate = subDays(today, 1);
        toDate = subDays(today, 1);
        break;
      case "threeDays":
        fromDate = subDays(today, 3);
        break;
      case "currentWeek":
        fromDate = startOfWeek(today, { weekStartsOn: 1 }); // Monday
        break;
      case "previousWeek":
        const lastWeekStart = startOfWeek(subDays(today, 7), {
          weekStartsOn: 1,
        });
        fromDate = lastWeekStart;
        toDate = endOfWeek(lastWeekStart, { weekStartsOn: 1 });
        break;
      case "currentMonth":
        fromDate = startOfMonth(today);
        break;
      case "previousMonth":
        const lastMonth = subMonths(today, 1);
        fromDate = startOfMonth(lastMonth);
        toDate = endOfMonth(lastMonth);
        break;
      case "currentQuarter":
        const currentMonth = today.getMonth();
        const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
        fromDate = new Date(today.getFullYear(), quarterStartMonth, 1);
        break;
      case "previousQuarter":
        // Previous quarter calculation
        const prevQuarterEndMonth = Math.floor(today.getMonth() / 3) * 3 - 1;
        const prevQuarterStartMonth = prevQuarterEndMonth - 2;
        const prevQuarterYear =
          today.getFullYear() + (prevQuarterEndMonth < 0 ? -1 : 0);

        // Set from date to first day of the previous quarter
        fromDate = new Date(prevQuarterYear, prevQuarterStartMonth, 1);

        // Calculate end date (last day of the quarter)
        toDate = new Date(prevQuarterYear, prevQuarterStartMonth + 3, 0);
        break;
      case "currentYear":
        fromDate = new Date(today.getFullYear(), 0, 1);
        break;
      case "previousYear":
        fromDate = new Date(today.getFullYear() - 1, 0, 1);
        toDate = new Date(today.getFullYear() - 1, 11, 31);
        break;
      default:
        fromDate = subDays(today, 7); // Default to 7 days
    }

    return { fromDate, toDate };
  };

  // Function to get real-time data from WebSocket feed
  const getRealtimeData = (): StatsData | null => {
    // Map your instrument key to the format used in the WebSocket feed
    let wsInstrumentKey = instrument;

    // For index instruments, they might be in a different format in WS feed
    // Example: Convert NSE_INDEX%7CNifty%2050 to NSE_INDEX|Nifty 50
    if (instrument.includes("%7C")) {
      wsInstrumentKey = instrument.replace("%7C", "|").replace("%20", " ");
    }

    // Check if we have data for this instrument in the WS feed
    const instrumentData = marketData[wsInstrumentKey];
    if (!instrumentData || !instrumentData.ohlcData) return null;

    // Map timeframe to interval in the WebSocket data
    let wsInterval: string;
    switch (timeframe) {
      case "currentDay":
        wsInterval = "1d";
        break;
      case "threeDays":
      case "currentWeek":
        wsInterval = "1d";
        break;
      case "currentMonth":
        wsInterval = "1d";
        break;
      default:
        // For timeframes that shouldn't use real-time data
        return null;
    }

    // Get OHLC data for the appropriate interval
    const ohlcData = instrumentData.ohlcData[wsInterval];
    if (!ohlcData) return null;

    return {
      opening: ohlcData.open,
      closing: ohlcData.close,
      highest: ohlcData.high,
      lowest: ohlcData.low,
    };
  };

  const fetchData = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);

    // First, check if we can use real-time data
    if (
      ["currentDay", "threeDays", "currentWeek", "currentMonth"].includes(
        timeframe
      ) &&
      isConnected
    ) {
      const realtimeData = getRealtimeData();
      if (realtimeData) {
        setData(realtimeData);
        setIsRealtime(true);
        setIsLoading(false);
        return;
      }
    }

    // If no real-time data available, fall back to API
    setIsRealtime(false);

    try {
      const { fromDate, toDate } = getDateRangeForTimeframe();

      // Important: The API expects dates in reversed order: to_date/from_date
      const formattedFromDate = format(fromDate, "yyyy-MM-dd");
      const formattedToDate = format(toDate, "yyyy-MM-dd");

      // Console log to debug the API call
      const apiUrl = `https://api.upstox.com/v2/historical-candle/${instrument}/${interval}/${formattedToDate}/${formattedFromDate}`;
      console.log(`Fetching ${timeframe}: ${apiUrl}`);

      const response = await fetch(apiUrl);

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
        // This ensures consistent data interpretation regardless of API response order
        candles.sort(
          (a: any, b: any) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        // Calculate OHLC properly for the entire timeframe
        setData({
          // Opening price is the first candle's open (earliest date)
          opening: candles[candles.length - 1].open,
          // Closing price is the last candle's close (latest date)
          closing: candles[0].close,
          // Highest is max of all high prices in timeframe
          highest: Math.max(...candles.map((d: any) => d.high)),
          // Lowest is min of all low prices in timeframe
          lowest: Math.min(...candles.map((d: any) => d.low)),
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

  // Listen for real-time updates from the WebSocket feed
  useEffect(() => {
    // Only apply real-time updates to relevant timeframes
    if (
      ["currentDay", "threeDays", "currentWeek", "currentMonth"].includes(
        timeframe
      ) &&
      isConnected
    ) {
      const realtimeData = getRealtimeData();
      if (realtimeData) {
        setData(realtimeData);
        setIsRealtime(true);
      }
    }
  }, [marketData, isConnected, lastUpdated]);

  // Fetch initial data when component mounts or when dependencies change
  useEffect(() => {
    fetchData();
  }, [instrument, interval, refreshTrigger, timeframe]);

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
    <Card
      className={`col-span-1 ${isRealtime ? "border-green-500 border-2" : ""}`}
    >
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex items-center">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          {isRealtime && (
            <Badge
              variant="outline"
              className="ml-2 bg-green-100 text-green-800 border-green-500"
            >
              LIVE
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4" />
        </Button>
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
      </CardContent>
    </Card>
  );
}
