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

import { INSTRUMENTS, INTERVALS } from "./constants";
import { Interval, OHLCData, APIResponse, Candle } from "./types";
import DebugPanel from "../components/debug-panel";

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
      <label className="block text-sm font-medium mb-2">
        Search Instrument
      </label>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-gray-400" />
        </div>
        <input
          type="text"
          className="border rounded-md pl-10 py-2 w-full focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="Search instruments..."
          value={searchTerm}
          onChange={handleSearchChange}
          onFocus={(): void => {
            if (searchTerm) setShowDropdown(true);
          }}
          onBlur={(): void => {
            // Delay hiding dropdown to allow click events to register
            setTimeout(() => setShowDropdown(false), 200);
          }}
        />
      </div>

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

export default function TradingView(): JSX.Element {
  const [interval, setInterval] = useState<Interval>("day");
  const [instrument, setInstrument] = useState<string>(INSTRUMENTS[0].key);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [wsStatus, setWsStatus] = useState<boolean>(false);

  const handleFilterInstrument = (instrumentKey: string): void => {
    setInstrument(instrumentKey);
  };

  const handleGlobalRefresh = (): void => {
    setRefreshTrigger((prev) => prev + 1);
  };

  // Find the current instrument label for initializing the search field
  const currentInstrumentLabel =
    INSTRUMENTS.find((inst) => inst.key === instrument)?.label || "";

  const timeframes: { title: string; id: Timeframe }[] = [
    { title: "Real-Time", id: "realTime" },
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

  return (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Search filter component */}
        <SearchFilter
          onFilter={handleFilterInstrument}
          initialValue={currentInstrumentLabel}
        />

        <div>
          <label className="block text-sm font-medium mb-2">
            Select Instrument
          </label>
          <Select value={instrument} onValueChange={setInstrument}>
            <SelectTrigger>
              <SelectValue placeholder="Select instrument" />
            </SelectTrigger>
            <SelectContent>
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
            Refresh All Data
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Real-time data as the first card */}
        <RealTimeCard instrument={instrument} wsStatus={wsStatus} />

        {/* Display all other timeframe cards except real-time which is handled separately */}
        {timeframes
          .filter((tf) => tf.id !== "realTime")
          .map((tf) => (
            <TimeframeCard
              key={`${tf.id}-${refreshTrigger}`}
              title={tf.title}
              timeframe={tf.id}
              instrument={instrument}
              interval={interval}
              refreshTrigger={refreshTrigger}
              onRefresh={handleGlobalRefresh}
            />
          ))}
      </div>

      <DebugPanel />
    </div>
  );
}
