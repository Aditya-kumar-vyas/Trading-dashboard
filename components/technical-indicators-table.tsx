"use client";

import React, { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { RefreshCw, Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

import { OHLCData, Interval, APIResponse } from "@/app/types";
import { useMarketData } from "./market-data-context";
import { transformCandle } from "@/lib/utils";
import { INSTRUMENTS } from "@/app/constants";

// Interface for props
interface TechnicalIndicatorsTableProps {
  instrument: string;
  interval: Interval;
  refreshTrigger: number;
  onRefresh: () => void;
  isIndex: boolean;
}

// Interface for indicator data
interface IndicatorData extends OHLCData {
  ema9: number;
  ema18: number;
  supertrend: {
    value: number;
    direction: "up" | "down";
  };
}

// ATR Multiplier and Period for Supertrend calculation
const SUPERTREND_MULTIPLIER = 3;
const SUPERTREND_PERIOD = 7;

// Add local storage keys for persistence
const STORAGE_KEY_PREFIX = "technical-indicators-";
const getStorageKey = (instrument: string, interval: Interval) =>
  `${STORAGE_KEY_PREFIX}${instrument}-${interval}`;

export default function TechnicalIndicatorsTable({
  instrument,
  interval,
  refreshTrigger,
  onRefresh,
  isIndex,
}: TechnicalIndicatorsTableProps): JSX.Element {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [indicatorData, setIndicatorData] = useState<IndicatorData[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const { isConnected, marketData } = useMarketData();

  // Reference to store the interval ID for real-time updates
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Store the last minute we processed to detect minute changes
  const lastProcessedMinuteRef = useRef<number>(-1);

  // Flag to indicate if initial data has been loaded
  const initialDataLoadedRef = useRef<boolean>(false);

  // Maximum number of candles to display
  const MAX_CANDLES = 50;

  // Save data to localStorage
  const saveToLocalStorage = (data: IndicatorData[]) => {
    try {
      const storageKey = getStorageKey(instrument, interval);
      localStorage.setItem(storageKey, JSON.stringify(data));
      console.log(`Saved ${data.length} candles to localStorage`);
    } catch (err) {
      console.error("Error saving to localStorage:", err);
    }
  };

  // Load data from localStorage
  const loadFromLocalStorage = (): IndicatorData[] | null => {
    try {
      const storageKey = getStorageKey(instrument, interval);
      const storedData = localStorage.getItem(storageKey);
      if (storedData) {
        const parsedData = JSON.parse(storedData) as IndicatorData[];
        console.log(`Loaded ${parsedData.length} candles from localStorage`);
        return parsedData;
      }
    } catch (err) {
      console.error("Error loading from localStorage:", err);
    }
    return null;
  };

  // Calculate EMA
  const calculateEMA = (data: OHLCData[], period: number): number[] => {
    if (data.length < period) {
      return data.map(() => 0);
    }

    const k = 2 / (period + 1);
    const emaArray: number[] = [];

    // Initialize EMA with SMA for the first period
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += data[i].close;
    }

    let ema = sum / period;
    emaArray.push(ema);

    // Calculate EMA for the rest of the data
    for (let i = period; i < data.length; i++) {
      ema = (data[i].close - ema) * k + ema;
      emaArray.push(ema);
    }

    // Pad the beginning with zeros to match the data length
    const padding = Array(period - 1).fill(0);
    return [...padding, ...emaArray];
  };

  // Calculate ATR (Average True Range)
  const calculateATR = (data: OHLCData[], period: number): number[] => {
    if (data.length < period + 1) {
      return data.map(() => 0);
    }

    const trueRanges: number[] = [];

    // Calculate True Range for each candle
    for (let i = 1; i < data.length; i++) {
      const high = data[i].high;
      const low = data[i].low;
      const prevClose = data[i - 1].close;

      const tr1 = high - low;
      const tr2 = Math.abs(high - prevClose);
      const tr3 = Math.abs(low - prevClose);

      trueRanges.push(Math.max(tr1, tr2, tr3));
    }

    // Calculate ATR using Wilder's smoothing method
    const atrValues: number[] = [];
    let atr =
      trueRanges.slice(0, period).reduce((sum, tr) => sum + tr, 0) / period;
    atrValues.push(atr);

    for (let i = period; i < trueRanges.length; i++) {
      atr = (atr * (period - 1) + trueRanges[i]) / period;
      atrValues.push(atr);
    }

    // Pad the beginning with zeros to match the data length
    const padding = Array(data.length - atrValues.length).fill(0);
    return [...padding, ...atrValues];
  };

  // Calculate Supertrend
  const calculateSupertrend = (
    data: OHLCData[],
    period: number,
    multiplier: number
  ): { value: number; direction: "up" | "down" }[] => {
    if (data.length < period + 1) {
      return data.map(() => ({ value: 0, direction: "up" }));
    }

    const atr = calculateATR(data, period);
    const supertrendData: { value: number; direction: "up" | "down" }[] = [];

    // Initial values
    let upperBand = 0;
    let lowerBand = 0;
    let supertrend = 0;
    let prevDirection: "up" | "down" = "up";

    // Pad beginning with zeros
    for (let i = 0; i < period; i++) {
      supertrendData.push({ value: 0, direction: "up" });
    }

    // Calculate Supertrend
    for (let i = period; i < data.length; i++) {
      const hl2 = (data[i].high + data[i].low) / 2;
      const currentATR = atr[i];

      upperBand = hl2 + multiplier * currentATR;
      lowerBand = hl2 - multiplier * currentATR;

      // Adjust bands based on previous values
      if (i > period) {
        const prevUpperBand =
          supertrendData[i - 1].direction === "down"
            ? Math.min(upperBand, supertrendData[i - 1].value)
            : upperBand;

        const prevLowerBand =
          supertrendData[i - 1].direction === "up"
            ? Math.max(lowerBand, supertrendData[i - 1].value)
            : lowerBand;

        upperBand = prevUpperBand;
        lowerBand = prevLowerBand;
      }

      // Determine current trend direction
      let direction: "up" | "down";

      if (i === period) {
        direction = data[i].close <= upperBand ? "down" : "up";
        supertrend = direction === "up" ? lowerBand : upperBand;
      } else {
        prevDirection = supertrendData[i - 1].direction;

        if (prevDirection === "down" && data[i].close > upperBand) {
          direction = "up";
          supertrend = lowerBand;
        } else if (prevDirection === "up" && data[i].close < lowerBand) {
          direction = "down";
          supertrend = upperBand;
        } else {
          direction = prevDirection;
          supertrend = direction === "up" ? lowerBand : upperBand;
        }
      }

      supertrendData.push({ value: supertrend, direction });
    }

    return supertrendData;
  };

  // Combine raw OHLC data with calculated indicators
  const processData = (rawData: OHLCData[]): IndicatorData[] => {
    // Sort data by timestamp in ascending order (oldest first)
    const sortedData = [...rawData].sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Calculate indicators
    const ema9Values = calculateEMA(sortedData, 9);
    const ema18Values = calculateEMA(sortedData, 18);
    const supertrendValues = calculateSupertrend(
      sortedData,
      SUPERTREND_PERIOD,
      SUPERTREND_MULTIPLIER
    );

    // Combine data
    const processedData: IndicatorData[] = sortedData.map((candle, index) => ({
      ...candle,
      ema9: ema9Values[index],
      ema18: ema18Values[index],
      supertrend: supertrendValues[index],
    }));

    // Limit to last MAX_CANDLES
    return processedData.slice(-MAX_CANDLES);
  };

  // Initialize with a single candle at current time
  const initializeWithCurrentPrice = () => {
    const rtData =
      marketData[instrument] || marketData[`NSE_INDEX|${instrument}`];

    if (!rtData || !rtData.lastPrice) return [];

    // Try to load existing data from localStorage first
    const storedData = loadFromLocalStorage();
    if (storedData && storedData.length > 0) {
      console.log("Using stored data for initialization");
      lastProcessedMinuteRef.current = new Date(
        storedData[storedData.length - 1].timestamp
      ).getMinutes();
      return storedData;
    }

    const now = new Date();

    // Create initial candle with current price
    const initialCandle: OHLCData = {
      timestamp: now.toISOString(),
      open: rtData.lastPrice,
      high: rtData.lastPrice,
      low: rtData.lastPrice,
      close: rtData.lastPrice,
    };

    // Set the last processed minute
    lastProcessedMinuteRef.current = now.getMinutes();

    // Return processed data with indicators
    return processData([initialCandle]);
  };

  // Fetch historical data
  const fetchHistoricalData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Check if the instrument is an index
      if (!isIndex) {
        setError("This view is only available for index instruments.");
        setIsLoading(false);
        return;
      }

      // Check localStorage first
      const storedData = loadFromLocalStorage();
      if (storedData && storedData.length > 0) {
        // Verify if stored data is recent enough (within last hour)
        const lastCandleTime = new Date(
          storedData[storedData.length - 1].timestamp
        );
        const now = new Date();
        const timeDiffMinutes =
          (now.getTime() - lastCandleTime.getTime()) / (1000 * 60);

        if (timeDiffMinutes < 60) {
          console.log("Using recent stored data");
          setIndicatorData(storedData);
          setLastUpdated(new Date().toLocaleTimeString());
          setIsLoading(false);
          initialDataLoadedRef.current = true;

          // Update lastProcessedMinuteRef to match the last candle
          lastProcessedMinuteRef.current = lastCandleTime.getMinutes();
          return;
        }
      }

      // If we're using minute interval and real-time data is available, we can just start with current data
      if ((interval === "minute" || interval === "1minute") && isConnected) {
        const initialData = initializeWithCurrentPrice();
        if (initialData.length > 0) {
          setIndicatorData(initialData);
          setLastUpdated(new Date().toLocaleTimeString());
          setIsLoading(false);
          initialDataLoadedRef.current = true;
          saveToLocalStorage(initialData); // Save to localStorage
          return;
        }
      }

      // Otherwise, get data for the last 60 days to ensure we have enough for calculations
      // This is useful for other timeframes or if real-time data isn't available
      const today = new Date();
      const pastDate = new Date();
      pastDate.setDate(today.getDate() - 60);

      const formattedToDate = format(today, "yyyy-MM-dd");
      const formattedFromDate = format(pastDate, "yyyy-MM-dd");

      // Fetch data
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
        const processedData = processData(candles);

        setIndicatorData(processedData);
        setLastUpdated(new Date().toLocaleTimeString());
        initialDataLoadedRef.current = true;
        saveToLocalStorage(processedData); // Save to localStorage
      } else {
        setError("No data available for the selected instrument and interval.");
      }
    } catch (err) {
      console.error("Error fetching historical data:", err);
      setError("Failed to load data. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  // Update data with real-time information
  const updateWithRealTimeData = () => {
    // Only update if we have existing data or if we're in minute mode and just starting
    const shouldInitialize =
      !initialDataLoadedRef.current &&
      (interval === "minute" || interval === "1minute") &&
      isConnected;

    if (indicatorData.length === 0 && !shouldInitialize) return;

    // Check if real-time data is available
    const rtData =
      marketData[instrument] || marketData[`NSE_INDEX|${instrument}`];

    if (!rtData || !rtData.lastPrice) return;

    // If we need to initialize with first data point
    if (shouldInitialize) {
      const initialData = initializeWithCurrentPrice();
      if (initialData.length > 0) {
        setIndicatorData(initialData);
        setLastUpdated(new Date().toLocaleTimeString());
        initialDataLoadedRef.current = true;
        saveToLocalStorage(initialData); // Save to localStorage
        return;
      }
    }

    // Get current minute
    const now = new Date();
    const currentMinute = now.getMinutes();

    // If we're in 1-minute mode and the minute has changed, add a new candle
    if (
      (interval === "minute" || interval === "1minute") &&
      currentMinute !== lastProcessedMinuteRef.current &&
      lastProcessedMinuteRef.current !== -1
    ) {
      console.log(
        `Creating new candle: current minute ${currentMinute}, last processed ${lastProcessedMinuteRef.current}`
      );

      // Create a copy of existing data
      let updatedData = [...indicatorData];

      // Check for gap minutes (skipped minutes)
      // This handles cases where update didn't run for a few minutes
      const minuteDiff =
        (currentMinute - lastProcessedMinuteRef.current + 60) % 60;

      // Add candles for all skipped minutes
      if (minuteDiff > 1) {
        console.log(
          `Detected gap of ${minuteDiff} minutes, filling missing candles`
        );

        // Create a candle for each missed minute
        for (let i = 1; i < minuteDiff; i++) {
          const missedMinute = (lastProcessedMinuteRef.current + i) % 60;
          const missedTime = new Date(now);
          // If we've wrapped around to a new hour
          if (missedMinute < lastProcessedMinuteRef.current) {
            missedTime.setHours(missedTime.getHours() - 1);
          }
          missedTime.setMinutes(missedMinute);
          missedTime.setSeconds(0);
          missedTime.setMilliseconds(0);

          // Use the last known price for the missed candle
          const lastCandle = updatedData[updatedData.length - 1];
          const missedCandle: OHLCData = {
            timestamp: missedTime.toISOString(),
            open: lastCandle.close,
            high: lastCandle.close,
            low: lastCandle.close,
            close: lastCandle.close,
          };

          // Extract just OHLC data from all candles to prepare for reprocessing
          const ohlcData: OHLCData[] = updatedData.map((item) => ({
            timestamp: item.timestamp,
            open: item.open,
            high: item.high,
            low: item.low,
            close: item.close,
          }));

          // Add the missed candle
          ohlcData.push(missedCandle);

          // If we exceed MAX_CANDLES, remove the oldest
          if (ohlcData.length > MAX_CANDLES) {
            ohlcData.shift();
          }

          // Recalculate all indicators with the new data
          updatedData = processData(ohlcData);
        }
      }

      // Now add the current minute's candle
      const newCandle: OHLCData = {
        timestamp: now.toISOString(),
        open: rtData.lastPrice,
        high: rtData.lastPrice,
        low: rtData.lastPrice,
        close: rtData.lastPrice,
      };

      // Extract OHLC data from existing indicator data
      const ohlcData: OHLCData[] = updatedData.map((item) => ({
        timestamp: item.timestamp,
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
      }));

      // Add the new candle
      ohlcData.push(newCandle);

      // If we exceed MAX_CANDLES, remove the oldest
      if (ohlcData.length > MAX_CANDLES) {
        ohlcData.shift();
      }

      // Process data to recalculate indicators
      const processedData = processData(ohlcData);

      // Update state
      setIndicatorData(processedData);
      setLastUpdated(now.toLocaleTimeString());
      saveToLocalStorage(processedData); // Save to localStorage

      // Update the last processed minute
      lastProcessedMinuteRef.current = currentMinute;
      console.log(`Updated last processed minute to ${currentMinute}`);
    }
    // Otherwise just update the latest candle's high, low and close
    else if (indicatorData.length > 0) {
      // Get the latest candle
      const lastCandle = indicatorData[indicatorData.length - 1];

      // Extract OHLC data from existing indicator data
      const ohlcData: OHLCData[] = indicatorData.map((item) => ({
        timestamp: item.timestamp,
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
      }));

      // Update the last candle with new price info
      ohlcData[ohlcData.length - 1] = {
        ...ohlcData[ohlcData.length - 1],
        high: Math.max(lastCandle.high, rtData.lastPrice),
        low: Math.min(lastCandle.low, rtData.lastPrice),
        close: rtData.lastPrice,
      };

      // Process data to recalculate indicators
      const processedData = processData(ohlcData);

      // Update state
      setIndicatorData(processedData);
      setLastUpdated(now.toLocaleTimeString());
      saveToLocalStorage(processedData); // Save to localStorage
    }
  };

  // Fetch data when component mounts or dependencies change
  useEffect(() => {
    // Reset state when instrument or interval changes
    initialDataLoadedRef.current = false;
    lastProcessedMinuteRef.current = -1;

    fetchHistoricalData();

    // Clean up any existing interval
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
    }

    // Set up interval for real-time updates - check more frequently (every second)
    // but only create new candles when the minute changes
    updateIntervalRef.current = setInterval(() => {
      if (isConnected) {
        updateWithRealTimeData();
      }
    }, 1000); // Update every second for smoother real-time experience

    // Clean up on unmount
    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, [instrument, interval, refreshTrigger, isConnected]);

  // Format timestamp based on interval
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);

    if (
      interval === "minute" ||
      interval === "1minute" ||
      interval === "5minute"
    ) {
      return format(date, "HH:mm:ss");
    } else if (interval === "day") {
      return format(date, "dd MMM yyyy");
    } else {
      return format(date, "dd MMM yyyy HH:mm");
    }
  };

  // Render loading state
  const renderLoading = () => (
    <div className="text-center py-8">
      <div className="mb-4 flex items-center justify-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Loading technical indicators...</span>
      </div>
      <Progress value={50} className="h-2 max-w-md mx-auto" />
    </div>
  );

  // Render error state
  const renderError = () => (
    <Alert variant="destructive" className="my-4">
      <AlertTitle>Error Loading Data</AlertTitle>
      <AlertDescription className="mb-2">{error}</AlertDescription>
      <div className="flex justify-end mt-2">
        <Button size="sm" onClick={fetchHistoricalData}>
          <RefreshCw className="h-3 w-3 mr-2" />
          Retry
        </Button>
      </div>
    </Alert>
  );

  // Get instrument label
  const instrumentLabel =
    INSTRUMENTS.find((inst) => inst.key === instrument)?.label ||
    "Selected Index";

  // Render table with data
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Technical Indicators for {instrumentLabel}</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Showing last {indicatorData.length} candles with EMA-9, EMA-18, and
            Supertrend
            {lastUpdated && ` (Last updated: ${lastUpdated})`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              localStorage.removeItem(getStorageKey(instrument, interval));
              fetchHistoricalData();
            }}
            disabled={isLoading}
          >
            Reset Data
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          renderLoading()
        ) : error ? (
          renderError()
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="whitespace-nowrap">Time</TableHead>
                  <TableHead>Open</TableHead>
                  <TableHead>High</TableHead>
                  <TableHead>Low</TableHead>
                  <TableHead>Close</TableHead>
                  <TableHead>EMA-9</TableHead>
                  <TableHead>EMA-18</TableHead>
                  <TableHead>Supertrend</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {indicatorData.map((item, index) => {
                  const isBullish = item.supertrend.direction === "up";
                  const isBearish = item.supertrend.direction === "down";
                  const priceGoingUp =
                    index > 0 && item.close > indicatorData[index - 1].close;
                  const priceGoingDown =
                    index > 0 && item.close < indicatorData[index - 1].close;

                  return (
                    <TableRow key={item.timestamp}>
                      <TableCell className="whitespace-nowrap font-medium">
                        {formatTimestamp(item.timestamp)}
                      </TableCell>
                      <TableCell>{item.open.toFixed(2)}</TableCell>
                      <TableCell>{item.high.toFixed(2)}</TableCell>
                      <TableCell>{item.low.toFixed(2)}</TableCell>
                      <TableCell
                        className={
                          priceGoingUp
                            ? "text-green-600 dark:text-green-400"
                            : priceGoingDown
                            ? "text-red-600 dark:text-red-400"
                            : ""
                        }
                      >
                        {item.close.toFixed(2)}
                      </TableCell>
                      <TableCell>{item.ema9.toFixed(2)}</TableCell>
                      <TableCell>{item.ema18.toFixed(2)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span
                            className={
                              isBullish
                                ? "text-green-600 dark:text-green-400"
                                : "text-red-600 dark:text-red-400"
                            }
                          >
                            {item.supertrend.value.toFixed(2)}
                          </span>
                          <Badge
                            variant={isBullish ? "success" : "destructive"}
                          >
                            {isBullish ? "Bullish" : "Bearish"}
                          </Badge>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
