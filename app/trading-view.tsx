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
import {
  Calendar as CalendarIcon,
  Search,
  RefreshCw,
  Activity,
} from "lucide-react";
import { Buffer } from "buffer";
import protobuf from "protobufjs";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { INSTRUMENTS, INTERVALS } from "./constants";
import { Interval, OHLCData, APIResponse, Candle } from "./types";
import DebugPanel from "../components/debug-panel";
import { useMarketData } from "../components/market-data-context";

// Define clear interfaces for props and state
interface SearchFilterProps {
  onFilter: (instrumentKey: string) => void;
  initialValue?: string;
}

interface InstrumentOption {
  key: string;
  label: string;
}

interface TimeframeCardProps {
  title: string;
  timeframe: Timeframe;
  instrument: string;
  interval: Interval;
  refreshTrigger: number;
  onRefresh: () => void;
}

interface RealTimeCardProps {
  instrument: string;
  wsStatus: boolean;
}

interface StatsData {
  opening: number;
  closing: number;
  highest: number;
  lowest: number;
}

interface RealTimeOHLC {
  open: number;
  high: number;
  low: number;
  close: number;
  lastUpdated: string;
}

type Timeframe =
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
  | "previousYear"
  | "realTime";

const transformCandle = (candle: Candle): OHLCData => ({
  timestamp: candle[0],
  open: candle[1],
  high: candle[2],
  low: candle[3],
  close: candle[4],
});

// Search Filter Component with improved type safety
function SearchFilter({
  onFilter,
  initialValue,
}: SearchFilterProps): JSX.Element {
  const [searchTerm, setSearchTerm] = useState<string>(initialValue || "");
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const [filteredOptions, setFilteredOptions] =
    useState<InstrumentOption[]>(INSTRUMENTS);

  useEffect(() => {
    if (searchTerm) {
      const filtered = INSTRUMENTS.filter((option) =>
        option.label.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredOptions(filtered);
      setShowDropdown(true);
    } else {
      setFilteredOptions([]);
      setShowDropdown(false);
    }
  }, [searchTerm]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setSearchTerm(e.target.value);
  };

  const handleSelectOption = (option: InstrumentOption): void => {
    setSearchTerm(option.label);
    setShowDropdown(false);
    onFilter(option.key);
  };

  return (
    <div className="relative">
      {showDropdown && filteredOptions.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
          {filteredOptions.map((option) => (
            <div
              key={option.key}
              className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
              onClick={(): void => handleSelectOption(option)}
              onMouseDown={(e): void => e.preventDefault()} // Prevent input blur from firing before click
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Fixed TimeframeCard component
function TimeframeCard({
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

  const getDateRangeForTimeframe = (): { fromDate: Date; toDate: Date } => {
    const today = new Date();
    let fromDate: Date;
    let toDate: Date = today;

    switch (timeframe) {
      case "previousDay":
        // For previous day, we need to set both from and to date to yesterday
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

        // Calculate previous quarter values
        let prevQuarter, prevQuarterYear;

        if (currentQuarter === 0) {
          // If current quarter is Q1 (Jan-Mar), prev quarter is Q4 of last year
          prevQuarter = 3; // Q4
          prevQuarterYear = today.getFullYear() - 1;
        } else {
          // Otherwise, prev quarter is in the same year
          prevQuarter = currentQuarter - 1;
          prevQuarterYear = today.getFullYear();
        }

        // Calculate start month of the previous quarter (0, 3, 6, or 9)
        const prevQuarterStartMonth = prevQuarter * 3;

        // Set from date to first day of the previous quarter
        fromDate = new Date(prevQuarterYear, prevQuarterStartMonth, 1);

        // Set to date to last day of the previous quarter
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
    setIsLoading(true);
    setError(null);

    const { fromDate, toDate } = getDateRangeForTimeframe();

    // The API expects dates in format: to_date/from_date
    // Which is counter-intuitive but that's how it's designed
    const formattedFromDate = format(fromDate, "yyyy-MM-dd");
    const formattedToDate = format(toDate, "yyyy-MM-dd");

    try {
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
    <Card className="col-span-1">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
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

// Real-time OHLC Card component
function RealTimeCard({
  instrument,
  wsStatus,
}: RealTimeCardProps): JSX.Element {
  const [realTimeData, setRealTimeData] = useState<RealTimeOHLC | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize Protobuf
  useEffect(() => {
    const initProtobuf = async () => {
      try {
        const protoPath = "/marketDataFeed.proto"; // Path relative to the public folder
        const root = await protobuf.load(protoPath);
        return root;
      } catch (error) {
        console.error("Failed to initialize Protobuf:", error);
        setError("Failed to initialize WebSocket connection");
        setIsLoading(false);
        return null;
      }
    };

    initProtobuf();
  }, []);

  // Map instrument key to WebSocket instrument format
  const getWebSocketInstrumentKey = (upstoxInstrument: string): string => {
    // This mapping function should be customized based on your specific instrument keys
    // Format: "NSE_EQ|INE669E01016" or similar
    const instrumentMap: Record<string, string> = {
      // Add mappings for your instruments here
      "NSE_INDEX|Nifty 50": "NSE_INDEX|Nifty 50",
      "NSE_INDEX|Nifty Bank": "NSE_INDEX|Nifty Bank",
      "NSE_EQ|INE669E01016": "NSE_EQ|INE669E01016", // Example
    };

    return instrumentMap[upstoxInstrument] || "NSE_INDEX|Nifty 50"; // Default fallback
  };

  // Function to get WebSocket URL
  const getWebSocketUrl = async (): Promise<string> => {
    try {
      const response = await fetch(`/api/ws-auth`);

      if (!response.ok) {
        throw new Error("Failed to get WebSocket URL");
      }

      const res = await response.json();
      return res.data.authorizedRedirectUri;
    } catch (error) {
      console.error("Error getting WebSocket URL:", error);
      throw error;
    }
  };

  // Helper functions for handling Blob and ArrayBuffer
  const blobToArrayBuffer = async (blob: Blob): Promise<ArrayBuffer> => {
    if ("arrayBuffer" in blob) return await blob.arrayBuffer();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () =>
        reject(new Error("Failed to read blob as array buffer"));
      reader.readAsArrayBuffer(blob);
    });
  };

  // Connect to WebSocket
  useEffect(() => {
    let ws: WebSocket | null = null;
    let protobufRoot: any = null;

    const connectWebSocket = async () => {
      try {
        setIsLoading(true);

        // Load protobuf definition
        protobufRoot = await protobuf.load("/marketDataFeed.proto");
        if (!protobufRoot) {
          throw new Error("Failed to load Protobuf definition");
        }

        // Get WebSocket URL
        const wsUrl = await getWebSocketUrl();
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          setIsConnected(true);
          setIsLoading(false);
          console.log("WebSocket connected");

          const instrumentKey = getWebSocketInstrumentKey(instrument);

          // Subscribe to instrument data
          const data = {
            guid: "tradingview-realtime",
            method: "sub",
            data: {
              mode: "full",
              instrumentKeys: [instrumentKey],
            },
          };

          if (ws) {
            ws.send(Buffer.from(JSON.stringify(data)));
          } else {
            console.error("WebSocket is not initialized.");
          }
        };

        ws.onclose = () => {
          setIsConnected(false);
          console.log("WebSocket disconnected");
        };

        ws.onmessage = async (event) => {
          try {
            const arrayBuffer = await blobToArrayBuffer(event.data);
            const buffer = Buffer.from(arrayBuffer);

            // Decode protobuf message
            const FeedResponse = protobufRoot.lookupType(
              "com.upstox.marketdatafeeder.rpc.proto.FeedResponse"
            );

            const response = FeedResponse.decode(buffer);

            // Extract OHLC data from the response
            // Note: This extraction logic may need to be adjusted based on the actual structure
            if (response && response.feeds && response.feeds.length > 0) {
              const feed = response.feeds[0];

              // Example extraction - adjust based on actual response structure
              if (feed.marketFullFeed) {
                const marketData = feed.marketFullFeed;

                setRealTimeData({
                  open: parseFloat(marketData.ohlc?.open || "0"),
                  high: parseFloat(marketData.ohlc?.high || "0"),
                  low: parseFloat(marketData.ohlc?.low || "0"),
                  close: parseFloat(marketData.ohlc?.close || "0"),
                  lastUpdated: new Date().toLocaleTimeString(),
                });
              }
            }
          } catch (error) {
            console.error("Error processing WebSocket message:", error);
          }
        };

        ws.onerror = (error) => {
          setIsConnected(false);
          setError("WebSocket connection error");
          setIsLoading(false);
          console.error("WebSocket error:", error);
        };
      } catch (error) {
        setIsConnected(false);
        setError("Failed to establish WebSocket connection");
        setIsLoading(false);
        console.error("WebSocket connection error:", error);
      }
    };

    connectWebSocket();

    // Cleanup function
    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [instrument]);

  if (isLoading) {
    return (
      <Card className="col-span-1">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Real-Time OHLC</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !isConnected) {
    return (
      <Card className="col-span-1">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium">Real-Time OHLC</CardTitle>
          <Badge variant="outline" className="text-red-500 border-red-500">
            Disconnected
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-gray-500">
            {error || "WebSocket connection unavailable"}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-1">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">Real-Time OHLC</CardTitle>
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="text-green-500 border-green-500">
            Live
          </Badge>
          <Activity className="h-4 w-4 text-green-500 animate-pulse" />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {realTimeData ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-xs text-gray-500">Open</span>
                <div className="text-lg font-bold">
                  {realTimeData.open.toFixed(2)}
                </div>
              </div>
              <div>
                <span className="text-xs text-gray-500">Close</span>
                <div className="text-lg font-bold">
                  {realTimeData.close.toFixed(2)}
                </div>
              </div>
              <div>
                <span className="text-xs text-gray-500">High</span>
                <div className="text-lg font-bold">
                  {realTimeData.high.toFixed(2)}
                </div>
              </div>
              <div>
                <span className="text-xs text-gray-500">Low</span>
                <div className="text-lg font-bold">
                  {realTimeData.low.toFixed(2)}
                </div>
              </div>
            </div>
            <div className="text-xs text-gray-500 text-right mt-2">
              Last updated: {realTimeData.lastUpdated}
            </div>
          </>
        ) : (
          <div className="text-sm text-gray-500">Waiting for data...</div>
        )}
      </CardContent>
    </Card>
  );
}

function TimeframeTable({
  instrument,
  interval,
  refreshTrigger,
  onRefresh,
  timeframes,
}: {
  instrument: string;
  interval: Interval;
  refreshTrigger: number;
  onRefresh: () => void;
  timeframes: { title: string; id: Timeframe }[];
}): JSX.Element {
  const [timeframeData, setTimeframeData] = useState<
    Record<string, StatsData | null>
  >({});
  const [multiStockData, setMultiStockData] = useState<
    Record<string, Record<string, StatsData | null>>
  >({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [realTimePrice, setRealTimePrice] = useState<number | null>(null);
  const { isConnected, marketData } = useMarketData();
  const isAllStocks = instrument === "all";

  console.log(
    "TimeframeTable rendered with instrument:",
    instrument,
    "isAllStocks:",
    isAllStocks
  );

  // Fetch data for single stock across all timeframes
  useEffect(() => {
    if (isAllStocks) {
      console.log(
        "Skipping single stock data fetch because 'all stocks' is selected"
      );
      return;
    }

    console.log(
      "Fetching data for single stock:",
      instrument,
      "across all timeframes"
    );

    const fetchAllData = async () => {
      setIsLoading(true);
      const newData: Record<string, StatsData | null> = {};

      // Fetch data for each timeframe
      for (const tf of timeframes) {
        if (tf.id === "realTime") continue; // Skip realTime as it's handled separately

        try {
          console.log(`Fetching data for timeframe: ${tf.title} (${tf.id})`);
          const data = await fetchTimeframeData(tf.id, instrument);
          newData[tf.id] = data;
        } catch (err) {
          console.error(`Error fetching data for ${tf.title}:`, err);
          newData[tf.id] = null;
        }
      }

      console.log("Single stock data fetched:", newData);
      setTimeframeData(newData);
      setIsLoading(false);
    };

    fetchAllData();
  }, [instrument, interval, refreshTrigger, timeframes, isAllStocks]);

  // Fetch data for all stocks for a specific timeframe (when "all" is selected)
  useEffect(() => {
    if (!isAllStocks) {
      console.log(
        "Skipping all stocks data fetch because a specific stock is selected"
      );
      return;
    }

    console.log("Fetching data for ALL stocks across timeframes");

    const fetchAllStocksData = async () => {
      setIsLoading(true);
      const newData: Record<string, Record<string, StatsData | null>> = {};

      for (const tf of timeframes) {
        if (tf.id === "realTime") continue;

        console.log(
          `Processing timeframe: ${tf.title} (${tf.id}) for all stocks`
        );
        newData[tf.id] = {};

        // Fetch each instrument for this timeframe
        // For performance during debugging, limit to first 3 instruments
        const limitedInstruments = INSTRUMENTS.slice(0, 3);

        for (const inst of limitedInstruments) {
          try {
            console.log(
              `Fetching data for instrument: ${inst.label} (${inst.key}) in timeframe ${tf.id}`
            );
            const data = await fetchTimeframeData(tf.id, inst.key);
            newData[tf.id][inst.key] = data;
          } catch (err) {
            console.error(
              `Error fetching data for ${inst.label} (${tf.title}):`,
              err
            );
            newData[tf.id][inst.key] = null;
          }
        }
      }

      console.log("All stocks data fetched:", newData);
      setMultiStockData(newData);
      setIsLoading(false);
    };

    fetchAllStocksData();
  }, [interval, refreshTrigger, timeframes, isAllStocks]);

  // Add effect to update real-time price
  useEffect(() => {
    if (!isConnected || !marketData || !marketData[instrument] || isAllStocks) {
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
        setRealTimePrice(price);
      }
    };

    // Initial update
    handlePriceUpdate();

    // Set up interval to update price every second
    const interval = setInterval(handlePriceUpdate, 1000);

    // Clean up interval on unmount or when deps change
    return () => clearInterval(interval);
  }, [isConnected, marketData, instrument, isAllStocks]);

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

  const fetchTimeframeData = async (
    timeframe: Timeframe,
    instrumentKey: string
  ): Promise<StatsData | null> => {
    try {
      const { fromDate, toDate } = getDateRangeForTimeframe(timeframe);

      // The API expects dates in format: to_date/from_date
      const formattedFromDate = format(fromDate, "yyyy-MM-dd");
      const formattedToDate = format(toDate, "yyyy-MM-dd");

      console.log(
        `API Request for ${instrumentKey}, timeframe ${timeframe}: from=${formattedFromDate}, to=${formattedToDate}`
      );

      const response = await fetch(
        `/api/historical-data?instrument=${encodeURIComponent(
          instrumentKey
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
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

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

        console.log(
          `Data fetched for ${instrumentKey}, timeframe ${timeframe}:`,
          data
        );
        return data;
      }

      console.log(
        `No data available for ${instrumentKey}, timeframe ${timeframe}`
      );
      return null;
    } catch (error) {
      console.error(
        `Error fetching data for ${timeframe} (${instrumentKey}):`,
        error
      );
      return null;
    }
  };

  const handleRefresh = (): void => {
    onRefresh();
  };

  // Calculate change data
  const calculateChangeData = (data: StatsData) => {
    if (!data) return { changeValue: 0, changePercent: 0 };

    const changeValue = data.closing - data.opening;
    const changePercent = (changeValue / data.opening) * 100;

    return {
      changeValue,
      changePercent,
    };
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <RefreshCw className="h-6 w-6 animate-spin text-gray-400 mx-auto mb-2" />
        <p>Loading OHLC data{isAllStocks ? " for all stocks" : ""}...</p>
      </div>
    );
  }

  if (error) {
    return <div className="text-center text-red-500 py-8">{error}</div>;
  }

  console.log("Rendering TimeframeTable, isAllStocks:", isAllStocks);

  // Render table for single stock (selected instrument)
  if (!isAllStocks) {
    console.log("Rendering single stock table view");

    return (
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
              if (tf.id === "realTime") {
                // Skip or handle real-time data differently if needed
                return null;
              }

              const data = timeframeData[tf.id];
              if (!data) {
                return (
                  <TableRow key={tf.id}>
                    <TableCell className="font-medium">{tf.title}</TableCell>
                    <TableCell colSpan={5} className="text-gray-500">
                      No data available
                    </TableCell>
                  </TableRow>
                );
              }

              const { changeValue, changePercent } = calculateChangeData(data);
              const isPositive = changeValue > 0;
              const isNegative = changeValue < 0;
              const changeColorClass = isPositive
                ? "text-green-600"
                : isNegative
                ? "text-red-600"
                : "text-gray-600";

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
    );
  }

  // Render tables for all timeframes with all stocks
  console.log("Rendering all stocks view with tabs");
  console.log(
    "Available timeframes:",
    timeframes.map((tf) => tf.title).join(", ")
  );
  console.log(
    "Available multi-stock data:",
    Object.keys(multiStockData).join(", ")
  );

  return (
    <div className="space-y-8">
      <Tabs defaultValue="previousDay">
        <TabsList className="mb-4 flex flex-wrap">
          {timeframes.map((tf) => {
            if (tf.id === "realTime") return null; // Skip realTime
            return (
              <TabsTrigger key={tf.id} value={tf.id}>
                {tf.title}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {timeframes.map((tf) => {
          if (tf.id === "realTime") return null; // Skip realTime

          const tfData = multiStockData[tf.id] || {};
          const hasData = Object.keys(tfData).length > 0;

          return (
            <TabsContent key={tf.id} value={tf.id}>
              <div className="overflow-x-auto">
                <h3 className="text-lg font-semibold mb-2">
                  {tf.title} OHLC Data for All Instruments
                </h3>
                {!hasData ? (
                  <div className="text-center py-4 text-gray-500">
                    No data available for this timeframe
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[200px]">Instrument</TableHead>
                        <TableHead>Open</TableHead>
                        <TableHead>High</TableHead>
                        <TableHead>Low</TableHead>
                        <TableHead>Close</TableHead>
                        <TableHead>Change</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(tfData).map(([instKey, data]) => {
                        if (!data) {
                          const instLabel =
                            INSTRUMENTS.find((inst) => inst.key === instKey)
                              ?.label || instKey;
                          return (
                            <TableRow key={instKey}>
                              <TableCell className="font-medium">
                                {instLabel}
                              </TableCell>
                              <TableCell colSpan={5} className="text-gray-500">
                                No data available
                              </TableCell>
                            </TableRow>
                          );
                        }

                        const instLabel =
                          INSTRUMENTS.find((inst) => inst.key === instKey)
                            ?.label || instKey;
                        const { changeValue, changePercent } =
                          calculateChangeData(data);
                        const isPositive = changeValue > 0;
                        const isNegative = changeValue < 0;
                        const changeColorClass = isPositive
                          ? "text-green-600"
                          : isNegative
                          ? "text-red-600"
                          : "text-gray-600";

                        return (
                          <TableRow key={instKey}>
                            <TableCell className="font-medium">
                              {instLabel}
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
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}

export default function TradingView(): JSX.Element {
  const [interval, setInterval] = useState<Interval>("day");
  const [instrument, setInstrument] = useState<string>(INSTRUMENTS[0].key);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [wsStatus, setWsStatus] = useState<boolean>(false);

  useEffect(() => {
    console.log("Current instrument:", instrument);
    console.log("Is All Stocks selected:", instrument === "all");
  }, [instrument]);

  const handleFilterInstrument = (instrumentKey: string): void => {
    console.log("Setting instrument to:", instrumentKey);
    setInstrument(instrumentKey);
  };

  const handleGlobalRefresh = (): void => {
    console.log("Refreshing data...");
    setRefreshTrigger((prev) => prev + 1);
  };

  const showAllStocks = (): void => {
    console.log("Switching to All Stocks View");
    setInstrument("all");
  };

  // Find the current instrument label for initializing the search field
  const currentInstrumentLabel =
    instrument === "all"
      ? "All Stocks"
      : INSTRUMENTS.find((inst) => inst.key === instrument)?.label || "";

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

  const isAllStocks = instrument === "all";

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Select Instrument
          </label>
          <Select value={instrument} onValueChange={setInstrument}>
            <SelectTrigger>
              <SelectValue placeholder="Select instrument" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stocks</SelectItem>
              {INSTRUMENTS.map((inst) => (
                <SelectItem key={inst.key} value={inst.key}>
                  {inst.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Interval</label>
          <Select
            value={interval}
            onValueChange={(value): void => setInterval(value as Interval)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select interval" />
            </SelectTrigger>
            <SelectContent>
              {INTERVALS.map((int) => (
                <SelectItem key={int.value} value={int.value}>
                  {int.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-end">
          <Button onClick={handleGlobalRefresh} className="w-full">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Data
          </Button>
        </div>

        <div className="flex items-end">
          <Button
            onClick={showAllStocks}
            className="w-full"
            variant={isAllStocks ? "default" : "outline"}
          >
            View All Stocks
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">
            {instrument === "all"
              ? "OHLC Data for All Stocks"
              : `OHLC Data for ${currentInstrumentLabel}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isAllStocks ? (
            <AllStocksTable
              instruments={INSTRUMENTS}
              interval={interval}
              refreshTrigger={refreshTrigger}
              timeframes={timeframes}
            />
          ) : (
            <SingleStockTable
              instrument={instrument}
              interval={interval}
              refreshTrigger={refreshTrigger}
              timeframes={timeframes}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Table for a single stock showing all timeframes
function SingleStockTable({
  instrument,
  interval,
  refreshTrigger,
  timeframes,
}: {
  instrument: string;
  interval: Interval;
  refreshTrigger: number;
  timeframes: { title: string; id: Timeframe }[];
}): JSX.Element {
  const [data, setData] = useState<Record<string, StatsData | null>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch data for all timeframes
  useEffect(() => {
    const fetchAllData = async () => {
      setIsLoading(true);
      const newData: Record<string, StatsData | null> = {};

      // Fetch data for each timeframe
      for (const tf of timeframes) {
        try {
          const data = await fetchTimeframeData(tf.id, instrument, interval);
          newData[tf.id] = data;
        } catch (err) {
          console.error(`Error fetching data for ${tf.title}:`, err);
          newData[tf.id] = null;
        }
      }

      setData(newData);
      setIsLoading(false);
    };

    fetchAllData();
  }, [instrument, interval, refreshTrigger, timeframes]);

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <RefreshCw className="h-6 w-6 animate-spin text-gray-400 mx-auto mb-2" />
        <p>Loading OHLC data...</p>
      </div>
    );
  }

  if (error) {
    return <div className="text-center text-red-500 py-8">{error}</div>;
  }

  return (
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
            const tfData = data[tf.id];

            if (!tfData) {
              return (
                <TableRow key={tf.id}>
                  <TableCell className="font-medium">{tf.title}</TableCell>
                  <TableCell colSpan={5} className="text-gray-500">
                    No data available
                  </TableCell>
                </TableRow>
              );
            }

            const change = tfData.closing - tfData.opening;
            const percentChange = (change / tfData.opening) * 100;
            const isPositive = change > 0;
            const isNegative = change < 0;
            const changeColorClass = isPositive
              ? "text-green-600"
              : isNegative
              ? "text-red-600"
              : "text-gray-600";

            return (
              <TableRow key={tf.id}>
                <TableCell className="font-medium">{tf.title}</TableCell>
                <TableCell>{tfData.opening.toFixed(2)}</TableCell>
                <TableCell>{tfData.highest.toFixed(2)}</TableCell>
                <TableCell>{tfData.lowest.toFixed(2)}</TableCell>
                <TableCell>{tfData.closing.toFixed(2)}</TableCell>
                <TableCell className={changeColorClass}>
                  {isPositive ? "+" : ""}
                  {change.toFixed(2)} ({isPositive ? "+" : ""}
                  {percentChange.toFixed(2)}%)
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

// Table for all stocks showing data for a specific timeframe
function AllStocksTable({
  instruments,
  interval,
  refreshTrigger,
  timeframes,
}: {
  instruments: { key: string; label: string }[];
  interval: Interval;
  refreshTrigger: number;
  timeframes: { title: string; id: Timeframe }[];
}): JSX.Element {
  const [selectedTimeframe, setSelectedTimeframe] =
    useState<Timeframe>("previousDay");
  const [stocksData, setStocksData] = useState<
    Record<string, StatsData | null>
  >({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Get timeframe title
  const timeframeTitle =
    timeframes.find((tf) => tf.id === selectedTimeframe)?.title || "";

  // Fetch data for the selected timeframe for all stocks
  useEffect(() => {
    const fetchStocksData = async () => {
      setIsLoading(true);
      const newData: Record<string, StatsData | null> = {};

      // Fetch data for each instrument
      for (const inst of instruments) {
        try {
          const data = await fetchTimeframeData(
            selectedTimeframe,
            inst.key,
            interval
          );
          newData[inst.key] = data;
        } catch (err) {
          console.error(`Error fetching data for ${inst.label}:`, err);
          newData[inst.key] = null;
        }
      }

      setStocksData(newData);
      setIsLoading(false);
    };

    fetchStocksData();
  }, [instruments, interval, refreshTrigger, selectedTimeframe]);

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <RefreshCw className="h-6 w-6 animate-spin text-gray-400 mx-auto mb-2" />
        <p>Loading data for {timeframeTitle}...</p>
      </div>
    );
  }

  if (error) {
    return <div className="text-center text-red-500 py-8">{error}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 mb-4">
        {timeframes.map((tf) => (
          <Button
            key={tf.id}
            variant={selectedTimeframe === tf.id ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedTimeframe(tf.id)}
          >
            {tf.title}
          </Button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Instrument</TableHead>
              <TableHead>Open</TableHead>
              <TableHead>High</TableHead>
              <TableHead>Low</TableHead>
              <TableHead>Close</TableHead>
              <TableHead>Change</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {instruments.map((inst) => {
              const data = stocksData[inst.key];

              if (!data) {
                return (
                  <TableRow key={inst.key}>
                    <TableCell className="font-medium">{inst.label}</TableCell>
                    <TableCell colSpan={5} className="text-gray-500">
                      No data available
                    </TableCell>
                  </TableRow>
                );
              }

              const change = data.closing - data.opening;
              const percentChange = (change / data.opening) * 100;
              const isPositive = change > 0;
              const isNegative = change < 0;
              const changeColorClass = isPositive
                ? "text-green-600"
                : isNegative
                ? "text-red-600"
                : "text-gray-600";

              return (
                <TableRow key={inst.key}>
                  <TableCell className="font-medium">{inst.label}</TableCell>
                  <TableCell>{data.opening.toFixed(2)}</TableCell>
                  <TableCell>{data.highest.toFixed(2)}</TableCell>
                  <TableCell>{data.lowest.toFixed(2)}</TableCell>
                  <TableCell>{data.closing.toFixed(2)}</TableCell>
                  <TableCell className={changeColorClass}>
                    {isPositive ? "+" : ""}
                    {change.toFixed(2)} ({isPositive ? "+" : ""}
                    {percentChange.toFixed(2)}%)
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

async function fetchTimeframeData(
  timeframe: Timeframe,
  instrumentKey: string,
  interval: Interval
): Promise<StatsData | null> {
  try {
    const { fromDate, toDate } = getDateRangeForTimeframe(timeframe);

    // The API expects dates in format: to_date/from_date
    const formattedFromDate = format(fromDate, "yyyy-MM-dd");
    const formattedToDate = format(toDate, "yyyy-MM-dd");

    const response = await fetch(
      `/api/historical-data?instrument=${encodeURIComponent(
        instrumentKey
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
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      return {
        // Opening price is the first candle's open (earliest date)
        opening: candles[candles.length - 1].open,
        // Closing price is the last candle's close (latest date)
        closing: candles[0].close,
        // Highest is max of all high prices in timeframe
        highest: Math.max(...candles.map((d) => d.high)),
        // Lowest is min of all low prices in timeframe
        lowest: Math.min(...candles.map((d) => d.low)),
      };
    }

    return null;
  } catch (error) {
    console.error(
      `Error fetching data for ${timeframe} (${instrumentKey}):`,
      error
    );
    return null;
  }
}

function getDateRangeForTimeframe(timeframe: Timeframe): {
  fromDate: Date;
  toDate: Date;
} {
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
}
