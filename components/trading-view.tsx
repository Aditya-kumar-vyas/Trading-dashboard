"use client";

import React, { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { Search, RefreshCw, WifiOff, Activity, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { INSTRUMENTS, INTERVALS } from "@/app/constants";
import { Interval, Timeframe, OHLCData, APIResponse } from "@/app/types";
import { ATR_TYPES } from "../app/constants";
import { transformCandle } from "@/lib/utils";
import { useMarketData } from "./market-data-context";
import SearchFilter from "./search-filter";
import TimeframeCard from "./timeframe-card";
import MorningRangeBreakoutCard from "./morning-range-breakout-card";
import TechnicalIndicatorCard from "./indicator-card";
import PivotCard from "./pivot-grid";
import StockScanner from "./stock-scanner";
import TimeframeTable from "./timeframe-table";
import TechnicalIndicatorsTable from "./technical-indicators-table";
import { PivotType } from "../lib/indicator";
import { INDEX_TO_STOCKS, getStocksForIndex } from "../app/indices-stocks";

export default function TradingView(): JSX.Element {
  const [interval, setInterval] = useState<Interval>("day");
  const [instrument, setInstrument] = useState<string>(INSTRUMENTS[0].key);
  const [selectedInstruments, setSelectedInstruments] = useState<string[]>([]);

  // Set default selected index to NIFTY 50
  const defaultIndex = "NIFTY 50";
  const [selectedIndex, setSelectedIndex] = useState<string | null>(
    defaultIndex
  );
  const [indexStocks, setIndexStocks] = useState<
    { key: string; label: string }[]
  >([]);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<string>("timeframes");
  const [candleData, setCandleData] = useState<OHLCData[]>([]);
  const { isConnected, marketData, subscribeToInstruments } = useMarketData();

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

  // Automatically subscribe to the selected instruments when WebSocket is connected
  useEffect(() => {
    if (isConnected) {
      // Convert instrument keys format if necessary
      const wsInstrumentKeys = selectedInstruments.map((instrument) => {
        let wsInstrumentKey = instrument;
        if (instrument.includes("%7C")) {
          wsInstrumentKey = instrument
            .replace(/%7C/g, "|")
            .replace(/%20/g, " ");
        }
        return wsInstrumentKey;
      });

      subscribeToInstruments(wsInstrumentKeys);
    }
  }, [isConnected, selectedInstruments]);

  // Fetch historical data when instrument changes or on manual refresh
  useEffect(() => {
    fetchHistoricalData();
  }, [instrument, refreshTrigger]);

  // Get all the indices
  const indexInstruments = useMemo(() => {
    return INSTRUMENTS.filter((inst) =>
      Object.keys(INDEX_TO_STOCKS).some(
        (indexName) => inst.label.toLowerCase() === indexName.toLowerCase()
      )
    );
  }, []);

  // Update available stocks when selected index changes
  useEffect(() => {
    if (selectedIndex) {
      // Find the actual index name in the INDEX_TO_STOCKS keys
      const indexName = Object.keys(INDEX_TO_STOCKS).find(
        (key) => key.toLowerCase() === selectedIndex.toLowerCase()
      );

      if (indexName) {
        const stocks = getStocksForIndex(indexName);
        setIndexStocks(stocks);

        // Find the index instrument to show its data
        const indexInstrument = INSTRUMENTS.find(
          (inst) => inst.label.toLowerCase() === indexName.toLowerCase()
        );

        if (indexInstrument) {
          // Set the instrument to the index itself
          setInstrument(indexInstrument.key);
        }
      }
    } else {
      setIndexStocks([]);
    }
  }, [selectedIndex]);

  // Initialize the selected index on component mount
  useEffect(() => {
    // Find the instrument key for the default index
    const indexInstrument = INSTRUMENTS.find(
      (inst) => inst.label.toLowerCase() === defaultIndex.toLowerCase()
    );

    if (indexInstrument) {
      setSelectedInstruments([indexInstrument.key]);
      setSelectedIndex(defaultIndex);

      // Set the instrument to the index itself instead of the first stock
      setInstrument(indexInstrument.key);

      // Subscribe to the index and its stocks
      const stocks = getStocksForIndex(defaultIndex);
      const stockKeys = stocks.map((stock) => stock.key);
      subscribeToInstruments([indexInstrument.key, ...stockKeys]);
    }
  }, []);

  const handleFilterInstrument = (instrumentKeys: string[]): void => {
    // For the index selector, we only want to select one index at a time
    if (instrumentKeys.length > 0) {
      for (const key of instrumentKeys) {
        const instrument = INSTRUMENTS.find((inst) => inst.key === key);
        if (instrument) {
          const matchedIndex = Object.keys(INDEX_TO_STOCKS).find(
            (indexName) =>
              indexName.toLowerCase() === instrument.label.toLowerCase()
          );

          if (matchedIndex) {
            // Set the selected index
            setSelectedIndex(matchedIndex);

            // Don't store the instruments here, we're just selecting the index
            setSelectedInstruments([key]);

            // Set the primary instrument to be the index itself
            setInstrument(key);

            // Subscribe to all stocks in this index plus the index itself
            const indexStocks = getStocksForIndex(matchedIndex);
            const stockKeys = indexStocks.map((stock) => stock.key);

            // Subscribe to all these stocks and the index
            const allKeys = [key, ...stockKeys];
            subscribeToInstruments(allKeys);
            return;
          }
        }
      }

      // If we got here, no index was selected, clear the index selection
      setSelectedIndex(null);
      setSelectedInstruments(instrumentKeys);
    } else {
      // No selections, clear everything
      setSelectedIndex(null);
      setSelectedInstruments([]);
    }
  };

  const handleGlobalRefresh = (): void => {
    setRefreshTrigger((prev) => prev + 1);
  };

  // Find the current index label for initializing the search field
  const currentIndexLabel = selectedIndex || "";

  const fetchHistoricalData = async () => {
    try {
      // Default to 1 year of data for indicators
      const today = new Date();
      const lastYear = new Date();
      lastYear.setFullYear(today.getFullYear() - 1);

      // Format dates for API
      const formattedToDate = format(today, "yyyy-MM-dd");
      const formattedFromDate = format(lastYear, "yyyy-MM-dd");

      const response = await fetch(
        `/api/historical-data?instrument=${encodeURIComponent(
          instrument
        )}&interval=${interval}&to_date=${formattedToDate}&from_date=${formattedFromDate}`
      );

      if (!response.ok) {
        throw new Error("Failed to fetch historical data");
      }

      const result: APIResponse = await response.json();

      if (
        result.status === "success" &&
        result.data.candles &&
        result.data.candles.length > 0
      ) {
        const candles = result.data.candles.map(transformCandle);
        setCandleData(candles);
      } else {
        console.warn("No historical data available");
        setCandleData([]);
      }
    } catch (error) {
      console.error("Error fetching historical data:", error);
      setCandleData([]);
    }
  };

  // Check if the current instrument is an index
  const isInstrumentIndex = useMemo(() => {
    return indexInstruments.some((indexInst) => indexInst.key === instrument);
  }, [instrument, indexInstruments]);

  // Watch for index changes to update tab selection if needed
  useEffect(() => {
    // If the user previously had the indicators tab selected but switched to a non-index
    // we should switch them to another tab
    if (activeTab === "indicators" && !isInstrumentIndex) {
      setActiveTab("timeframes");
    }
  }, [activeTab, isInstrumentIndex]);

  // Add this before the return statement
  // Adjust the TabsList grid columns based on whether the indicators tab is available
  const tabsGridCols = isInstrumentIndex
    ? "grid-cols-2 md:grid-cols-5"
    : "grid-cols-2 md:grid-cols-4";

  return (
    <div className="space-y-8 dark:bg-gray-900 dark:text-gray-100">
      {isConnected ? (
        <Alert className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800 dark:text-green-100">
          <Activity className="h-4 w-4 text-green-500 dark:text-green-400" />
          <AlertTitle>Real-time data connected</AlertTitle>
          <AlertDescription>
            Live market data is available for Today's timeframe.
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-100">
          <WifiOff className="h-4 w-4 text-amber-500 dark:text-amber-400" />
          <AlertTitle>Real-time data not available</AlertTitle>
          <AlertDescription>
            Using historical data only. Check your connection or API token.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Search filter component for indices */}
        <div>
          <label className="block text-sm font-medium mb-2 dark:text-gray-300">
            Search Instrument
          </label>
          <SearchFilter
            onFilter={handleFilterInstrument}
            initialValue={currentIndexLabel}
            prioritizeIndices={true}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 dark:text-gray-300">
            Select Stock
          </label>
          <Select value={instrument} onValueChange={setInstrument}>
            <SelectTrigger className="dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200">
              <SelectValue placeholder="Select stock" />
            </SelectTrigger>
            <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
              {selectedIndex && (
                <SelectItem
                  key={`index-${selectedIndex}`}
                  value={
                    INSTRUMENTS.find(
                      (inst) =>
                        inst.label.toLowerCase() === selectedIndex.toLowerCase()
                    )?.key || ""
                  }
                  className="dark:text-gray-200 dark:hover:bg-gray-700 font-bold border-b border-gray-200 dark:border-gray-700"
                >
                  {selectedIndex} (Index)
                </SelectItem>
              )}
              {indexStocks.map((inst) => (
                <SelectItem
                  key={inst.key}
                  value={inst.key}
                  className="dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  {inst.label}
                </SelectItem>
              ))}
              {indexStocks.length === 0 &&
                !selectedIndex &&
                INSTRUMENTS.map((inst) => (
                  <SelectItem
                    key={inst.key}
                    value={inst.key}
                    className="dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    {inst.label}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 dark:text-gray-300">
            Interval
          </label>
          <Select
            value={interval}
            onValueChange={(value): void => setInterval(value as Interval)}
          >
            <SelectTrigger className="dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200">
              <SelectValue placeholder="Select interval" />
            </SelectTrigger>
            <SelectContent className="dark:bg-gray-800 dark:border-gray-700">
              {INTERVALS.map((int) => (
                <SelectItem
                  key={int.value}
                  value={int.value}
                  className="dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  {int.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 dark:text-gray-300">
            &nbsp;
          </label>
          <Button
            onClick={handleGlobalRefresh}
            className="w-full dark:bg-blue-600 dark:hover:bg-blue-700 dark:text-white"
          >
            Refresh All Data
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className={`grid ${tabsGridCols} mb-4`}>
          <TabsTrigger value="timeframes">Timeframes</TabsTrigger>
          <TabsTrigger value="pivots">Pivots</TabsTrigger>
          <TabsTrigger value="breakouts">Breakouts</TabsTrigger>
          <TabsTrigger value="scanner">Scanner</TabsTrigger>
          {isInstrumentIndex && (
            <TabsTrigger value="indicators">Technical Indicators</TabsTrigger>
          )}
        </TabsList>

        {/* Timeframes Tab Content */}
        <TabsContent value="timeframes" className="mt-0">
          <TimeframeTable
            instrument={instrument}
            indexStocks={indexStocks}
            interval={interval}
            refreshTrigger={refreshTrigger}
            onRefresh={handleGlobalRefresh}
          />
        </TabsContent>

        {/* Pivots Tab Content */}
        <TabsContent value="pivots" className="mt-0">
          <PivotCard
            candles={candleData}
            interval={interval}
            instrument={instrument}
            refreshTrigger={refreshTrigger}
            onRefresh={handleGlobalRefresh}
          />
        </TabsContent>

        {/* Breakouts Tab Content */}
        <TabsContent value="breakouts" className="mt-0">
          <MorningRangeBreakoutCard
            instrument={instrument}
            refreshTrigger={refreshTrigger}
            onRefresh={handleGlobalRefresh}
          />
        </TabsContent>

        {/* Scanner Tab Content */}
        <TabsContent value="scanner" className="mt-0">
          <StockScanner
            refreshTrigger={refreshTrigger}
            onRefresh={handleGlobalRefresh}
          />
        </TabsContent>

        {/* Technical Indicators Tab Content */}
        {isInstrumentIndex && (
          <TabsContent value="indicators" className="mt-0">
            <TechnicalIndicatorsTable
              instrument={instrument}
              interval={interval}
              refreshTrigger={refreshTrigger}
              onRefresh={handleGlobalRefresh}
              isIndex={isInstrumentIndex}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
