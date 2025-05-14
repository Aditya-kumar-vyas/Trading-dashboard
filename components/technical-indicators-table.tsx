// "use client";

// import React, { useState, useEffect, useRef } from "react";
// import { format } from "date-fns";
// import {
//   RefreshCw,
//   Loader2,
//   ArrowUp,
//   ArrowDown,
//   AlertTriangle,
//   CheckCircle,
//   Clock,
//   Activity,
// } from "lucide-react";
// import {
//   Table,
//   TableBody,
//   TableCell,
//   TableHead,
//   TableHeader,
//   TableRow,
// } from "@/components/ui/table";
// import { Button } from "@/components/ui/button";
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
// import { Badge } from "@/components/ui/badge";
// import { Progress } from "@/components/ui/progress";
// import {
//   Tooltip,
//   TooltipContent,
//   TooltipProvider,
//   TooltipTrigger,
// } from "@/components/ui/tooltip";

// import { OHLCData, Interval, APIResponse } from "@/app/types";
// import { useMarketData } from "./market-data-context";
// import { transformCandle } from "@/lib/utils";
// import { INSTRUMENTS } from "@/app/constants";

// // Interface for props
// interface TechnicalIndicatorsTableProps {
//   instrument: string;
//   interval: Interval;
//   refreshTrigger: number;
//   onRefresh: () => void;
//   isIndex: boolean;
// }

// // Signal type definition
// type SignalType = "BUY" | "SELL" | "NEUTRAL";

// // Interface for indicator data
// interface IndicatorData extends OHLCData {
//   ema9: number;
//   ema18: number;
//   supertrend: {
//     value: number;
//     direction: "up" | "down";
//   };
//   signal?: SignalType;
//   isNewSignal?: boolean; // Flag to indicate if this is a new signal
// }

// // New interface for current candle tracking
// interface InProgressCandle extends OHLCData {
//   updates: number; // Count of price updates received
//   lastUpdateTime: string; // Timestamp of last update
// }

// // Debug status type
// type DebugStatus = {
//   connectionState: "connected" | "disconnected" | "stale";
//   lastPrice: number | null;
//   lastUpdateTime: string | null;
//   updatesThisMinute: number;
//   currentCandle: InProgressCandle | null;
//   dataHealthy: boolean;
//   message: string;
// };

// // ATR Multiplier and Period for Supertrend calculation
// const SUPERTREND_MULTIPLIER = 3;
// const SUPERTREND_PERIOD = 7;

// // Fixed number of candles to display
// const MAX_CANDLES = 100;

// // Data health thresholds
// const STALE_DATA_THRESHOLD_SECONDS = 5;
// const DEBUG_LOG_ENABLED = true;

// // Add local storage keys for persistence
// const STORAGE_KEY_PREFIX = "technical-indicators-";
// const getStorageKey = (instrument: string, interval: Interval) =>
//   `${STORAGE_KEY_PREFIX}${instrument}-${interval}`;

// export default function TechnicalIndicatorsTable({
//   instrument,
//   interval,
//   refreshTrigger,
//   onRefresh,
//   isIndex,
// }: TechnicalIndicatorsTableProps): JSX.Element {
//   const [isLoading, setIsLoading] = useState<boolean>(true);
//   const [error, setError] = useState<string | null>(null);
//   const [indicatorData, setIndicatorData] = useState<IndicatorData[]>([]);
//   const [lastUpdated, setLastUpdated] = useState<string>("");
//   const [isRealTimeMode, setIsRealTimeMode] = useState<boolean>(false);
//   const { isConnected, marketData, subscribeToInstruments } = useMarketData();

//   // New debug state
//   const [debugStatus, setDebugStatus] = useState<DebugStatus>({
//     connectionState: "disconnected",
//     lastPrice: null,
//     lastUpdateTime: null,
//     updatesThisMinute: 0,
//     currentCandle: null,
//     dataHealthy: false,
//     message: "Initializing...",
//   });

//   // Reference to store the interval ID for real-time updates
//   const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
//   const debugIntervalRef = useRef<NodeJS.Timeout | null>(null);

//   // Store the last minute we processed to detect minute changes
//   const lastProcessedMinuteRef = useRef<number>(-1);

//   // Flag to indicate if initial data has been loaded
//   const initialDataLoadedRef = useRef<boolean>(false);

//   // Add a ref to always have the latest indicatorData
//   const indicatorDataRef = useRef<IndicatorData[]>([]);

//   // New ref for tracking current candle being built
//   const currentCandleRef = useRef<InProgressCandle | null>(null);

//   // Track market data updates
//   const lastDataUpdateTimeRef = useRef<number>(Date.now());
//   const priceUpdatesCountRef = useRef<number>(0);

//   // Helper function for debug logging
//   const debugLog = (message: string, data?: any) => {
//     if (DEBUG_LOG_ENABLED) {
//       if (data) {
//         console.log(`[TechnicalIndicators] ${message}`, data);
//       } else {
//         console.log(`[TechnicalIndicators] ${message}`);
//       }
//     }
//   };

//   // Update the ref whenever indicatorData changes
//   useEffect(() => {
//     indicatorDataRef.current = indicatorData;
//   }, [indicatorData]);

//   // Save data to localStorage
//   const saveToLocalStorage = (data: IndicatorData[]) => {
//     try {
//       if (!data || data.length === 0) {
//         debugLog("Not saving empty data to localStorage.");
//         return;
//       }
//       // Ensure we only store MAX_CANDLES
//       const dataToStore = data.slice(-MAX_CANDLES);
//       const storageKey = getStorageKey(instrument, interval);
//       localStorage.setItem(storageKey, JSON.stringify(dataToStore));
//       debugLog(
//         `Saved ${dataToStore.length} candles to localStorage: ${storageKey}`
//       );
//     } catch (err) {
//       console.error("Error saving to localStorage:", err);
//     }
//   };

//   // Load data from localStorage
//   const loadFromLocalStorage = (): IndicatorData[] | null => {
//     try {
//       const storageKey = getStorageKey(instrument, interval);
//       const storedData = localStorage.getItem(storageKey);
//       if (storedData) {
//         const parsedData = JSON.parse(storedData) as IndicatorData[];
//         debugLog(
//           `Loaded ${parsedData.length} candles from localStorage: ${storageKey}`
//         );
//         return parsedData;
//       }
//     } catch (err) {
//       console.error("Error loading from localStorage:", err);
//     }
//     return null;
//   };

//   // Calculate EMA
//   const calculateEMA = (data: OHLCData[], period: number): number[] => {
//     if (data.length < period) {
//       return data.map(() => 0);
//     }

//     const k = 2 / (period + 1);
//     const emaArray: number[] = [];

//     // Initialize EMA with SMA for the first period
//     let sum = 0;
//     for (let i = 0; i < period; i++) {
//       sum += data[i].close;
//     }

//     let ema = sum / period;
//     emaArray.push(ema);

//     // Calculate EMA for the rest of the data
//     for (let i = period; i < data.length; i++) {
//       ema = (data[i].close - ema) * k + ema;
//       emaArray.push(ema);
//     }

//     // Pad the beginning with zeros to match the data length
//     const padding = Array(period - 1).fill(0);
//     return [...padding, ...emaArray];
//   };

//   // Calculate ATR (Average True Range)
//   const calculateATR = (data: OHLCData[], period: number): number[] => {
//     if (data.length < period + 1) {
//       return data.map(() => 0);
//     }

//     const trueRanges: number[] = [];

//     // Calculate True Range for each candle
//     for (let i = 1; i < data.length; i++) {
//       const high = data[i].high;
//       const low = data[i].low;
//       const prevClose = data[i - 1].close;

//       const tr1 = high - low;
//       const tr2 = Math.abs(high - prevClose);
//       const tr3 = Math.abs(low - prevClose);

//       trueRanges.push(Math.max(tr1, tr2, tr3));
//     }

//     // Calculate ATR using Wilder's smoothing method
//     const atrValues: number[] = [];
//     let atr =
//       trueRanges.slice(0, period).reduce((sum, tr) => sum + tr, 0) / period;
//     atrValues.push(atr);

//     for (let i = period; i < trueRanges.length; i++) {
//       atr = (atr * (period - 1) + trueRanges[i]) / period;
//       atrValues.push(atr);
//     }

//     // Pad the beginning with zeros to match the data length
//     const padding = Array(data.length - atrValues.length).fill(0);
//     return [...padding, ...atrValues];
//   };

//   // Calculate Supertrend
//   const calculateSupertrend = (
//     data: OHLCData[],
//     period: number,
//     multiplier: number
//   ): { value: number; direction: "up" | "down" }[] => {
//     if (data.length < period + 1) {
//       return data.map(() => ({ value: 0, direction: "up" }));
//     }

//     const atr = calculateATR(data, period);
//     const supertrendData: { value: number; direction: "up" | "down" }[] = [];

//     // Initial values
//     let upperBand = 0;
//     let lowerBand = 0;
//     let supertrend = 0;
//     let prevDirection: "up" | "down" = "up";

//     // Pad beginning with zeros
//     for (let i = 0; i < period; i++) {
//       supertrendData.push({ value: 0, direction: "up" });
//     }

//     // Calculate Supertrend
//     for (let i = period; i < data.length; i++) {
//       const hl2 = (data[i].high + data[i].low) / 2;
//       const currentATR = atr[i];

//       upperBand = hl2 + multiplier * currentATR;
//       lowerBand = hl2 - multiplier * currentATR;

//       // Adjust bands based on previous values
//       if (i > period) {
//         const prevUpperBand =
//           supertrendData[i - 1].direction === "down"
//             ? Math.min(upperBand, supertrendData[i - 1].value)
//             : upperBand;

//         const prevLowerBand =
//           supertrendData[i - 1].direction === "up"
//             ? Math.max(lowerBand, supertrendData[i - 1].value)
//             : lowerBand;

//         upperBand = prevUpperBand;
//         lowerBand = prevLowerBand;
//       }

//       // Determine current trend direction
//       let direction: "up" | "down";

//       if (i === period) {
//         direction = data[i].close <= upperBand ? "down" : "up";
//         supertrend = direction === "up" ? lowerBand : upperBand;
//       } else {
//         prevDirection = supertrendData[i - 1].direction;

//         if (prevDirection === "down" && data[i].close > upperBand) {
//           direction = "up";
//           supertrend = lowerBand;
//         } else if (prevDirection === "up" && data[i].close < lowerBand) {
//           direction = "down";
//           supertrend = upperBand;
//         } else {
//           direction = prevDirection;
//           supertrend = direction === "up" ? lowerBand : upperBand;
//         }
//       }

//       supertrendData.push({ value: supertrend, direction });
//     }

//     return supertrendData;
//   };

//   // Calculate buy and sell signals based on custom conditions
//   const calculateSignals = (data: IndicatorData[]): IndicatorData[] => {
//     if (data.length < 3) {
//       return data.map((candle) => ({
//         ...candle,
//         signal: "NEUTRAL" as SignalType,
//         isNewSignal: false,
//       }));
//     }

//     // First pass to compute signals without the "isNewSignal" flag
//     const withSignals = data.map((candle, index) => {
//       // First two candles cannot generate signals (need previous data)
//       if (index < 2) {
//         return {
//           ...candle,
//           signal: "NEUTRAL" as SignalType,
//           isNewSignal: false,
//         };
//       }

//       const current = candle;
//       const prev = data[index - 1];
//       const prevPrev = data[index - 2];

//       // The percentage threshold 0.005%
//       const threshold = 0.00005; // 0.05% (0.0005 as decimal)

//       // SELL conditions
//       const sellCondition1 =
//         current.high <= prev.high - current.close * threshold;
//       const sellCondition2 =
//         current.low <= prev.low - current.close * threshold;
//       const sellCondition3 =
//         current.close <= prev.high + current.close * threshold;
//       const sellCondition4 = current.close < current.open;
//       const sellCondition5 = current.low < prevPrev.low;
//       const sellCondition6 = current.close <= current.ema18;
//       const sellCondition7 =
//         (current.ema9 - current.ema18) / current.close <= -threshold;

//       // BUY conditions
//       const buyCondition1 =
//         current.high > prev.high + current.close * threshold;
//       const buyCondition2 = current.low >= prev.low - current.close * threshold;
//       const buyCondition3 =
//         current.close >= prev.high + current.close * threshold;
//       const buyCondition4 = current.open <= current.close;
//       const buyCondition5 = current.high > prevPrev.high;
//       const buyCondition6 = current.close > current.ema18;
//       const buyCondition7 =
//         (current.ema9 - current.ema18) / current.close >= threshold;

//       // Debug logging for latest candle
//       if (index === data.length - 1) {
//         debugLog("Latest candle SELL conditions:", {
//           sellCondition1,
//           sellCondition2,
//           sellCondition3,
//           sellCondition4,
//           sellCondition5,
//           sellCondition6,
//           sellCondition7,
//           high: current.high,
//           prevHigh: prev.high,
//           threshold: current.close * threshold,
//         });

//         debugLog("Latest candle BUY conditions:", {
//           buyCondition1,
//           buyCondition2,
//           buyCondition3,
//           buyCondition4,
//           buyCondition5,
//           buyCondition6,
//           buyCondition7,
//           high: current.high,
//           prevHigh: prev.high,
//           threshold: current.close * threshold,
//         });
//       }

//       // Determine signal based on conditions
//       let signal: SignalType = "NEUTRAL";

//       if (
//         sellCondition1 &&
//         sellCondition2 &&
//         sellCondition3 &&
//         sellCondition4 &&
//         sellCondition5 &&
//         sellCondition6 &&
//         sellCondition7
//       ) {
//         signal = "SELL";
//       } else if (
//         buyCondition1 &&
//         buyCondition2 &&
//         buyCondition3 &&
//         buyCondition4 &&
//         buyCondition5 &&
//         buyCondition6 &&
//         buyCondition7
//       ) {
//         signal = "BUY";
//       }

//       return {
//         ...candle,
//         signal,
//         isNewSignal: false, // Will be updated in second pass
//       };
//     });

//     // Second pass to compute the "isNewSignal" flag
//     return withSignals.map((candle, index) => {
//       // First candle or neutral signal is never a new signal
//       if (index === 0 || candle.signal === "NEUTRAL") {
//         return candle; // Already has isNewSignal: false
//       }

//       // A signal is new if it's different from the previous candle's signal
//       const isNewSignal = candle.signal !== withSignals[index - 1].signal;

//       return {
//         ...candle,
//         isNewSignal,
//       };
//     });
//   };

//   // Combine raw OHLC data with calculated indicators and signals
//   const processData = (rawData: OHLCData[]): IndicatorData[] => {
//     if (!rawData || rawData.length === 0) {
//       debugLog("No data to process");
//       return [];
//     }

//     debugLog(`Processing ${rawData.length} candles`);

//     // Sort data by timestamp in ascending order (oldest first)
//     const sortedData = [...rawData].sort(
//       (a, b) =>
//         new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
//     );

//     // Calculate indicators
//     const ema9Values = calculateEMA(sortedData, 9);
//     const ema18Values = calculateEMA(sortedData, 18);
//     const supertrendValues = calculateSupertrend(
//       sortedData,
//       SUPERTREND_PERIOD,
//       SUPERTREND_MULTIPLIER
//     );

//     // Combine data with indicators
//     const dataWithIndicators: IndicatorData[] = sortedData.map(
//       (candle, index) => ({
//         ...candle,
//         ema9: ema9Values[index],
//         ema18: ema18Values[index],
//         supertrend: supertrendValues[index],
//       })
//     );

//     // Add signals
//     const dataWithSignals = calculateSignals(dataWithIndicators);

//     // Limit to last MAX_CANDLES
//     return dataWithSignals.slice(-MAX_CANDLES);
//   };

//   // Check if market is open
//   const isMarketOpen = () => {
//     const now = new Date();
//     const day = now.getDay();
//     const hours = now.getHours();
//     const minutes = now.getMinutes();

//     // Weekends are closed (0 = Sunday, 6 = Saturday)
//     if (day === 0 || day === 6) return false;

//     // Market hours (assuming 9:15 AM to 3:30 PM for NSE)
//     const marketStart = 9 * 60 + 15; // 9:15 AM in minutes
//     const marketEnd = 15 * 60 + 30; // 3:30 PM in minutes
//     const currentTime = hours * 60 + minutes;

//     return currentTime >= marketStart && currentTime <= marketEnd;
//   };

//   // Helper function to initialize current candle
//   const initializeCurrentCandle = (time: Date, price: number) => {
//     currentCandleRef.current = {
//       timestamp: time.toISOString(),
//       open: price,
//       high: price,
//       low: price,
//       close: price,
//       updates: 1,
//       lastUpdateTime: time.toISOString(),
//     };
//     debugLog("Initialized current candle", currentCandleRef.current);
//   };

//   // Initialize with a single candle at current time
//   const initializeWithCurrentPrice = () => {
//     const rtData =
//       marketData[instrument] || marketData[`NSE_INDEX|${instrument}`];

//     if (!rtData || !rtData.lastPrice) {
//       debugLog("No real-time data available for initialization");
//       return [];
//     }

//     // Try to load existing data from localStorage first
//     const storedData = loadFromLocalStorage();
//     if (storedData && storedData.length > 0) {
//       debugLog("Using stored data for initialization");

//       // Check if stored data is fresh (from the current trading session)
//       const lastCandleTime = new Date(
//         storedData[storedData.length - 1].timestamp
//       );
//       const now = new Date();
//       const timeDiff = (now.getTime() - lastCandleTime.getTime()) / (1000 * 60); // Diff in minutes

//       // If stored data is from previous day or too old (> 60 min), start fresh
//       if (timeDiff > 60 || lastCandleTime.getDate() !== now.getDate()) {
//         debugLog("Stored data too old, creating new data");

//         // Create a new candle with current price
//         const initialCandle: OHLCData = {
//           timestamp: now.toISOString(),
//           open: rtData.lastPrice,
//           high: rtData.lastPrice,
//           low: rtData.lastPrice,
//           close: rtData.lastPrice,
//         };

//         // Initialize current candle for ongoing updates
//         initializeCurrentCandle(now, rtData.lastPrice);

//         // Set the last processed minute
//         lastProcessedMinuteRef.current = now.getMinutes();

//         // Return processed data with indicators
//         return processData([initialCandle]);
//       }

//       // Update last processed minute to match the last candle
//       lastProcessedMinuteRef.current = lastCandleTime.getMinutes();

//       // Initialize current candle for ongoing updates

//       initializeCurrentCandle(now, rtData.lastPrice);

//       return storedData;
//     }

//     const now = new Date();

//     // Create initial candle with current price
//     const initialCandle: OHLCData = {
//       timestamp: now.toISOString(),
//       open: rtData.lastPrice,
//       high: rtData.lastPrice,
//       low: rtData.lastPrice,
//       close: rtData.lastPrice,
//     };

//     // Initialize current candle for ongoing updates
//     initializeCurrentCandle(now, rtData.lastPrice);

//     // Set the last processed minute
//     lastProcessedMinuteRef.current = now.getMinutes();

//     // Return processed data with indicators
//     return processData([initialCandle]);
//   };

//   // Fetch historical data
//   const fetchHistoricalData = async () => {
//     setIsLoading(true);
//     setError(null);

//     try {
//       // When interval is 1minute or minute, prioritize real-time data immediately
//       if ((interval === "minute" || interval === "1minute") && isConnected) {
//         const initialData = initializeWithCurrentPrice();
//         if (initialData && initialData.length > 0) {
//           setIndicatorData(initialData);
//           setLastUpdated(new Date().toLocaleTimeString());
//           setIsLoading(false);
//           initialDataLoadedRef.current = true;
//           saveToLocalStorage(initialData); // Save to localStorage
//           return;
//         }
//       }

//       // For other cases, try to get data from API
//       // Check if the instrument is an index
//       if (!isIndex) {
//         setError("This view is only available for index instruments.");
//         setIsLoading(false);
//         return;
//       }

//       // Otherwise, get data for the last 60 days to ensure we have enough for calculations
//       const today = new Date();
//       const pastDate = new Date();
//       pastDate.setDate(today.getDate() - 60);

//       const formattedToDate = format(today, "yyyy-MM-dd");
//       const formattedFromDate = format(pastDate, "yyyy-MM-dd");

//       // Fetch data
//       debugLog(
//         `Fetching historical data for ${instrument} interval ${interval}`
//       );
//       const response = await fetch(
//         `/api/historical-data?instrument=${encodeURIComponent(
//           instrument
//         )}&interval=${interval}&to_date=${formattedToDate}&from_date=${formattedFromDate}`
//       );

//       if (!response.ok) {
//         throw new Error(`HTTP error! Status: ${response.status}`);
//       }

//       const result: APIResponse = await response.json();

//       if (
//         result.status === "success" &&
//         result.data.candles &&
//         result.data.candles.length > 0
//       ) {
//         const candles = result.data.candles.map(transformCandle);
//         debugLog(`Received ${candles.length} historical candles`);

//         const processedData = processData(candles);

//         setIndicatorData(processedData);
//         setLastUpdated(new Date().toLocaleTimeString());
//         initialDataLoadedRef.current = true;
//         saveToLocalStorage(processedData); // Save to localStorage

//         // Initialize current candle with latest price if in real-time mode
//         if (isRealTimeMode) {
//           const rtData =
//             marketData[instrument] || marketData[`NSE_INDEX|${instrument}`];
//           if (rtData && rtData.lastPrice) {
//             initializeCurrentCandle(new Date(), rtData.lastPrice);
//           }
//         }
//       } else {
//         setError("No data available for the selected instrument and interval.");
//       }
//     } catch (err) {
//       console.error("Error fetching historical data:", err);
//       setError("Failed to load data. Please try again later.");
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   // Enhanced update with real-time data function
//   // Update the updateWithRealTimeData function
//   const updateWithRealTimeData = () => {
//     if (!isRealTimeMode) return;

//     const rtData =
//       marketData[instrument] || marketData[`NSE_INDEX|${instrument}`];
//     if (!rtData || !rtData.lastPrice) {
//       debugLog("No real-time data available");
//       return;
//     }

//     const now = new Date();
//     const currentMinute = now.getMinutes();
//     const currentPrice = rtData.lastPrice;

//     // Always update these references when we get new data
//     lastDataUpdateTimeRef.current = Date.now();
//     priceUpdatesCountRef.current += 1; // Increment on every update

//     // Update debug information with the latest data
//     updateDebugInfo(currentPrice, now);

//     // Rest of your existing minute change detection and candle update logic...
//   };

//   useEffect(() => {
//     if (!isRealTimeMode || !marketData) return;

//     const rtData =
//       marketData[instrument] || marketData[`NSE_INDEX|${instrument}`];
//     if (!rtData || !rtData.lastPrice) return;

//     // Force a state update to ensure the UI reflects the latest data
//     setDebugStatus((prev) => ({
//       ...prev,
//       lastPrice: rtData.lastPrice,
//       lastUpdateTime: new Date().toISOString(),
//       updatesThisMinute: priceUpdatesCountRef.current,
//       dataHealthy: true,
//       connectionState: "connected",
//       message: "Data flowing normally",
//     }));
//   }, [marketData, instrument, isRealTimeMode]);

//   // Update debug information
//   const updateDebugInfo = (currentPrice: number, now: Date) => {
//     const timeSinceLastUpdate =
//       (Date.now() - lastDataUpdateTimeRef.current) / 1000;
//     const isDataStale = timeSinceLastUpdate > STALE_DATA_THRESHOLD_SECONDS;

//     let connectionState: "connected" | "disconnected" | "stale" = isConnected
//       ? isDataStale
//         ? "stale"
//         : "connected"
//       : "disconnected";

//     let message = "";

//     switch (connectionState) {
//       case "connected":
//         message = "Data flowing normally";
//         break;
//       case "disconnected":
//         message = "WebSocket disconnected";
//         break;
//       case "stale":
//         message = `No updates in ${Math.round(timeSinceLastUpdate)}s`;
//         break;
//     }

//     setDebugStatus({
//       connectionState,
//       lastPrice: currentPrice,
//       lastUpdateTime: now.toISOString(),
//       updatesThisMinute: priceUpdatesCountRef.current,
//       currentCandle: currentCandleRef.current,
//       dataHealthy: connectionState === "connected",
//       message,
//     });
//   };

//   // Subscribe to this instrument
//   useEffect(() => {
//     if (isConnected && instrument) {
//       // Subscribe to this instrument if needed
//       debugLog(`Subscribing to instrument: ${instrument}`);
//       subscribeToInstruments([instrument]);
//     }
//   }, [isConnected, instrument, subscribeToInstruments]);

//   // Effect to fetch initial data and set up real-time updates
//   useEffect(() => {
//     // Reset state when instrument or interval changes
//     initialDataLoadedRef.current = false;
//     lastProcessedMinuteRef.current = -1;
//     currentCandleRef.current = null;
//     priceUpdatesCountRef.current = 0;

//     // Set real-time mode flag
//     const isMinuteInterval = interval === "minute" || interval === "1minute";
//     setIsRealTimeMode(isMinuteInterval && isConnected);

//     debugLog(`Real-time mode: ${isMinuteInterval && isConnected}`);

//     // Try to load from localStorage first
//     const storedData = loadFromLocalStorage();
//     if (storedData && storedData.length > 0) {
//       debugLog(`Loaded ${storedData.length} candles from localStorage`);
//       setIndicatorData(storedData);
//       indicatorDataRef.current = storedData;
//       initialDataLoadedRef.current = true;

//       // Set the last processed minute from the last candle
//       const lastCandle = storedData[storedData.length - 1];
//       const lastCandleTime = new Date(lastCandle.timestamp);
//       lastProcessedMinuteRef.current = lastCandleTime.getMinutes();

//       // Initialize current candle if in real-time mode
//       if (isRealTimeMode) {
//         const rtData =
//           marketData[instrument] || marketData[`NSE_INDEX|${instrument}`];
//         if (rtData && rtData.lastPrice) {
//           const now = new Date();
//           initializeCurrentCandle(now, rtData.lastPrice);
//           updateDebugInfo(rtData.lastPrice, now);
//         }
//       }

//       setIsLoading(false);
//     } else {
//       fetchHistoricalData();
//     }

//     // Clean up any existing intervals
//     if (updateIntervalRef.current) {
//       clearInterval(updateIntervalRef.current);
//     }

//     if (debugIntervalRef.current) {
//       clearInterval(debugIntervalRef.current);
//     }

//     // Set up interval for real-time updates - check every second
//     updateIntervalRef.current = setInterval(() => {
//       if (isConnected) {
//         updateWithRealTimeData();
//       }
//     }, 1000);

//     // Enhanced debug interval with better connection state tracking
//     debugIntervalRef.current = setInterval(() => {
//       const now = Date.now();
//       const secondsSinceUpdate = (now - lastDataUpdateTimeRef.current) / 1000;

//       setDebugStatus((prev) => {
//         // If we have recent updates, show connected status
//         if (secondsSinceUpdate <= STALE_DATA_THRESHOLD_SECONDS) {
//           return {
//             ...prev,
//             connectionState: "connected",
//             dataHealthy: true,
//             message: `Receiving updates (${priceUpdatesCountRef.current} this minute)`,
//           };
//         }

//         // Otherwise show stale/disconnected status
//         return {
//           ...prev,
//           connectionState: secondsSinceUpdate > 30 ? "disconnected" : "stale",
//           dataHealthy: false,
//           message:
//             secondsSinceUpdate > 30
//               ? "WebSocket disconnected"
//               : `No updates in ${Math.round(secondsSinceUpdate)}s`,
//         };
//       });
//     }, 1000);

//     // Clean up on unmount or when dependencies change
//     return () => {
//       if (updateIntervalRef.current) {
//         clearInterval(updateIntervalRef.current);
//       }

//       if (debugIntervalRef.current) {
//         clearInterval(debugIntervalRef.current);
//       }

//       // Reset all tracking references
//       lastDataUpdateTimeRef.current = Date.now();
//       priceUpdatesCountRef.current = 0;
//       lastProcessedMinuteRef.current = -1;
//     };
//   }, [instrument, interval, refreshTrigger, isConnected, marketData]);

//   // Additional useEffect for handling market data updates
//   useEffect(() => {
//     if (!isRealTimeMode || !marketData) return;

//     const rtData =
//       marketData[instrument] || marketData[`NSE_INDEX|${instrument}`];
//     if (!rtData || !rtData.lastPrice) return;

//     debugLog("Market data update received", {
//       lastPrice: rtData.lastPrice,
//       updateCount: priceUpdatesCountRef.current,
//     });

//     // Force a state update to ensure the UI reflects the latest data
//     setDebugStatus((prev) => ({
//       ...prev,
//       lastPrice: rtData.lastPrice,
//       lastUpdateTime: new Date().toISOString(),
//       updatesThisMinute: priceUpdatesCountRef.current,
//       dataHealthy: true,
//       connectionState: "connected",
//       message: "Data flowing normally",
//     }));
//   }, [marketData, instrument, isRealTimeMode]);

//   // Format timestamp based on interval
//   const formatTimestamp = (timestamp: string) => {
//     const date = new Date(timestamp);

//     if (
//       interval === "minute" ||
//       interval === "1minute" ||
//       interval === "5minute"
//     ) {
//       return format(date, "HH:mm:ss");
//     } else if (interval === "day") {
//       return format(date, "dd MMM yyyy");
//     } else {
//       return format(date, "dd MMM yyyy HH:mm");
//     }
//   };

//   // Render real-time debug banner
//   const renderDebugBanner = () => {
//     if (!isRealTimeMode) return null;

//     const {
//       connectionState,
//       lastPrice,
//       lastUpdateTime,
//       updatesThisMinute,
//       currentCandle,
//       message,
//     } = debugStatus;

//     const statusColor = {
//       connected:
//         "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
//       disconnected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
//       stale:
//         "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
//     };

//     const statusIcon = {
//       connected: <CheckCircle className="h-4 w-4 mr-1" />,
//       disconnected: <AlertTriangle className="h-4 w-4 mr-1" />,
//       stale: <Clock className="h-4 w-4 mr-1" />,
//     };

//     return (
//       <div className="mb-4 p-3 rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
//         <div className="text-sm font-medium mb-2">Real-Time Debug Status</div>
//         <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
//           <div className="flex items-center">
//             <div
//               className={`py-1 px-2 rounded-md flex items-center ${statusColor[connectionState]}`}
//             >
//               {statusIcon[connectionState]}
//               <span>
//                 {connectionState === "connected"
//                   ? "Connected"
//                   : connectionState === "stale"
//                   ? "Stale Data"
//                   : "Disconnected"}
//               </span>
//             </div>
//           </div>

//           {lastPrice && (
//             <div className="flex items-center gap-1">
//               <Activity className="h-4 w-4" />
//               <span>
//                 Last Price: <strong>{lastPrice.toFixed(2)}</strong>
//               </span>
//             </div>
//           )}

//           {updatesThisMinute > 0 && (
//             <div className="flex items-center gap-1">
//               <RefreshCw className="h-4 w-4" />
//               <span>
//                 Updates: <strong>{updatesThisMinute}</strong>
//               </span>
//             </div>
//           )}
//         </div>

//         {currentCandle && (
//           <div className="mt-2 p-2 bg-slate-100 dark:bg-slate-800 rounded-md">
//             <div className="text-xs font-medium mb-1">
//               Current Minute Candle (In Progress)
//             </div>
//             <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
//               <div>
//                 O: <strong>{currentCandle.open.toFixed(2)}</strong>
//               </div>
//               <div>
//                 H: <strong>{currentCandle.high.toFixed(2)}</strong>
//               </div>
//               <div>
//                 L: <strong>{currentCandle.low.toFixed(2)}</strong>
//               </div>
//               <div>
//                 C: <strong>{currentCandle.close.toFixed(2)}</strong>
//               </div>
//               <div>
//                 Updates: <strong>{currentCandle.updates}</strong>
//               </div>
//             </div>
//           </div>
//         )}

//         <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
//           {message}
//         </div>
//       </div>
//     );
//   };

//   // Render loading state
//   const renderLoading = () => (
//     <div className="text-center py-8">
//       <div className="mb-4 flex items-center justify-center gap-3">
//         <Loader2 className="h-5 w-5 animate-spin" />
//         <span>Loading technical indicators...</span>
//       </div>
//       <Progress value={50} className="h-2 max-w-md mx-auto" />
//     </div>
//   );

//   // Render error state
//   const renderError = () => (
//     <Alert variant="destructive" className="my-4">
//       <AlertTitle>Error Loading Data</AlertTitle>
//       <AlertDescription className="mb-2">{error}</AlertDescription>
//       <div className="flex justify-end mt-2">
//         <Button size="sm" onClick={fetchHistoricalData}>
//           <RefreshCw className="h-3 w-3 mr-2" />
//           Retry
//         </Button>
//       </div>
//     </Alert>
//   );

//   // Get instrument label
//   const instrumentLabel =
//     INSTRUMENTS.find((inst) => inst.key === instrument)?.label ||
//     "Selected Index";

//   // Render table with data
//   return (
//     <Card>
//       <CardHeader className="flex flex-row items-center justify-between">
//         <div>
//           <CardTitle>
//             Technical Indicators for {instrumentLabel}
//             {isRealTimeMode && (
//               <Badge variant="outline" className="ml-2">
//                 Real-Time
//               </Badge>
//             )}
//           </CardTitle>
//           <p className="text-sm text-muted-foreground mt-1">
//             Showing last {indicatorData.length} candles with EMA-9, EMA-18,
//             Supertrend, and Trading Signals
//             {lastUpdated && ` (Last updated: ${lastUpdated})`}
//           </p>
//         </div>
//         <div className="flex gap-2">
//           <Button
//             variant="destructive"
//             size="sm"
//             onClick={() => {
//               localStorage.removeItem(getStorageKey(instrument, interval));
//               debugLog(
//                 `[Reset Data] Cleared localStorage for key: ${getStorageKey(
//                   instrument,
//                   interval
//                 )}`
//               );
//               fetchHistoricalData();
//             }}
//             disabled={isLoading}
//           >
//             Reset Data
//           </Button>
//           <Button
//             variant="outline"
//             size="sm"
//             onClick={onRefresh}
//             disabled={isLoading}
//           >
//             <RefreshCw
//               className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
//             />
//             Refresh
//           </Button>
//         </div>
//       </CardHeader>
//       <CardContent>
//         {isLoading ? (
//           renderLoading()
//         ) : error ? (
//           renderError()
//         ) : (
//           <>
//             {renderDebugBanner()}

//             <div className="overflow-x-auto">
//               <Table>
//                 <TableHeader>
//                   <TableRow>
//                     <TableHead className="whitespace-nowrap">Time</TableHead>
//                     <TableHead>Open</TableHead>
//                     <TableHead>High</TableHead>
//                     <TableHead>Low</TableHead>
//                     <TableHead>Close</TableHead>
//                     <TableHead>EMA-9</TableHead>
//                     <TableHead>EMA-18</TableHead>
//                     <TableHead>Supertrend</TableHead>
//                     <TableHead>Signal</TableHead>
//                   </TableRow>
//                 </TableHeader>
//                 <TableBody>
//                   {/* Show current in-progress candle at the top when in real-time mode */}
//                   {isRealTimeMode && currentCandleRef.current && (
//                     <TableRow className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500">
//                       <TableCell className="whitespace-nowrap font-medium">
//                         {formatTimestamp(currentCandleRef.current.timestamp)}
//                         <Badge variant="outline" className="ml-2 animate-pulse">
//                           Live
//                         </Badge>
//                       </TableCell>
//                       <TableCell>
//                         {currentCandleRef.current.open.toFixed(2)}
//                       </TableCell>
//                       <TableCell>
//                         <TooltipProvider>
//                           <Tooltip>
//                             <TooltipTrigger>
//                               <span className="text-green-600 dark:text-green-400 font-medium">
//                                 {currentCandleRef.current.high.toFixed(2)}
//                               </span>
//                             </TooltipTrigger>
//                             <TooltipContent>Real-time high</TooltipContent>
//                           </Tooltip>
//                         </TooltipProvider>
//                       </TableCell>
//                       <TableCell>
//                         <TooltipProvider>
//                           <Tooltip>
//                             <TooltipTrigger>
//                               <span className="text-red-600 dark:text-red-400 font-medium">
//                                 {currentCandleRef.current.low.toFixed(2)}
//                               </span>
//                             </TooltipTrigger>
//                             <TooltipContent>Real-time low</TooltipContent>
//                           </Tooltip>
//                         </TooltipProvider>
//                       </TableCell>
//                       <TableCell className="font-medium">
//                         <TooltipProvider>
//                           <Tooltip>
//                             <TooltipTrigger>
//                               <span className="text-blue-600 dark:text-blue-400">
//                                 {currentCandleRef.current.close.toFixed(2)}
//                               </span>
//                             </TooltipTrigger>
//                             <TooltipContent>
//                               Current price (updates in real-time)
//                             </TooltipContent>
//                           </Tooltip>
//                         </TooltipProvider>
//                       </TableCell>
//                       <TableCell
//                         colSpan={4}
//                         className="text-center text-xs text-slate-500"
//                       >
//                         In-progress candle (Updates:{" "}
//                         {currentCandleRef.current.updates})
//                       </TableCell>
//                     </TableRow>
//                   )}

//                   {/* Render historical indicator data */}
//                   {indicatorData.map((item, index) => {
//                     const isBullish = item.supertrend.direction === "up";
//                     const isBearish = item.supertrend.direction === "down";
//                     const priceGoingUp =
//                       index > 0 && item.close > indicatorData[index - 1].close;
//                     const priceGoingDown =
//                       index > 0 && item.close < indicatorData[index - 1].close;

//                     return (
//                       <TableRow key={item.timestamp}>
//                         <TableCell className="whitespace-nowrap font-medium">
//                           {formatTimestamp(item.timestamp)}
//                         </TableCell>
//                         <TableCell>{item.open.toFixed(2)}</TableCell>
//                         <TableCell>{item.high.toFixed(2)}</TableCell>
//                         <TableCell>{item.low.toFixed(2)}</TableCell>
//                         <TableCell
//                           className={
//                             priceGoingUp
//                               ? "text-green-600 dark:text-green-400"
//                               : priceGoingDown
//                               ? "text-red-600 dark:text-red-400"
//                               : ""
//                           }
//                         >
//                           {item.close.toFixed(2)}
//                         </TableCell>
//                         <TableCell>{item.ema9.toFixed(2)}</TableCell>
//                         <TableCell>{item.ema18.toFixed(2)}</TableCell>
//                         <TableCell>
//                           <div className="flex items-center gap-2">
//                             <span
//                               className={
//                                 isBullish
//                                   ? "text-green-600 dark:text-green-400"
//                                   : "text-red-600 dark:text-red-400"
//                               }
//                             >
//                               {item.supertrend.value.toFixed(2)}
//                             </span>
//                             <Badge
//                               variant={isBullish ? "success" : "destructive"}
//                             >
//                               {isBullish ? "Bullish" : "Bearish"}
//                             </Badge>
//                           </div>
//                         </TableCell>
//                         <TableCell>
//                           {item.signal === "BUY" ? (
//                             <Badge
//                               variant="success"
//                               className={`flex items-center gap-1 ${
//                                 item.isNewSignal ? "animate-pulse" : ""
//                               }`}
//                             >
//                               <ArrowUp className="h-3 w-3" />
//                               BUY
//                             </Badge>
//                           ) : item.signal === "SELL" ? (
//                             <Badge
//                               variant="destructive"
//                               className={`flex items-center gap-1 ${
//                                 item.isNewSignal ? "animate-pulse" : ""
//                               }`}
//                             >
//                               <ArrowDown className="h-3 w-3" />
//                               SELL
//                             </Badge>
//                           ) : (
//                             <Badge variant="outline">NEUTRAL</Badge>
//                           )}
//                         </TableCell>
//                       </TableRow>
//                     );
//                   })}
//                 </TableBody>
//               </Table>
//             </div>
//           </>
//         )}
//       </CardContent>
//     </Card>
//   );
// }
"use client";

import React, { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import {
  RefreshCw,
  Loader2,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  Activity,
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

// Signal type definition
type SignalType = "BUY" | "SELL" | "NEUTRAL";

// Interface for indicator data
interface IndicatorData extends OHLCData {
  ema9: number;
  ema18: number;
  supertrend: {
    value: number;
    direction: "up" | "down";
  };
  signal?: SignalType;
  isNewSignal?: boolean; // Flag to indicate if this is a new signal
}

// New interface for current candle tracking
interface InProgressCandle extends OHLCData {
  updates: number; // Count of price updates received
  lastUpdateTime: string; // Timestamp of last update
}

// Debug status type
type DebugStatus = {
  connectionState: "connected" | "disconnected" | "stale";
  lastPrice: number | null;
  lastUpdateTime: string | null;
  updatesThisMinute: number;
  currentCandle: InProgressCandle | null;
  dataHealthy: boolean;
  message: string;
};

// ATR Multiplier and Period for Supertrend calculation
const SUPERTREND_MULTIPLIER = 3;
const SUPERTREND_PERIOD = 7;

// Fixed number of candles to display
const MAX_CANDLES = 100;

// Data health thresholds
const STALE_DATA_THRESHOLD_SECONDS = 5;
const DEBUG_LOG_ENABLED = true;

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
  const [isRealTimeMode, setIsRealTimeMode] = useState<boolean>(false);
  const { isConnected, marketData, subscribeToInstruments } = useMarketData();

  // Force render mechanism
  const [forceRender, setForceRender] = useState<number>(0);

  // New debug state
  const [debugStatus, setDebugStatus] = useState<DebugStatus>({
    connectionState: "disconnected",
    lastPrice: null,
    lastUpdateTime: null,
    updatesThisMinute: 0,
    currentCandle: null,
    dataHealthy: false,
    message: "Initializing...",
  });

  // Direct DOM update reference
  const updateCounterRef = useRef<HTMLDivElement>(null);

  // Reference to store the interval ID for real-time updates
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const debugIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const forceRenderIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Store the last minute we processed to detect minute changes
  const lastProcessedMinuteRef = useRef<number>(-1);

  // Flag to indicate if initial data has been loaded
  const initialDataLoadedRef = useRef<boolean>(false);

  // Add a ref to always have the latest indicatorData
  const indicatorDataRef = useRef<IndicatorData[]>([]);

  // New ref for tracking current candle being built
  const currentCandleRef = useRef<InProgressCandle | null>(null);

  // Track market data updates
  const lastDataUpdateTimeRef = useRef<number>(Date.now());
  const priceUpdatesCountRef = useRef<number>(0);
  const lastPriceRef = useRef<number | null>(null);

  // Track how many times updateWithRealTimeData is called
  const updateFunctionCallCountRef = useRef<number>(0);

  // Helper function for debug logging with timestamps
  const debugLog = (message: string, data?: any) => {
    if (DEBUG_LOG_ENABLED) {
      const timestamp = new Date().toISOString();
      if (data) {
        console.log(`[${timestamp}] [TechnicalIndicators] ${message}`, data);
      } else {
        console.log(`[${timestamp}] [TechnicalIndicators] ${message}`);
      }
    }
  };

  // Update the ref whenever indicatorData changes
  useEffect(() => {
    indicatorDataRef.current = indicatorData;
    debugLog("indicatorData state updated", { length: indicatorData.length });
  }, [indicatorData]);

  // Log debug status updates
  useEffect(() => {
    debugLog("debugStatus updated", debugStatus);
  }, [debugStatus]);

  // Monitor market data changes
  useEffect(() => {
    const rtData =
      marketData[instrument] || marketData[`NSE_INDEX|${instrument}`];
    if (rtData && rtData.lastPrice) {
      debugLog("Market data changed for instrument", {
        instrument,
        lastPrice: rtData.lastPrice,
        timestamp: new Date().toISOString(),
      });
    }
  }, [marketData, instrument]);

  // Save data to localStorage
  const saveToLocalStorage = (data: IndicatorData[]) => {
    try {
      if (!data || data.length === 0) {
        debugLog("Not saving empty data to localStorage.");
        return;
      }
      // Ensure we only store MAX_CANDLES
      const dataToStore = data.slice(-MAX_CANDLES);
      const storageKey = getStorageKey(instrument, interval);
      localStorage.setItem(storageKey, JSON.stringify(dataToStore));
      debugLog(
        `Saved ${dataToStore.length} candles to localStorage: ${storageKey}`
      );
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
        debugLog(
          `Loaded ${parsedData.length} candles from localStorage: ${storageKey}`
        );
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

  // Calculate buy and sell signals based on custom conditions
  const calculateSignals = (data: IndicatorData[]): IndicatorData[] => {
    if (data.length < 3) {
      return data.map((candle) => ({
        ...candle,
        signal: "NEUTRAL" as SignalType,
        isNewSignal: false,
      }));
    }

    // First pass to compute signals without the "isNewSignal" flag
    const withSignals = data.map((candle, index) => {
      // First two candles cannot generate signals (need previous data)
      if (index < 2) {
        return {
          ...candle,
          signal: "NEUTRAL" as SignalType,
          isNewSignal: false,
        };
      }

      const current = candle;
      const prev = data[index - 1];
      const prevPrev = data[index - 2];

      // The percentage threshold 0.005%
      const threshold = 0.00005; // 0.05% (0.0005 as decimal)

      // SELL conditions
      const sellCondition1 =
        current.high <= prev.high - current.close * threshold;
      const sellCondition2 =
        current.low <= prev.low - current.close * threshold;
      const sellCondition3 =
        current.close <= prev.high + current.close * threshold;
      const sellCondition4 = current.close < current.open;
      const sellCondition5 = current.low < prevPrev.low;
      const sellCondition6 = current.close <= current.ema18;
      const sellCondition7 =
        (current.ema9 - current.ema18) / current.close <= -threshold;

      // BUY conditions
      const buyCondition1 =
        current.high > prev.high + current.close * threshold;
      const buyCondition2 = current.low >= prev.low - current.close * threshold;
      const buyCondition3 =
        current.close >= prev.high + current.close * threshold;
      const buyCondition4 = current.open <= current.close;
      const buyCondition5 = current.high > prevPrev.high;
      const buyCondition6 = current.close > current.ema18;
      const buyCondition7 =
        (current.ema9 - current.ema18) / current.close >= threshold;

      // Debug logging for latest candle
      if (index === data.length - 1) {
        debugLog("Latest candle SELL conditions:", {
          sellCondition1,
          sellCondition2,
          sellCondition3,
          sellCondition4,
          sellCondition5,
          sellCondition6,
          sellCondition7,
          high: current.high,
          prevHigh: prev.high,
          threshold: current.close * threshold,
        });

        debugLog("Latest candle BUY conditions:", {
          buyCondition1,
          buyCondition2,
          buyCondition3,
          buyCondition4,
          buyCondition5,
          buyCondition6,
          buyCondition7,
          high: current.high,
          prevHigh: prev.high,
          threshold: current.close * threshold,
        });
      }

      // Determine signal based on conditions
      let signal: SignalType = "NEUTRAL";

      if (
        sellCondition1 &&
        sellCondition2 &&
        sellCondition3 &&
        sellCondition4 &&
        sellCondition5 &&
        sellCondition6 &&
        sellCondition7
      ) {
        signal = "SELL";
      } else if (
        buyCondition1 &&
        buyCondition2 &&
        buyCondition3 &&
        buyCondition4 &&
        buyCondition5 &&
        buyCondition6 &&
        buyCondition7
      ) {
        signal = "BUY";
      }

      return {
        ...candle,
        signal,
        isNewSignal: false, // Will be updated in second pass
      };
    });

    // Second pass to compute the "isNewSignal" flag
    return withSignals.map((candle, index) => {
      // First candle or neutral signal is never a new signal
      if (index === 0 || candle.signal === "NEUTRAL") {
        return candle; // Already has isNewSignal: false
      }

      // A signal is new if it's different from the previous candle's signal
      const isNewSignal = candle.signal !== withSignals[index - 1].signal;

      return {
        ...candle,
        isNewSignal,
      };
    });
  };

  // Combine raw OHLC data with calculated indicators and signals
  const processData = (rawData: OHLCData[]): IndicatorData[] => {
    if (!rawData || rawData.length === 0) {
      debugLog("No data to process");
      return [];
    }

    debugLog(`Processing ${rawData.length} candles`);

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

    // Combine data with indicators
    const dataWithIndicators: IndicatorData[] = sortedData.map(
      (candle, index) => ({
        ...candle,
        ema9: ema9Values[index],
        ema18: ema18Values[index],
        supertrend: supertrendValues[index],
      })
    );

    // Add signals
    const dataWithSignals = calculateSignals(dataWithIndicators);

    // Limit to last MAX_CANDLES
    return dataWithSignals.slice(-MAX_CANDLES);
  };

  // Check if market is open
  const isMarketOpen = () => {
    const now = new Date();
    const day = now.getDay();
    const hours = now.getHours();
    const minutes = now.getMinutes();

    // Weekends are closed (0 = Sunday, 6 = Saturday)
    if (day === 0 || day === 6) return false;

    // Market hours (assuming 9:15 AM to 3:30 PM for NSE)
    const marketStart = 9 * 60 + 15; // 9:15 AM in minutes
    const marketEnd = 15 * 60 + 30; // 3:30 PM in minutes
    const currentTime = hours * 60 + minutes;

    return currentTime >= marketStart && currentTime <= marketEnd;
  };

  // Helper function to initialize current candle
  const initializeCurrentCandle = (time: Date, price: number) => {
    currentCandleRef.current = {
      timestamp: time.toISOString(),
      open: price,
      high: price,
      low: price,
      close: price,
      updates: 1,
      lastUpdateTime: time.toISOString(),
    };
    debugLog("Initialized current candle", currentCandleRef.current);

    // Store the initial price
    lastPriceRef.current = price;

    // Reset update counter
    priceUpdatesCountRef.current = 1;

    // Update debug status with initial candle
    updateDebugInfo(price, time);
  };

  // Initialize with a single candle at current time
  const initializeWithCurrentPrice = () => {
    const rtData =
      marketData[instrument] || marketData[`NSE_INDEX|${instrument}`];

    if (!rtData || !rtData.lastPrice) {
      debugLog("No real-time data available for initialization");
      return [];
    }

    // Try to load existing data from localStorage first
    const storedData = loadFromLocalStorage();
    if (storedData && storedData.length > 0) {
      debugLog("Using stored data for initialization");

      // Check if stored data is fresh (from the current trading session)
      const lastCandleTime = new Date(
        storedData[storedData.length - 1].timestamp
      );
      const now1 = new Date();
      const timeDiff =
        (now1.getTime() - lastCandleTime.getTime()) / (1000 * 60); // Diff in minutes

      // If stored data is from previous day or too old (> 60 min), start fresh
      if (timeDiff > 60 || lastCandleTime.getDate() !== now1.getDate()) {
        debugLog("Stored data too old, creating new data");

        // Create a new candle with current price
        const initialCandle: OHLCData = {
          timestamp: now1.toISOString(),
          open: rtData.lastPrice,
          high: rtData.lastPrice,
          low: rtData.lastPrice,
          close: rtData.lastPrice,
        };

        // Initialize current candle for ongoing updates
        initializeCurrentCandle(now1, rtData.lastPrice);

        // Set the last processed minute
        lastProcessedMinuteRef.current = now1.getMinutes();

        // Return processed data with indicators
        return processData([initialCandle]);
      }

      // Update last processed minute to match the last candle
      lastProcessedMinuteRef.current = lastCandleTime.getMinutes();

      // Initialize current candle for ongoing updates
      const now = new Date();
      initializeCurrentCandle(now, rtData.lastPrice);

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

    // Initialize current candle for ongoing updates
    initializeCurrentCandle(now, rtData.lastPrice);

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
      // When interval is 1minute or minute, prioritize real-time data immediately
      if ((interval === "minute" || interval === "1minute") && isConnected) {
        const initialData = initializeWithCurrentPrice();
        if (initialData && initialData.length > 0) {
          setIndicatorData(initialData);
          setLastUpdated(new Date().toLocaleTimeString());
          setIsLoading(false);
          initialDataLoadedRef.current = true;
          saveToLocalStorage(initialData); // Save to localStorage
          return;
        }
      }

      // For other cases, try to get data from API
      // Check if the instrument is an index
      if (!isIndex) {
        setError("This view is only available for index instruments.");
        setIsLoading(false);
        return;
      }

      // Otherwise, get data for the last 60 days to ensure we have enough for calculations
      const today = new Date();
      const pastDate = new Date();
      pastDate.setDate(today.getDate() - 60);

      const formattedToDate = format(today, "yyyy-MM-dd");
      const formattedFromDate = format(pastDate, "yyyy-MM-dd");

      // Fetch data
      debugLog(
        `Fetching historical data for ${instrument} interval ${interval}`
      );
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
        debugLog(`Received ${candles.length} historical candles`);

        const processedData = processData(candles);

        setIndicatorData(processedData);
        setLastUpdated(new Date().toLocaleTimeString());
        initialDataLoadedRef.current = true;
        saveToLocalStorage(processedData); // Save to localStorage

        // Initialize current candle with latest price if in real-time mode
        if (isRealTimeMode) {
          const rtData =
            marketData[instrument] || marketData[`NSE_INDEX|${instrument}`];
          if (rtData && rtData.lastPrice) {
            initializeCurrentCandle(new Date(), rtData.lastPrice);
          }
        }
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

  // Enhanced update with real-time data function
  const updateWithRealTimeData = () => {
    // Count function calls for debugging
    updateFunctionCallCountRef.current++;

    // Log every 10 calls to verify function is being invoked
    if (updateFunctionCallCountRef.current % 10 === 0) {
      debugLog(
        `updateWithRealTimeData called ${updateFunctionCallCountRef.current} times`
      );
    }

    // Direct DOM update for verifying updates (bypasses React rendering)
    if (updateCounterRef.current) {
      updateCounterRef.current.textContent = `Function calls: ${updateFunctionCallCountRef.current}`;
    }

    if (!isRealTimeMode) {
      return;
    }

    const rtData =
      marketData[instrument] || marketData[`NSE_INDEX|${instrument}`];

    if (!rtData || !rtData.lastPrice) {
      debugLog("No real-time data available");
      return;
    }

    // Get current price
    const currentPrice = rtData.lastPrice;

    // Check if price has actually changed since last update
    const priceChanged = lastPriceRef.current !== currentPrice;

    // Update last price reference regardless
    lastPriceRef.current = currentPrice;

    // Record last update time
    lastDataUpdateTimeRef.current = Date.now();

    const now = new Date();
    const currentMinute = now.getMinutes();

    // Always increment update counter regardless of price change
    priceUpdatesCountRef.current++;

    // Always update debug status
    updateDebugInfo(currentPrice, now);

    // Check for minute change to create a new candle
    if (lastProcessedMinuteRef.current !== currentMinute) {
      debugLog(
        `Minute change detected: ${lastProcessedMinuteRef.current} → ${currentMinute}`
      );

      // If we have a current candle, finalize it and add to history
      if (currentCandleRef.current) {
        debugLog("Finalizing current candle", currentCandleRef.current);

        // Create a standard OHLC candle from the in-progress one
        const finalizedCandle: OHLCData = {
          timestamp: currentCandleRef.current.timestamp,
          open: currentCandleRef.current.open,
          high: currentCandleRef.current.high,
          low: currentCandleRef.current.low,
          close: currentCandleRef.current.close,
        };

        // Add the finalized candle to history and process
        const updatedCandles = [
          ...indicatorDataRef.current,
          finalizedCandle,
        ].slice(-MAX_CANDLES);
        const processedData = processData(updatedCandles);

        // Update state, refs, and persistence
        setIndicatorData(processedData);
        indicatorDataRef.current = processedData; // Update ref immediately
        saveToLocalStorage(processedData);

        // Update UI information
        setLastUpdated(now.toLocaleTimeString());
      }

      // Create a new candle for the current minute
      currentCandleRef.current = {
        timestamp: now.toISOString(),
        open: currentPrice,
        high: currentPrice,
        low: currentPrice,
        close: currentPrice,
        updates: 1,
        lastUpdateTime: now.toISOString(),
      };

      // Reset update counter for the new minute
      priceUpdatesCountRef.current = 1;

      // Update the minute reference
      lastProcessedMinuteRef.current = currentMinute;

      debugLog("New candle created", currentCandleRef.current);

      // Force a render update
      setForceRender((prev) => prev + 1);
    }
    // Same minute - update the current candle
    else if (currentCandleRef.current) {
      const candle = currentCandleRef.current;
      let updated = false;

      // Update high if price is higher
      if (currentPrice > candle.high) {
        candle.high = currentPrice;
        updated = true;
      }

      // Update low if price is lower
      if (currentPrice < candle.low) {
        candle.low = currentPrice;
        updated = true;
      }

      // Always update close with latest price
      if (candle.close !== currentPrice) {
        candle.close = currentPrice;
        updated = true;
      }

      // Always update metadata
      candle.updates = priceUpdatesCountRef.current;
      candle.lastUpdateTime = now.toISOString();

      if (updated) {
        debugLog("Updated current candle", {
          high: candle.high,
          low: candle.low,
          close: candle.close,
          updates: candle.updates,
        });
      }

      // Update debug status with new candle data even if not updated
      // This ensures the UI reflects the current state
      setDebugStatus((prev) => ({
        ...prev,
        currentCandle: { ...candle },
        updatesThisMinute: priceUpdatesCountRef.current,
      }));

      // Force a subtle UI update to ensure the component re-renders
      // even if React doesn't detect state changes
      setForceRender((prev) => prev + 1);
    }
    // No current candle but we should have one - initialize
    else {
      debugLog("No current candle found, initializing one");
      initializeCurrentCandle(now, currentPrice);
      priceUpdatesCountRef.current = 1;
    }
  };

  // Update debug information
  const updateDebugInfo = (currentPrice: number, now: Date) => {
    const timeSinceLastUpdate =
      (Date.now() - lastDataUpdateTimeRef.current) / 1000;
    const isDataStale = timeSinceLastUpdate > STALE_DATA_THRESHOLD_SECONDS;

    let connectionState: "connected" | "disconnected" | "stale" = isConnected
      ? isDataStale
        ? "stale"
        : "connected"
      : "disconnected";

    let message = "";

    switch (connectionState) {
      case "connected":
        message = "Data flowing normally";
        break;
      case "disconnected":
        message = "WebSocket disconnected";
        break;
      case "stale":
        message = `No updates in ${Math.round(timeSinceLastUpdate)}s`;
        break;
    }

    setDebugStatus({
      connectionState,
      lastPrice: currentPrice,
      lastUpdateTime: now.toISOString(),
      updatesThisMinute: priceUpdatesCountRef.current,
      currentCandle: currentCandleRef.current,
      dataHealthy: connectionState === "connected",
      message,
    });
  };

  // Attempt reconnection if connection is stale
  const attemptReconnection = () => {
    if (!isConnected || !isRealTimeMode) return;

    const secondsSinceUpdate =
      (Date.now() - lastDataUpdateTimeRef.current) / 1000;

    if (secondsSinceUpdate > 15) {
      debugLog("No updates for 15+ seconds, attempting to reconnect");
      try {
        // Resubscribe to the instrument
        subscribeToInstruments([instrument]); // Subscribe to the instrument

        // Reset the update time to give it a chance
        lastDataUpdateTimeRef.current = Date.now();

        // Update the status
        setDebugStatus((prev) => ({
          ...prev,
          message: "Reconnection attempt initiated",
        }));
      } catch (err) {
        console.error("Failed to reconnect:", err);
      }
    }
  };

  // Verify data flow across all instruments
  const verifyDataFlow = () => {
    // Check if we're getting ANY updates from market data
    const keys = Object.keys(marketData);
    if (keys.length === 0) {
      debugLog("No market data is being received for any instrument");
      setError(
        "No market data is flowing. Please check your connection to market data provider."
      );
    } else {
      debugLog(`Receiving data for ${keys.length} instruments`);
      // Check if our specific instrument is in the data
      if (!marketData[instrument] && !marketData[`NSE_INDEX|${instrument}`]) {
        debugLog(`Not receiving data specifically for ${instrument}`);
      }
    }
  };

  // Subscribe to this instrument
  useEffect(() => {
    if (isConnected && instrument) {
      // Subscribe to this instrument
      debugLog(`Subscribing to instrument: ${instrument}`);

      // Implement subscription with retry logic
      const subscribeWithRetry = () => {
        let attempts = 0;
        const maxAttempts = 3;

        const attemptSubscribe = () => {
          if (attempts < maxAttempts) {
            attempts++;
            debugLog(`Subscription attempt ${attempts} for ${instrument}`);

            // Implement subscription with retry logic
            const subscribeWithRetry = () => {
              let attempts = 0;
              const maxAttempts = 3;

              const attemptSubscribe = () => {
                if (attempts < maxAttempts) {
                  attempts++;
                  debugLog(
                    `Subscription attempt ${attempts} for ${instrument}`
                  );

                  subscribeToInstruments([instrument]);
                } else {
                  console.error(
                    `Failed to subscribe to ${instrument} after ${maxAttempts} attempts`
                  );
                }
              };

              attemptSubscribe();
            };

            // Call the function
            subscribeWithRetry();
          } else {
            console.error(
              `Failed to subscribe to ${instrument} after ${maxAttempts} attempts`
            );
          }
        };

        attemptSubscribe();
      };

      subscribeWithRetry();

      // Verify data flow after subscription
      setTimeout(verifyDataFlow, 5000);
    }
  }, [isConnected, instrument, subscribeToInstruments]);

  // Effect to fetch initial data and set up real-time updates
  useEffect(() => {
    // Reset state when instrument or interval changes
    initialDataLoadedRef.current = false;
    lastProcessedMinuteRef.current = -1;
    currentCandleRef.current = null;
    priceUpdatesCountRef.current = 0;
    updateFunctionCallCountRef.current = 0;
    lastPriceRef.current = null;

    // Set real-time mode flag
    const isMinuteInterval = interval === "minute" || interval === "1minute";
    setIsRealTimeMode(isMinuteInterval && isConnected);

    debugLog(`Real-time mode: ${isMinuteInterval && isConnected}`);

    // Try to load from localStorage first
    const storedData = loadFromLocalStorage();
    if (storedData && storedData.length > 0) {
      debugLog(`Loaded ${storedData.length} candles from localStorage`);
      setIndicatorData(storedData);
      indicatorDataRef.current = storedData;
      initialDataLoadedRef.current = true;

      // Set the last processed minute from the last candle
      const lastCandle = storedData[storedData.length - 1];
      const lastCandleTime = new Date(lastCandle.timestamp);
      lastProcessedMinuteRef.current = lastCandleTime.getMinutes();

      // Initialize current candle if in real-time mode
      if (isRealTimeMode) {
        const rtData =
          marketData[instrument] || marketData[`NSE_INDEX|${instrument}`];
        if (rtData && rtData.lastPrice) {
          const now = new Date();
          initializeCurrentCandle(now, rtData.lastPrice);

          // Update debug status with initial data
          updateDebugInfo(rtData.lastPrice, now);
        }
      }

      setIsLoading(false);
    } else {
      fetchHistoricalData();
    }

    // Clean up any existing intervals
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
    }

    if (debugIntervalRef.current) {
      clearInterval(debugIntervalRef.current);
    }

    if (forceRenderIntervalRef.current) {
      clearInterval(forceRenderIntervalRef.current);
    }

    // Set up interval for real-time updates - check every second
    updateIntervalRef.current = setInterval(() => {
      if (isConnected) {
        updateWithRealTimeData();
      }
    }, 1000);

    // Set up interval for debug status updates
    debugIntervalRef.current = setInterval(() => {
      const now = Date.now();
      const secondsSinceUpdate = (now - lastDataUpdateTimeRef.current) / 1000;

      // Update status message if time since last update changes
      setDebugStatus((prev) => {
        if (!prev.lastUpdateTime) return prev;

        const connectionState: "connected" | "disconnected" | "stale" =
          isConnected
            ? secondsSinceUpdate > STALE_DATA_THRESHOLD_SECONDS
              ? "stale"
              : "connected"
            : "disconnected";

        let message = prev.message;

        if (connectionState === "stale") {
          message = `No updates in ${Math.round(secondsSinceUpdate)}s`;

          // Attempt reconnection if stale for too long
          if (secondsSinceUpdate > 15) {
            attemptReconnection();
          }
        }

        return {
          ...prev,
          connectionState,
          dataHealthy: connectionState === "connected",
          message,
        };
      });
    }, 1000);

    // Set up a force render interval to ensure UI updates
    forceRenderIntervalRef.current = setInterval(() => {
      if (isRealTimeMode) {
        setForceRender((prev) => prev + 1);
      }
    }, 5000);

    // Clean up on unmount
    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }

      if (debugIntervalRef.current) {
        clearInterval(debugIntervalRef.current);
      }

      if (forceRenderIntervalRef.current) {
        clearInterval(forceRenderIntervalRef.current);
      }
    };
  }, [instrument, interval, refreshTrigger, isConnected, marketData]);

  // Additional effect to respond immediately to market data changes
  useEffect(() => {
    if (!isRealTimeMode) return;

    const rtData =
      marketData[instrument] || marketData[`NSE_INDEX|${instrument}`];
    if (!rtData || !rtData.lastPrice) return;

    // Record that we got a direct update from the market data
    debugLog("Direct market data update received", {
      instrument,
      price: rtData.lastPrice,
      timestamp: new Date().toISOString(),
    });

    // Trigger an immediate update
    lastDataUpdateTimeRef.current = Date.now();
    priceUpdatesCountRef.current++;

    // Update the current candle if it exists
    if (currentCandleRef.current) {
      const candle = currentCandleRef.current;
      const currentPrice = rtData.lastPrice;

      // Update high/low/close
      if (currentPrice > candle.high) candle.high = currentPrice;
      if (currentPrice < candle.low) candle.low = currentPrice;
      candle.close = currentPrice;
      candle.updates = priceUpdatesCountRef.current;
      candle.lastUpdateTime = new Date().toISOString();

      // Update the debug status to show the change
      setDebugStatus((prev) => ({
        ...prev,
        lastPrice: currentPrice,
        lastUpdateTime: new Date().toISOString(),
        updatesThisMinute: priceUpdatesCountRef.current,
        currentCandle: { ...candle },
        connectionState: "connected",
        dataHealthy: true,
        message: "Data flowing normally",
      }));
    }
  }, [marketData, instrument, isRealTimeMode]);

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

  // Render real-time debug banner
  const renderDebugBanner = () => {
    if (!isRealTimeMode) return null;

    const {
      connectionState,
      lastPrice,
      lastUpdateTime,
      updatesThisMinute,
      currentCandle,
      message,
    } = debugStatus;

    const statusColor = {
      connected:
        "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      disconnected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
      stale:
        "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
    };

    const statusIcon = {
      connected: <CheckCircle className="h-4 w-4 mr-1" />,
      disconnected: <AlertTriangle className="h-4 w-4 mr-1" />,
      stale: <Clock className="h-4 w-4 mr-1" />,
    };

    return (
      <div className="mb-4 p-3 rounded-md bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <div className="text-sm font-medium mb-2">Real-Time Debug Status</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          <div className="flex items-center">
            <div
              className={`py-1 px-2 rounded-md flex items-center ${statusColor[connectionState]}`}
            >
              {statusIcon[connectionState]}
              <span>
                {connectionState === "connected"
                  ? "Connected"
                  : connectionState === "stale"
                  ? "Stale Data"
                  : "Disconnected"}
              </span>
            </div>
          </div>

          {lastPrice && (
            <div className="flex items-center gap-1">
              <Activity className="h-4 w-4" />
              <span>
                Last Price: <strong>{lastPrice.toFixed(2)}</strong>
              </span>
            </div>
          )}

          {updatesThisMinute > 0 && (
            <div className="flex items-center gap-1">
              <RefreshCw className="h-4 w-4" />
              <span>
                Updates: <strong>{updatesThisMinute}</strong>
              </span>
            </div>
          )}
        </div>

        {currentCandle && (
          <div className="mt-2 p-2 bg-slate-100 dark:bg-slate-800 rounded-md">
            <div className="text-xs font-medium mb-1">
              Current Minute Candle (In Progress)
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
              <div>
                O: <strong>{currentCandle.open.toFixed(2)}</strong>
              </div>
              <div>
                H: <strong>{currentCandle.high.toFixed(2)}</strong>
              </div>
              <div>
                L: <strong>{currentCandle.low.toFixed(2)}</strong>
              </div>
              <div>
                C: <strong>{currentCandle.close.toFixed(2)}</strong>
              </div>
              <div>
                Updates: <strong>{currentCandle.updates}</strong>
              </div>
            </div>
          </div>
        )}

        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {message}
        </div>

        {/* Hidden div for direct DOM updates to verify function calls */}
        <div ref={updateCounterRef} className="hidden">
          Function calls: 0
        </div>
      </div>
    );
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
          <CardTitle>
            Technical Indicators for {instrumentLabel}
            {isRealTimeMode && (
              <Badge variant="outline" className="ml-2">
                Real-Time
              </Badge>
            )}
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Showing last {indicatorData.length} candles with EMA-9, EMA-18,
            Supertrend, and Trading Signals
            {lastUpdated && ` (Last updated: ${lastUpdated})`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              localStorage.removeItem(getStorageKey(instrument, interval));
              debugLog(
                `[Reset Data] Cleared localStorage for key: ${getStorageKey(
                  instrument,
                  interval
                )}`
              );
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
          <>
            {renderDebugBanner()}

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
                    <TableHead>Signal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Show current in-progress candle at the top when in real-time mode */}
                  {isRealTimeMode && currentCandleRef.current && (
                    <TableRow className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500">
                      <TableCell className="whitespace-nowrap font-medium">
                        {formatTimestamp(currentCandleRef.current.timestamp)}
                        <Badge variant="outline" className="ml-2 animate-pulse">
                          Live
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {currentCandleRef.current.open.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <span className="text-green-600 dark:text-green-400 font-medium">
                                {currentCandleRef.current.high.toFixed(2)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Real-time high</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <span className="text-red-600 dark:text-red-400 font-medium">
                                {currentCandleRef.current.low.toFixed(2)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Real-time low</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="font-medium">
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <span className="text-blue-600 dark:text-blue-400">
                                {currentCandleRef.current.close.toFixed(2)}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              Current price (updates in real-time)
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell
                        colSpan={4}
                        className="text-center text-xs text-slate-500"
                      >
                        In-progress candle (Updates:{" "}
                        {currentCandleRef.current.updates})
                      </TableCell>
                    </TableRow>
                  )}

                  {/* Render historical indicator data */}
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
                        <TableCell>
                          {item.signal === "BUY" ? (
                            <Badge
                              variant="success"
                              className={`flex items-center gap-1 ${
                                item.isNewSignal ? "animate-pulse" : ""
                              }`}
                            >
                              <ArrowUp className="h-3 w-3" />
                              BUY
                            </Badge>
                          ) : item.signal === "SELL" ? (
                            <Badge
                              variant="destructive"
                              className={`flex items-center gap-1 ${
                                item.isNewSignal ? "animate-pulse" : ""
                              }`}
                            >
                              <ArrowDown className="h-3 w-3" />
                              SELL
                            </Badge>
                          ) : (
                            <Badge variant="outline">NEUTRAL</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
