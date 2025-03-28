"use client";

import { useState, useEffect } from "react";
import { Search, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { INSTRUMENTS, INTERVALS } from "./constants";
import { Interval } from "./types";
import { TimeframeCard, Timeframe } from "../components/TimeFrameCard";
import { MarketDataProvider, useMarketData } from "@/hooks/useMarketData";

// Define interface for SearchFilter props
interface SearchFilterProps {
  onFilter: (instrumentKey: string) => void;
  initialValue?: string;
}

interface InstrumentOption {
  key: string;
  label: string;
}

// SearchFilter component
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

// Inner TradingView component with market data
function TradingViewInner(): JSX.Element {
  const [interval, setInterval] = useState<Interval>("day");
  const [instrument, setInstrument] = useState<string>(INSTRUMENTS[0].key);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const { isConnected, subscribeToInstruments } = useMarketData();

  const handleFilterInstrument = (instrumentKey: string): void => {
    setInstrument(instrumentKey);

    // If connected to WebSocket, subscribe to the selected instrument
    if (isConnected) {
      // Convert instrument key format if necessary
      let wsInstrumentKey = instrumentKey;
      if (instrumentKey.includes("%7C")) {
        wsInstrumentKey = instrumentKey.replace("%7C", "|").replace("%20", " ");
      }
      subscribeToInstruments([wsInstrumentKey]);
    }
  };

  const handleGlobalRefresh = (): void => {
    setRefreshTrigger((prev) => prev + 1);
  };

  // Find the current instrument label for initializing the search field
  const currentInstrumentLabel =
    INSTRUMENTS.find((inst) => inst.key === instrument)?.label || "";

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

  return (
    <div className="space-y-8">
      {isConnected ? (
        <Alert className="bg-green-50 border-green-200">
          <RefreshCw className="h-4 w-4 text-green-500" />
          <AlertTitle>Real-time data connected</AlertTitle>
          <AlertDescription>
            Live market data is available for Today, 3-Day, Current Week, and
            Current Month timeframes.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="bg-amber-50 border-amber-200">
          <WifiOff className="h-4 w-4 text-amber-500" />
          <AlertTitle>Real-time data not available</AlertTitle>
          <AlertDescription>
            Using historical data only. Check your connection or API token.
          </AlertDescription>
        </Alert>
      )}

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
        {timeframes.map((tf) => (
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
    </div>
  );
}

// Wrapper component that provides MarketDataProvider
export default function TradingViewPage(): JSX.Element {
  // You could fetch the token from an environment variable or API
  const accessToken =
    "eyJ0eXAiOiJKV1QiLCJrZXlfaWQiOiJza192MS4wIiwiYWxnIjoiSFMyNTYifQ.eyJzdWIiOiIzS0NIRUYiLCJqdGkiOiI2N2U1NGYxY2E4ZTMwMzUyMTRlMTQyNmIiLCJpc011bHRpQ2xpZW50IjpmYWxzZSwiaWF0IjoxNzQzMDgxMjQ0LCJpc3MiOiJ1ZGFwaS1nYXRld2F5LXNlcnZpY2UiLCJleHAiOjE3NDMxMTI4MDB9.7wB5Th35jUAzageON1B2ddIewUsyskiTWTupmGaYaZI";

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-8">Multi-Timeframe OHLC</h1>

      <MarketDataProvider>
        <TradingViewInner />
      </MarketDataProvider>
    </div>
  );
}
