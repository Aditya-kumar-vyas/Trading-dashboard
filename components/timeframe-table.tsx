"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  format,
  subDays,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subMonths,
} from "date-fns";
import {
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Activity,
  Loader2,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

import { Interval, Timeframe, APIResponse, OHLCData } from "../app/types";
import { useMarketData } from "./market-data-context";
import { transformCandle } from "../lib/utils";
import { INSTRUMENTS } from "@/app/constants";

// StatsData type for timeframe data
interface StatsData {
  opening: number;
  closing: number;
  highest: number;
  lowest: number;
  previousClose?: number;
  date?: string;
}

// Data cache interface
interface DataCache {
  [key: string]: {
    timestamp: number;
    data: Record<Timeframe, StatsData | null>;
  };
}

// Request queue item
interface QueueItem {
  instrumentKey: string;
  timeframe: Timeframe;
  resolve: (data: StatsData | null) => void;
  reject: (error: Error) => void;
  retryCount: number;
}

interface TimeframeTableProps {
  instrument: string;
  indexStocks: { key: string; label: string }[];
  interval: Interval;
  refreshTrigger: number;
  onRefresh: () => void;
}

// Constants
const CACHE_EXPIRY_TIME = 5 * 60 * 1000; // 5 minutes for memory cache
const LOCALSTORAGE_EXPIRY_TIME = 60 * 60 * 1000; // 1 hour for localStorage cache
const LOCALSTORAGE_KEY_PREFIX = "timeframe_data_";
const MAX_RETRIES = 3;
const BASE_DELAY = 1000; // 1 second
const MAX_CONCURRENT_REQUESTS = 2;

export default function TimeframeTable({
  instrument,
  indexStocks,
  interval,
  refreshTrigger,
  onRefresh,
}: TimeframeTableProps): JSX.Element {
  // Define timeframes to display
  const timeframes: { title: string; id: Timeframe }[] = [
    { title: "Today", id: "currentDay" },
    { title: "Previous Day", id: "previousDay" },
    { title: "3-Day OHLC", id: "threeDays" },
    { title: "Current Week", id: "currentWeek" },
    { title: "Previous Week", id: "previousWeek" },
    { title: "Current Month", id: "currentMonth" },
    { title: "Previous Month", id: "previousMonth" },
    { title: "Current Quarter", id: "currentQuarter" },
    { title: "Previous Quarter", id: "previousQuarter" },
    { title: "Current Year", id: "currentYear" },
    { title: "Previous Year", id: "previousYear" },
  ];

  const [selectedTimeframe, setSelectedTimeframe] =
    useState<Timeframe>("currentDay");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [singleStockData, setSingleStockData] = useState<
    Record<Timeframe, StatsData | null>
  >({} as Record<Timeframe, StatsData | null>);
  const [allStocksData, setAllStocksData] = useState<
    Record<string, Record<Timeframe, StatsData | null>>
  >({});
  const [sortColumn, setSortColumn] = useState<string>("label");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const { isConnected, marketData, subscribeToInstruments } = useMarketData();

  // Add loading progress state with more details
  const [loadingProgress, setLoadingProgress] = useState<{
    current: number;
    total: number;
    message: string;
    lastUpdated: number;
  }>({ current: 0, total: 0, message: "", lastUpdated: Date.now() });

  // Create refs for persistent data across renders
  const dataCache = useRef<DataCache>({});
  const requestQueue = useRef<QueueItem[]>([]);
  const activeRequests = useRef<number>(0);
  const processingQueue = useRef<boolean>(false);

  // Determine if we should show all stocks in the index or just the selected instrument
  const showAllStocks = indexStocks.length > 0;

  // Process the queue - this is the heart of our request throttling system
  const processQueue = useCallback(async () => {
    // If already processing or no items, exit
    if (processingQueue.current || requestQueue.current.length === 0) return;

    // Mark as processing
    processingQueue.current = true;

    try {
      // Process as many items as we can (up to MAX_CONCURRENT_REQUESTS)
      while (
        requestQueue.current.length > 0 &&
        activeRequests.current < MAX_CONCURRENT_REQUESTS
      ) {
        // Get next item from queue
        const item = requestQueue.current.shift();
        if (!item) continue;

        const { instrumentKey, timeframe, resolve, reject, retryCount } = item;

        // Check cache first
        const cacheKey = `${instrumentKey}-${timeframe}-${interval}`;
        const cachedItem = dataCache.current[cacheKey];

        if (
          cachedItem &&
          Date.now() - cachedItem.timestamp < CACHE_EXPIRY_TIME &&
          cachedItem.data[timeframe]
        ) {
          // Use cached data if available and not expired
          resolve(cachedItem.data[timeframe]);

          // Update progress
          setLoadingProgress((prev) => ({
            ...prev,
            current: prev.current + 1,
            message: `Loading from cache: ${instrumentKey} (${timeframe})`,
            lastUpdated: Date.now(),
          }));

          continue;
        }

        // Increment active requests counter
        activeRequests.current++;

        // Process request asynchronously
        fetchTimeframeData(timeframe, instrumentKey, retryCount)
          .then((data) => {
            // Store in cache and resolve promise
            if (!dataCache.current[cacheKey]) {
              dataCache.current[cacheKey] = {
                timestamp: Date.now(),
                data: {} as Record<Timeframe, StatsData | null>,
              };
            }

            // Update cache
            dataCache.current[cacheKey].data[timeframe] = data;
            dataCache.current[cacheKey].timestamp = Date.now();

            resolve(data);
          })
          .catch((err) => {
            if (retryCount < MAX_RETRIES) {
              // Requeue with exponential backoff if retries left
              const delay = Math.pow(2, retryCount) * BASE_DELAY;

              setLoadingProgress((prev) => ({
                ...prev,
                message: `Rate limit hit. Waiting ${
                  delay / 1000
                }s to retry ${instrumentKey} (${
                  retryCount + 1
                }/${MAX_RETRIES})`,
                lastUpdated: Date.now(),
              }));

              // Add back to queue with incremented retry count after delay
              setTimeout(() => {
                requestQueue.current.push({
                  instrumentKey,
                  timeframe,
                  resolve,
                  reject,
                  retryCount: retryCount + 1,
                });
                processQueue(); // Try to process queue again
              }, delay);
            } else {
              // Max retries reached, reject with error
              reject(err);
            }
          })
          .finally(() => {
            // Decrement active requests counter
            activeRequests.current--;

            // Try to process more items from queue
            processQueue();
          });

        // Add small delay between starting new requests to avoid bursts
        if (requestQueue.current.length > 0) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }
    } finally {
      // Mark as not processing anymore
      processingQueue.current = false;

      // If more items and capacity, process more
      if (
        requestQueue.current.length > 0 &&
        activeRequests.current < MAX_CONCURRENT_REQUESTS
      ) {
        processQueue();
      }
    }
  }, [interval]);

  // Queue a request and return a promise
  const queueRequest = useCallback(
    (
      instrumentKey: string,
      timeframe: Timeframe
    ): Promise<StatsData | null> => {
      return new Promise((resolve, reject) => {
        // Add request to queue
        requestQueue.current.push({
          instrumentKey,
          timeframe,
          resolve,
          reject,
          retryCount: 0,
        });

        // Try to process queue
        processQueue();
      });
    },
    [processQueue]
  );

  // Handle sorting
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      // Toggle direction if clicking the same column
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // Set new column and default to ascending
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  // Get sorted stocks for display
  const getSortedStocks = () => {
    const stocks = [...indexStocks].filter(
      (stock) =>
        // Filter out invalid instrument keys
        stock.key && stock.key !== "#N/A" && !stock.key.includes("#N/A")
    );

    return stocks.sort((a, b) => {
      // For label sorting, use alphabetical order
      if (sortColumn === "label") {
        return sortDirection === "asc"
          ? a.label.localeCompare(b.label)
          : b.label.localeCompare(a.label);
      }

      // For Today timeframe, try to use real-time data for sorting if available
      if (selectedTimeframe === "currentDay") {
        const rtDataA = getRealTimeData(a.key);
        const rtDataB = getRealTimeData(b.key);

        // If both have real-time data, use it for sorting
        if (rtDataA?.dailyOHLC && rtDataB?.dailyOHLC) {
          let compareValue = 0;

          // Sort based on the selected column
          switch (sortColumn) {
            case "open":
              compareValue =
                parseFloat(rtDataA.dailyOHLC.open) -
                parseFloat(rtDataB.dailyOHLC.open);
              break;
            case "high":
              compareValue =
                parseFloat(rtDataA.dailyOHLC.high) -
                parseFloat(rtDataB.dailyOHLC.high);
              break;
            case "low":
              compareValue =
                parseFloat(rtDataA.dailyOHLC.low) -
                parseFloat(rtDataB.dailyOHLC.low);
              break;
            case "close":
              compareValue =
                (rtDataA.lastPrice || parseFloat(rtDataA.dailyOHLC.close)) -
                (rtDataB.lastPrice || parseFloat(rtDataB.dailyOHLC.close));
              break;
            case "change":
              const openA = parseFloat(rtDataA.dailyOHLC.open);
              const closeA =
                rtDataA.lastPrice || parseFloat(rtDataA.dailyOHLC.close);
              const openB = parseFloat(rtDataB.dailyOHLC.open);
              const closeB =
                rtDataB.lastPrice || parseFloat(rtDataB.dailyOHLC.close);

              compareValue = closeA - openA - (closeB - openB);
              break;
            case "changePercent":
              const openPercentA = parseFloat(rtDataA.dailyOHLC.open);
              const closePercentA =
                rtDataA.lastPrice || parseFloat(rtDataA.dailyOHLC.close);
              const openPercentB = parseFloat(rtDataB.dailyOHLC.open);
              const closePercentB =
                rtDataB.lastPrice || parseFloat(rtDataB.dailyOHLC.close);

              const percentChangeA =
                ((closePercentA - openPercentA) / openPercentA) * 100;
              const percentChangeB =
                ((closePercentB - openPercentB) / openPercentB) * 100;

              compareValue = percentChangeA - percentChangeB;
              break;
            default:
              compareValue = 0;
          }

          // Apply direction
          return sortDirection === "asc" ? compareValue : -compareValue;
        }
      }

      // Fall back to the original sorting logic if real-time data isn't available
      // Check if we have data for both stocks
      const hasDataA =
        allStocksData[a.key] && allStocksData[a.key][selectedTimeframe];
      const hasDataB =
        allStocksData[b.key] && allStocksData[b.key][selectedTimeframe];

      // Handle cases where data is missing
      if (!hasDataA && !hasDataB) return 0;
      if (!hasDataA) return 1;
      if (!hasDataB) return -1;

      const dataA = allStocksData[a.key][selectedTimeframe]!;
      const dataB = allStocksData[b.key][selectedTimeframe]!;

      let compareValue = 0;

      // Sort based on the selected column
      switch (sortColumn) {
        case "open":
          compareValue = dataA.opening - dataB.opening;
          break;
        case "high":
          compareValue = dataA.highest - dataB.highest;
          break;
        case "low":
          compareValue = dataA.lowest - dataB.lowest;
          break;
        case "close":
          compareValue = dataA.closing - dataB.closing;
          break;
        case "change":
          const changeA = dataA.closing - dataA.opening;
          const changeB = dataB.closing - dataB.opening;
          compareValue = changeA - changeB;
          break;
        case "changePercent":
          const percentChangeA =
            ((dataA.closing - dataA.opening) / dataA.opening) * 100;
          const percentChangeB =
            ((dataB.closing - dataB.opening) / dataB.opening) * 100;
          compareValue = percentChangeA - percentChangeB;
          break;
        default:
          compareValue = 0;
      }

      // Apply direction
      return sortDirection === "asc" ? compareValue : -compareValue;
    });
  };

  // Calculate date range for timeframe
  const getDateRangeForTimeframe = (
    timeframe: Timeframe
  ): { fromDate: Date; toDate: Date } => {
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
        // For 3-day OHLC, get data for last 7 calendar days to ensure we capture at least 3 trading days
        // The actual filtering for trading days will happen in the data processing
        fromDate = subDays(today, 7);
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

  // First improve isValidInstrument function
  const isValidInstrument = (key: string): boolean => {
    return Boolean(key) && key !== "#N/A" && !key.includes("#N/A");
  };

  // Enhanced fetchTimeframeData with localStorage caching
  const fetchTimeframeData = async (
    timeframe: Timeframe,
    instrumentKey: string,
    retryCount = 0
  ): Promise<StatsData | null> => {
    // Validate instrument key before making API call
    if (!isValidInstrument(instrumentKey)) {
      console.warn(
        `Invalid instrument key: ${instrumentKey}. Skipping API call.`
      );
      return null;
    }

    // Generate a cache key for localStorage
    const { fromDate, toDate } = getDateRangeForTimeframe(timeframe);
    const formattedFromDate = format(fromDate, "yyyy-MM-dd");
    const formattedToDate = format(toDate, "yyyy-MM-dd");
    const localStorageCacheKey = `${LOCALSTORAGE_KEY_PREFIX}${instrumentKey}_${timeframe}_${interval}_${formattedFromDate}_${formattedToDate}`;

    try {
      // First check localStorage cache
      const cachedData = localStorage.getItem(localStorageCacheKey);

      if (cachedData) {
        try {
          const parsedCache = JSON.parse(cachedData);
          // Check if the cache is still valid
          if (Date.now() - parsedCache.timestamp < LOCALSTORAGE_EXPIRY_TIME) {
            console.log(
              `Using localStorage cache for ${instrumentKey} (${timeframe})`
            );

            // Update progress
            setLoadingProgress((prev) => ({
              ...prev,
              current: prev.current + 1,
              message: `Loaded from cache: ${instrumentKey} (${timeframe})`,
              lastUpdated: Date.now(),
            }));

            return parsedCache.data;
          }
        } catch (e) {
          console.warn("Error parsing cached data:", e);
          // Continue with API call if cache parsing fails
        }
      }

      // Update progress message
      setLoadingProgress((prev) => ({
        ...prev,
        message: `Fetching ${
          INSTRUMENTS.find((inst) => inst.key === instrumentKey)?.label ||
          instrumentKey
        } (${timeframe})`,
        lastUpdated: Date.now(),
      }));

      // The API expects dates in format: to_date/from_date
      const response = await fetch(
        `/api/historical-data?instrument=${encodeURIComponent(
          instrumentKey
        )}&interval=${interval}&to_date=${formattedToDate}&from_date=${formattedFromDate}`
      );

      // Handle rate limiting explicitly
      if (response.status === 429 || response.status === 409) {
        throw new Error(`Rate limit reached (${response.status})`);
      }

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const result: APIResponse = await response.json();

      if (
        result.status === "success" &&
        result.data.candles &&
        result.data.candles.length > 0
      ) {
        let candles = result.data.candles.map(transformCandle);

        // Sort candles by timestamp in descending order (newest first)
        candles.sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        // Special handling for threeDays timeframe
        if (timeframe === "threeDays") {
          // Get the last 3 trading days (with actual data)
          // First, sort candles by timestamp in ascending order (oldest first)
          candles.sort(
            (a, b) =>
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
          );

          // Get unique trading days from the candles
          const tradingDays = Array.from(
            new Set(
              candles.map((c) => format(new Date(c.timestamp), "yyyy-MM-dd"))
            )
          );

          // Take only the last 3 trading days if we have enough
          if (tradingDays.length >= 3) {
            const lastThreeTradingDays = tradingDays.slice(-3);
            // Filter candles to only include the last 3 trading days
            candles = candles.filter((candle) =>
              lastThreeTradingDays.includes(
                format(new Date(candle.timestamp), "yyyy-MM-dd")
              )
            );
          } else {
            console.log(
              `Only found ${tradingDays.length} trading days for ${instrumentKey} in threeDays timeframe`
            );
          }

          // Sort back to newest first for processing
          candles.sort(
            (a, b) =>
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
        }

        const data = {
          // Opening price is the first candle's open (earliest date)
          opening: candles[candles.length - 1].open,
          // Closing price is the last candle's close (latest date)
          closing: candles[0].close,
          // Highest is max of all high prices in timeframe
          highest: Math.max(...candles.map((d) => d.high)),
          // Lowest is min of all low prices in timeframe
          lowest: Math.min(...candles.map((d) => d.low)),
        };

        // Store in localStorage
        try {
          localStorage.setItem(
            localStorageCacheKey,
            JSON.stringify({
              timestamp: Date.now(),
              data,
            })
          );
          console.log(`Cached ${instrumentKey} (${timeframe}) in localStorage`);
        } catch (e) {
          console.warn("Error storing data in localStorage:", e);
          // Continue even if localStorage fails
        }

        // Update progress
        setLoadingProgress((prev) => ({
          ...prev,
          current: prev.current + 1,
          lastUpdated: Date.now(),
        }));

        return data;
      }

      // Update progress even for empty results
      setLoadingProgress((prev) => ({
        ...prev,
        current: prev.current + 1,
        lastUpdated: Date.now(),
      }));

      return null;
    } catch (error) {
      console.error(
        `Error fetching data for ${timeframe} (${instrumentKey}):`,
        error
      );

      // Let the queue handler deal with retries
      throw error;
    }
  };

  // Update fetchMultipleTimeframes with threeDays special handling
  const fetchMultipleTimeframes = async (
    instrumentKey: string,
    timeframeIds: Timeframe[]
  ): Promise<Record<Timeframe, StatsData | null>> => {
    // Skip if invalid instrument
    if (!isValidInstrument(instrumentKey)) {
      console.warn(
        `Invalid instrument key: ${instrumentKey}. Skipping batch fetch.`
      );
      return timeframeIds.reduce((acc, tf) => {
        acc[tf] = null;
        return acc;
      }, {} as Record<Timeframe, StatsData | null>);
    }

    // If no timeframes to fetch, return empty result with correct typing
    if (timeframeIds.length === 0) {
      return {} as Record<Timeframe, StatsData | null>;
    }

    // Prepare the result object
    const timeframeResults: Record<Timeframe, StatsData | null> = {} as Record<
      Timeframe,
      StatsData | null
    >;

    // Track which timeframes we need to fetch from API
    const timeframesToFetch: Timeframe[] = [];

    try {
      // First try to get data from localStorage for each timeframe
      for (const tfId of timeframeIds) {
        const { fromDate, toDate } = getDateRangeForTimeframe(tfId);
        const formattedFromDate = format(fromDate, "yyyy-MM-dd");
        const formattedToDate = format(toDate, "yyyy-MM-dd");
        const localStorageCacheKey = `${LOCALSTORAGE_KEY_PREFIX}${instrumentKey}_${tfId}_${interval}_${formattedFromDate}_${formattedToDate}`;

        const cachedData = localStorage.getItem(localStorageCacheKey);

        if (cachedData) {
          try {
            const parsedCache = JSON.parse(cachedData);
            if (Date.now() - parsedCache.timestamp < LOCALSTORAGE_EXPIRY_TIME) {
              // Use cached data
              timeframeResults[tfId] = parsedCache.data;

              // Update progress
              setLoadingProgress((prev) => ({
                ...prev,
                current: prev.current + 1,
                message: `Loaded from cache: ${instrumentKey} (${tfId})`,
                lastUpdated: Date.now(),
              }));

              continue; // Skip API fetch for this timeframe
            }
          } catch (e) {
            console.warn("Error parsing cached data:", e);
          }
        }

        // If we reach here, we need to fetch this timeframe
        timeframesToFetch.push(tfId);
      }

      // If all timeframes were cached, return early
      if (timeframesToFetch.length === 0) {
        console.log(`All timeframes for ${instrumentKey} loaded from cache`);
        return timeframeResults;
      }

      console.log(
        `Fetching ${timeframesToFetch.length} timeframes for ${instrumentKey} from API`
      );

      // First handle "previousDay" specially if it's in the requested timeframes
      if (timeframesToFetch.includes("previousDay")) {
        try {
          // Update progress message for previousDay special handling
          setLoadingProgress((prev) => ({
            ...prev,
            message: `Fetching last trading day for ${instrumentKey}`,
            lastUpdated: Date.now(),
          }));

          // Use the special last-trading-day endpoint for previousDay timeframe
          const response = await fetch(
            `/api/last-trading-day?instrument=${encodeURIComponent(
              instrumentKey
            )}`
          );

          if (response.ok) {
            const result = await response.json();

            if (
              result.status === "success" &&
              result.data.candles &&
              result.data.candles.length > 0
            ) {
              const candles = result.data.candles.map(transformCandle);

              // Set the previousDay data from the last trading day
              const previousDayData = {
                opening: candles[0].open,
                closing: candles[0].close,
                highest: candles[0].high,
                lowest: candles[0].low,
                date: result.lastTradingDate,
              };

              timeframeResults["previousDay"] = previousDayData;

              // Cache in localStorage
              try {
                const { fromDate, toDate } =
                  getDateRangeForTimeframe("previousDay");
                const formattedFromDate = format(fromDate, "yyyy-MM-dd");
                const formattedToDate = format(toDate, "yyyy-MM-dd");
                const localStorageCacheKey = `${LOCALSTORAGE_KEY_PREFIX}${instrumentKey}_previousDay_${interval}_${formattedFromDate}_${formattedToDate}`;

                localStorage.setItem(
                  localStorageCacheKey,
                  JSON.stringify({
                    timestamp: Date.now(),
                    data: previousDayData,
                  })
                );
              } catch (e) {
                console.warn(
                  "Error storing previousDay data in localStorage:",
                  e
                );
              }

              // Update progress
              setLoadingProgress((prev) => ({
                ...prev,
                current: prev.current + 1,
                lastUpdated: Date.now(),
              }));
            } else {
              timeframeResults["previousDay"] = null;

              // Update progress
              setLoadingProgress((prev) => ({
                ...prev,
                current: prev.current + 1,
                lastUpdated: Date.now(),
              }));
            }
          } else {
            console.error(
              "Error fetching last trading day:",
              await response.text()
            );
            timeframeResults["previousDay"] = null;

            // Update progress
            setLoadingProgress((prev) => ({
              ...prev,
              current: prev.current + 1,
              lastUpdated: Date.now(),
            }));
          }
        } catch (error) {
          console.error("Error processing last trading day:", error);
          timeframeResults["previousDay"] = null;

          // Update progress
          setLoadingProgress((prev) => ({
            ...prev,
            current: prev.current + 1,
            lastUpdated: Date.now(),
          }));
        }

        // Remove previousDay from the timeframes to fetch in the batch request
        const remainingTimeframes = timeframesToFetch.filter(
          (tf) => tf !== "previousDay"
        );

        // If no more timeframes to fetch, return early
        if (remainingTimeframes.length === 0) {
          return timeframeResults;
        }

        // Continue with the remaining timeframes
        timeframesToFetch.length = 0;
        timeframesToFetch.push(...remainingTimeframes);
      }

      // Find the date range that covers all requested timeframes
      let globalFromDate = new Date();
      let globalToDate = new Date(0); // Start with earliest possible date

      // First determine the global date range needed
      timeframesToFetch.forEach((timeframe) => {
        const { fromDate, toDate } = getDateRangeForTimeframe(timeframe);
        if (fromDate < globalFromDate) {
          globalFromDate = fromDate;
        }
        if (toDate > globalToDate) {
          globalToDate = toDate;
        }
      });

      // Format dates for API
      const formattedFromDate = format(globalFromDate, "yyyy-MM-dd");
      const formattedToDate = format(globalToDate, "yyyy-MM-dd");

      // Update progress message for batch request
      setLoadingProgress((prev) => ({
        ...prev,
        message: `Batch fetching ${timeframesToFetch.length} timeframes for ${
          INSTRUMENTS.find((inst) => inst.key === instrumentKey)?.label ||
          instrumentKey
        }`,
        lastUpdated: Date.now(),
      }));

      // Make a single API call to fetch all data
      const response = await fetch(
        `/api/historical-data?instrument=${encodeURIComponent(
          instrumentKey
        )}&interval=${interval}&to_date=${formattedToDate}&from_date=${formattedFromDate}`
      );

      // Handle rate limiting
      if (response.status === 429 || response.status === 409) {
        throw new Error(`Rate limit reached (${response.status})`);
      }

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const result: APIResponse = await response.json();

      if (
        result.status === "success" &&
        result.data.candles &&
        result.data.candles.length > 0
      ) {
        const allCandles = result.data.candles.map(transformCandle);

        // Sort all candles by timestamp (oldest first)
        allCandles.sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        // Process each timeframe using the same dataset
        timeframesToFetch.forEach((tfId) => {
          const { fromDate, toDate } = getDateRangeForTimeframe(tfId);

          // Filter candles for this specific timeframe
          let timeframeCandles = allCandles.filter((candle) => {
            const candleDate = new Date(candle.timestamp);
            return candleDate >= fromDate && candleDate <= toDate;
          });

          // Special handling for threeDays timeframe
          if (tfId === "threeDays" && timeframeCandles.length > 0) {
            // Get unique trading days from the candles
            const tradingDays = Array.from(
              new Set(
                timeframeCandles.map((c) =>
                  format(new Date(c.timestamp), "yyyy-MM-dd")
                )
              )
            );

            // Take only the last 3 trading days if we have enough
            if (tradingDays.length >= 3) {
              const lastThreeTradingDays = tradingDays.slice(-3);
              // Filter candles to only include the last 3 trading days
              timeframeCandles = timeframeCandles.filter((candle) =>
                lastThreeTradingDays.includes(
                  format(new Date(candle.timestamp), "yyyy-MM-dd")
                )
              );
            } else {
              console.log(
                `Only found ${tradingDays.length} trading days for ${instrumentKey} in threeDays timeframe`
              );
            }
          }

          if (timeframeCandles.length > 0) {
            const tfData = {
              opening: timeframeCandles[0].open,
              closing: timeframeCandles[timeframeCandles.length - 1].close,
              highest: Math.max(...timeframeCandles.map((d) => d.high)),
              lowest: Math.min(...timeframeCandles.map((d) => d.low)),
            };

            timeframeResults[tfId] = tfData;

            // Cache in localStorage
            try {
              const localStorageCacheKey = `${LOCALSTORAGE_KEY_PREFIX}${instrumentKey}_${tfId}_${interval}_${format(
                fromDate,
                "yyyy-MM-dd"
              )}_${format(toDate, "yyyy-MM-dd")}`;

              localStorage.setItem(
                localStorageCacheKey,
                JSON.stringify({
                  timestamp: Date.now(),
                  data: tfData,
                })
              );
            } catch (e) {
              console.warn(`Error storing ${tfId} data in localStorage:`, e);
            }
          } else {
            timeframeResults[tfId] = null;
          }

          // Update progress for each timeframe processed
          setLoadingProgress((prev) => ({
            ...prev,
            current: prev.current + 1,
            lastUpdated: Date.now(),
          }));
        });
      } else {
        // No data, set all timeframes to null
        timeframesToFetch.forEach((tfId) => {
          timeframeResults[tfId] = null;

          // Update progress even for empty results
          setLoadingProgress((prev) => ({
            ...prev,
            current: prev.current + 1,
            lastUpdated: Date.now(),
          }));
        });
      }

      return timeframeResults;
    } catch (error) {
      console.error(`Error in batch fetch for ${instrumentKey}:`, error);

      // On error, set all remaining timeframes to null
      timeframesToFetch.forEach((tfId) => {
        if (!timeframeResults[tfId]) {
          timeframeResults[tfId] = null;
        }
      });

      return timeframeResults;
    }
  };

  // Update loadSingleInstrumentData to use batched fetching
  const loadSingleInstrumentData = async () => {
    setIsLoading(true);
    setError(null);

    const total = timeframes.length;
    setLoadingProgress({
      current: 0,
      total,
      message: "Preparing to load timeframes...",
      lastUpdated: Date.now(),
    });

    try {
      // Get all timeframe IDs
      const allTimeframeIds = timeframes.map((tf) => tf.id);

      // Batch fetch all timeframes in a single API call
      const allResults = await fetchMultipleTimeframes(
        instrument,
        allTimeframeIds
      );

      // Update state with the results
      setSingleStockData(allResults);
    } catch (err) {
      console.error("Error loading single instrument data:", err);
      setError("Failed to load timeframe data. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  // Update loadAllStocksData to use batched fetching
  const loadAllStocksData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Get all valid instruments including the index
      const allInstruments = [
        {
          key: instrument,
          label:
            INSTRUMENTS.find((inst) => inst.key === instrument)?.label ||
            "Index",
        },
        ...indexStocks,
      ].filter((inst) => isValidInstrument(inst.key));

      console.log("All instruments to fetch:", allInstruments);

      // Get all timeframe IDs
      const allTimeframeIds = timeframes.map((tf) => tf.id);

      // Set up progress tracking
      const total = allInstruments.length * allTimeframeIds.length;
      setLoadingProgress({
        current: 0,
        total,
        message: "Preparing to batch load stocks data...",
        lastUpdated: Date.now(),
      });

      // New data structure to hold results
      const newData: Record<string, Record<Timeframe, StatsData | null>> = {};

      // Process each instrument with batched timeframe fetching
      const promises = allInstruments.map(async (inst) => {
        try {
          // Batch fetch all timeframes for this instrument
          const timeframeResults = await fetchMultipleTimeframes(
            inst.key,
            allTimeframeIds
          );

          // Store results
          newData[inst.key] = timeframeResults;
        } catch (error) {
          console.error(`Failed to fetch data for ${inst.label}:`, error);
          // Initialize with nulls on error
          newData[inst.key] = allTimeframeIds.reduce((acc, tf) => {
            acc[tf] = null;
            return acc;
          }, {} as Record<Timeframe, StatsData | null>);
        }
      });

      // Wait for all batched requests to complete
      await Promise.allSettled(promises);

      // Update state with all data at once
      setAllStocksData(newData);
    } catch (err) {
      console.error("Error loading all stocks data:", err);
      setError("Failed to load stocks data. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  // Update progress bar animation
  useEffect(() => {
    // Auto-update progress message if it's stale
    const interval = setInterval(() => {
      if (isLoading && Date.now() - loadingProgress.lastUpdated > 3000) {
        setLoadingProgress((prev) => ({
          ...prev,
          message: prev.message.includes("waiting")
            ? "Still waiting for API response..."
            : prev.message,
          lastUpdated: Date.now(),
        }));
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isLoading, loadingProgress.lastUpdated]);

  // Calculate change data for display
  const calculateChangeData = (
    data: StatsData,
    previousDayClose?: number | null
  ) => {
    // Use previousDayClose if provided, otherwise fallback to opening price
    const baseValue =
      previousDayClose !== undefined && previousDayClose !== null
        ? previousDayClose
        : data.opening;

    const changeValue = data.closing - baseValue;
    const changePercent = (changeValue / baseValue) * 100;

    return { changeValue, changePercent };
  };

  // Load data when component mounts or dependencies change
  useEffect(() => {
    // Clear existing queue when dependencies change
    requestQueue.current = [];

    if (showAllStocks) {
      loadAllStocksData();
    } else {
      loadSingleInstrumentData();
    }
  }, [
    instrument,
    indexStocks.length,
    interval,
    refreshTrigger,
    selectedTimeframe,
    showAllStocks,
  ]);

  // Update useEffect to better handle instrument subscription
  useEffect(() => {
    if (isConnected && indexStocks.length > 0) {
      // Get all valid stock keys including the main instrument
      const allInstrumentKeys = [
        instrument,
        ...indexStocks.map((stock: { key: string }) => stock.key),
      ].filter(isValidInstrument);

      console.log(
        `Attempting to subscribe to ${
          allInstrumentKeys.length
        } instruments for ${
          INSTRUMENTS.find((i) => i.key === instrument)?.label || "index"
        }`
      );

      // Subscribe to all instruments with proper formatting
      if (allInstrumentKeys.length > 0) {
        // Format the keys for subscription - add NSE_EQ| prefix if needed
        const formattedKeys = allInstrumentKeys.map((key) => {
          // Only add prefix if it doesn't already have a format identifier
          if (!key.includes("|") && !key.includes("_INDEX")) {
            return `NSE_EQ|${key}`;
          }
          return key;
        });

        console.log("Subscribing to all index stocks with formatted keys");
        subscribeToInstruments(formattedKeys);
      }
    }
  }, [isConnected, instrument, indexStocks, subscribeToInstruments]);

  // Add a debug effect to log real-time data availability
  useEffect(() => {
    if (isConnected && showAllStocks) {
      // Count how many stocks have real-time data
      const stocksWithRealTimeData = indexStocks.filter(
        (stock) => marketData[stock.key] || marketData[`NSE_EQ|${stock.key}`]
      );

      if (stocksWithRealTimeData.length > 0) {
        console.log(
          `Real-time data available for ${stocksWithRealTimeData.length}/${indexStocks.length} stocks`
        );
      }
    }
  }, [isConnected, marketData, indexStocks, showAllStocks]);

  // Helper function to check if real-time data is available for a stock
  const hasRealTimeData = (stockKey: string): boolean => {
    // Check both with and without NSE_EQ| prefix
    return Boolean(
      (isConnected && marketData[stockKey]?.dailyOHLC) ||
        (isConnected && marketData[`NSE_EQ|${stockKey}`]?.dailyOHLC)
    );
  };

  // Helper function to get real-time data for a stock
  const getRealTimeData = (stockKey: string): any => {
    // Try both with and without NSE_EQ| prefix
    return marketData[stockKey] || marketData[`NSE_EQ|${stockKey}`] || null;
  };

  // Update handleRefresh to optionally clear cache
  const handleRefresh = (clearCache = false) => {
    // Clear cache on manual refresh if requested
    if (clearCache) {
      // Clear memory cache
      dataCache.current = {};

      // Clear localStorage cache selectively (only for the current instrument)
      if (typeof window !== "undefined") {
        const keysToRemove: string[] = [];

        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (
            key &&
            key.startsWith(LOCALSTORAGE_KEY_PREFIX) &&
            (key.includes(instrument) ||
              (showAllStocks &&
                indexStocks.some((stock) => key.includes(stock.key))))
          ) {
            keysToRemove.push(key);
          }
        }

        keysToRemove.forEach((key) => localStorage.removeItem(key));
        console.log(
          `Cleared ${keysToRemove.length} cached items from localStorage`
        );
      }
    }

    if (showAllStocks) {
      loadAllStocksData();
    } else {
      loadSingleInstrumentData();
    }

    if (onRefresh) {
      onRefresh();
    }
  };

  // Render loading state with improved progress indicator
  const renderLoading = () => (
    <div className="text-center py-8">
      <div className="mb-4 flex items-center justify-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>{loadingProgress.message}</span>
      </div>

      <div className="w-full max-w-md mx-auto mb-2">
        <Progress
          value={(loadingProgress.current / loadingProgress.total) * 100}
          className="h-2"
        />
      </div>

      <div className="text-sm text-gray-500 dark:text-gray-400">
        Progress: {loadingProgress.current} of {loadingProgress.total} (
        {Math.round((loadingProgress.current / loadingProgress.total) * 100)}%)
      </div>
    </div>
  );

  // Render error state with retry button
  const renderError = () => (
    <Alert variant="destructive" className="my-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Error Loading Data</AlertTitle>
      <AlertDescription className="mb-2">
        {error}
        <div className="mt-2 text-sm">
          {showAllStocks
            ? "To prevent API rate limiting, we load data with controlled concurrency. You can try again by clicking the retry button below."
            : "To avoid overwhelming the API server, we're loading data one timeframe at a time. You can try again by clicking the retry button below."}
        </div>
      </AlertDescription>
      <div className="flex justify-end mt-2">
        <Button
          size="sm"
          onClick={() => {
            setError(null);
            if (showAllStocks) {
              loadAllStocksData();
            } else {
              loadSingleInstrumentData();
            }
          }}
        >
          <RefreshCw className="h-3 w-3 mr-2" />
          Retry
        </Button>
      </div>
    </Alert>
  );

  // Render the single instrument timeframe table
  const renderSingleInstrumentTable = () => {
    if (isLoading) {
      return renderLoading();
    }

    if (error) {
      return renderError();
    }

    const instrumentLabel =
      INSTRUMENTS.find((inst) => inst.key === instrument)?.label ||
      "Selected Stock";

    // Get previous day's closing price if available
    const previousDayData = singleStockData["previousDay"];
    const previousDayClose = previousDayData?.closing;

    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Timeframe Data for {instrumentLabel}</CardTitle>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleRefresh(true)}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh (Clear Cache)
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleRefresh(false)}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Time Frame</TableHead>
                  <TableHead>Open</TableHead>
                  <TableHead>High</TableHead>
                  <TableHead>Low</TableHead>
                  <TableHead>Close</TableHead>
                  <TableHead>Change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {timeframes.map((tf) => {
                  // Special handling for "Today" timeframe - use real-time data if available
                  if (tf.id === "currentDay" && hasRealTimeData(instrument)) {
                    const rtData = getRealTimeData(instrument);
                    const dailyOHLC = rtData.dailyOHLC;

                    const data: StatsData = {
                      opening: parseFloat(dailyOHLC.open),
                      highest: parseFloat(dailyOHLC.high),
                      lowest: parseFloat(dailyOHLC.low),
                      closing: rtData.lastPrice || parseFloat(dailyOHLC.close), // Use last price if available
                    };

                    const { changeValue, changePercent } = calculateChangeData(
                      data,
                      previousDayClose
                    );
                    const isPositive = changeValue > 0;
                    const isNegative = changeValue < 0;
                    const changeColorClass = isPositive
                      ? "text-green-600 dark:text-green-400"
                      : isNegative
                      ? "text-red-600 dark:text-red-400"
                      : "text-gray-600 dark:text-gray-400";

                    return (
                      <TableRow key={tf.id}>
                        <TableCell className="font-medium">
                          {tf.title}
                          <Badge
                            variant="outline"
                            className="ml-2 text-green-500 border-green-500 text-xs"
                          >
                            Live
                          </Badge>
                        </TableCell>
                        <TableCell>{data.opening.toFixed(2)}</TableCell>
                        <TableCell>{data.highest.toFixed(2)}</TableCell>
                        <TableCell>{data.lowest.toFixed(2)}</TableCell>
                        <TableCell>{data.closing.toFixed(2)}</TableCell>
                        <TableCell className={changeColorClass}>
                          {isPositive ? "+" : ""}
                          {changeValue.toFixed(2)} ({isPositive ? "+" : ""}
                          {changePercent.toFixed(2)}%)
                        </TableCell>
                      </TableRow>
                    );
                  }

                  const data = singleStockData[tf.id];

                  if (!data) {
                    return (
                      <TableRow key={tf.id}>
                        <TableCell className="font-medium">
                          {tf.title}
                        </TableCell>
                        <TableCell colSpan={5} className="text-gray-500">
                          No data available
                        </TableCell>
                      </TableRow>
                    );
                  }

                  const { changeValue, changePercent } = calculateChangeData(
                    data,
                    previousDayClose
                  );
                  const isPositive = changeValue > 0;
                  const isNegative = changeValue < 0;
                  const changeColorClass = isPositive
                    ? "text-green-600 dark:text-green-400"
                    : isNegative
                    ? "text-red-600 dark:text-red-400"
                    : "text-gray-600 dark:text-gray-400";

                  return (
                    <TableRow key={tf.id}>
                      <TableCell className="font-medium">{tf.title}</TableCell>
                      <TableCell>{data.opening.toFixed(2)}</TableCell>
                      <TableCell>{data.highest.toFixed(2)}</TableCell>
                      <TableCell>{data.lowest.toFixed(2)}</TableCell>
                      <TableCell>{data.closing.toFixed(2)}</TableCell>
                      <TableCell className={changeColorClass}>
                        {isPositive ? "+" : ""}
                        {changeValue.toFixed(2)} ({isPositive ? "+" : ""}
                        {changePercent.toFixed(2)}%)
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Render the all stocks table for a specific timeframe
  const renderAllStocksTable = () => {
    if (isLoading) {
      return renderLoading();
    }

    if (error) {
      return renderError();
    }

    // Filter out stocks with invalid keys
    const sortedStocks = getSortedStocks().filter((stock) =>
      isValidInstrument(stock.key)
    );
    const indexName =
      INSTRUMENTS.find((inst) => inst.key === instrument)?.label || "Index";

    // Helper function to render cell with change data
    const renderChangeCell = (
      data: StatsData | null,
      stockKey: string,
      timeframeId: string
    ) => {
      // Get previous day's closing price if available
      const previousDayData = allStocksData[stockKey]?.["previousDay"];
      const previousDayClose = previousDayData?.closing;

      // Use real-time data for Today timeframe if available
      if (timeframeId === "currentDay") {
        const rtData = getRealTimeData(stockKey);

        if (rtData?.dailyOHLC) {
          const dailyOHLC = rtData.dailyOHLC;

          const realTimeData: StatsData = {
            opening: parseFloat(dailyOHLC.open),
            highest: parseFloat(dailyOHLC.high),
            lowest: parseFloat(dailyOHLC.low),
            closing: rtData.lastPrice || parseFloat(dailyOHLC.close), // Use last price if available
          };

          const { changeValue, changePercent } = calculateChangeData(
            realTimeData,
            previousDayClose
          );
          const isPositive = changeValue > 0;
          const isNegative = changeValue < 0;
          const changeColorClass = isPositive
            ? "text-green-600 dark:text-green-400"
            : isNegative
            ? "text-red-600 dark:text-red-400"
            : "text-gray-600 dark:text-gray-400";

          return (
            <span className={changeColorClass}>
              {isPositive ? "+" : ""}
              {changeValue.toFixed(2)} ({isPositive ? "+" : ""}
              {changePercent.toFixed(2)}%)
            </span>
          );
        }
      }

      if (!data) return <span className="text-gray-500">-</span>;

      const { changeValue, changePercent } = calculateChangeData(
        data,
        previousDayClose
      );
      const isPositive = changeValue > 0;
      const isNegative = changeValue < 0;
      const changeColorClass = isPositive
        ? "text-green-600 dark:text-green-400"
        : isNegative
        ? "text-red-600 dark:text-red-400"
        : "text-gray-600 dark:text-gray-400";

      return (
        <span className={changeColorClass}>
          {isPositive ? "+" : ""}
          {changeValue.toFixed(2)} ({isPositive ? "+" : ""}
          {changePercent.toFixed(2)}%)
        </span>
      );
    };

    // Helper function to render price cell
    const renderPriceCell = (
      data: StatsData | null,
      stockKey: string,
      timeframeId: string
    ) => {
      // Use real-time data for Today timeframe if available
      if (timeframeId === "currentDay") {
        const rtData = getRealTimeData(stockKey);

        if (rtData?.lastPrice || rtData?.dailyOHLC) {
          return rtData.lastPrice
            ? rtData.lastPrice.toFixed(2)
            : parseFloat(rtData.dailyOHLC.close).toFixed(2);
        }
      }

      if (!data) return <span className="text-gray-500">-</span>;
      return data.closing.toFixed(2);
    };

    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>All Timeframes Data</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Showing data for {sortedStocks.length} stocks across all
              timeframes
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleRefresh(true)}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh (Clear Cache)
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleRefresh(false)}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="cursor-pointer sticky left-0 bg-background z-10"
                    onClick={() => handleSort("label")}
                  >
                    Stock
                    {sortColumn === "label" &&
                      (sortDirection === "asc" ? (
                        <ChevronUp className="inline h-4 w-4 ml-1" />
                      ) : (
                        <ChevronDown className="inline h-4 w-4 ml-1" />
                      ))}
                  </TableHead>

                  {/* Generate columns for each timeframe */}
                  {timeframes.map((tf) => (
                    <React.Fragment key={tf.id}>
                      <TableHead
                        className="text-center font-medium bg-muted/20 border-l"
                        colSpan={2}
                      >
                        {tf.title}
                        {tf.id === "currentDay" && isConnected && (
                          <Badge
                            variant="outline"
                            className="ml-2 text-green-500 border-green-500 text-xs"
                          >
                            Live
                          </Badge>
                        )}
                      </TableHead>
                    </React.Fragment>
                  ))}
                </TableRow>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background z-10">
                    Stock
                  </TableHead>

                  {/* Generate columns for each timeframe */}
                  {timeframes.map((tf) => (
                    <React.Fragment key={tf.id}>
                      <TableHead className="border-l bg-muted/5">
                        Close
                      </TableHead>
                      <TableHead>Change %</TableHead>
                    </React.Fragment>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Index row (if available) */}
                {instrument && isValidInstrument(instrument) && (
                  <TableRow className="bg-muted/20">
                    <TableCell className="font-bold sticky left-0 bg-muted/20 z-10">
                      {indexName} (Index)
                      {hasRealTimeData(instrument) && (
                        <Badge
                          variant="outline"
                          className="ml-2 text-green-500 border-green-500 text-xs"
                        >
                          Live
                        </Badge>
                      )}
                    </TableCell>

                    {/* Data for each timeframe */}
                    {timeframes.map((tf) => {
                      const tfData = allStocksData[instrument]?.[tf.id];
                      return (
                        <React.Fragment key={tf.id}>
                          <TableCell className="border-l bg-muted/10">
                            {renderPriceCell(tfData, instrument, tf.id)}
                          </TableCell>
                          <TableCell>
                            {renderChangeCell(tfData, instrument, tf.id)}
                          </TableCell>
                        </React.Fragment>
                      );
                    })}
                  </TableRow>
                )}

                {/* Stock rows */}
                {sortedStocks.map((stock) => {
                  // For highlighting a row with live data
                  const hasRtData = hasRealTimeData(stock.key);

                  return (
                    <TableRow key={stock.key}>
                      <TableCell className="font-medium sticky left-0 bg-background z-10">
                        {stock.label}
                        {hasRtData && (
                          <Badge
                            variant="outline"
                            className="ml-2 text-green-500 border-green-500 text-xs"
                          >
                            Live
                          </Badge>
                        )}
                      </TableCell>

                      {/* Data for each timeframe */}
                      {timeframes.map((tf) => {
                        const tfData = allStocksData[stock.key]?.[tf.id];
                        return (
                          <React.Fragment key={tf.id}>
                            <TableCell className="border-l bg-muted/5">
                              {renderPriceCell(tfData, stock.key, tf.id)}
                            </TableCell>
                            <TableCell>
                              {renderChangeCell(tfData, stock.key, tf.id)}
                            </TableCell>
                          </React.Fragment>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    );
  };

  // Render content based on view mode
  return showAllStocks ? renderAllStocksTable() : renderSingleInstrumentTable();
}
