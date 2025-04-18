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
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(today.getFullYear() - 1);

      const formattedToDate = format(today, "yyyy-MM-dd");
      const formattedFromDate = format(oneYearAgo, "yyyy-MM-dd");

      const response = await fetch(
        `/api/historical-data?instrument=${encodeURIComponent(
          instrument
        )}&interval=day&to_date=${formattedToDate}&from_date=${formattedFromDate}`
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

        // Sort candles by timestamp in ascending order (oldest first)
        candles.sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        setCandleData(candles);
      }
    } catch (error) {
      console.error("Error fetching historical data for indicators:", error);
    }
  };

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

        <div className="flex items-end">
          <Button
            onClick={handleGlobalRefresh}
            className="w-full dark:bg-blue-600 dark:hover:bg-blue-700 dark:text-white"
          >
            Refresh All Data
          </Button>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList className="dark:bg-gray-800">
          <TabsTrigger
            value="timeframes"
            className="dark:data-[state=active]:bg-gray-700 dark:text-gray-300 dark:data-[state=active]:text-white"
          >
            OHLC Timeframes
          </TabsTrigger>
          <TabsTrigger
            value="indicators"
            className="dark:data-[state=active]:bg-gray-700 dark:text-gray-300 dark:data-[state=active]:text-white"
          >
            Indicators
          </TabsTrigger>
          <TabsTrigger
            value="pivots"
            className="dark:data-[state=active]:bg-gray-700 dark:text-gray-300 dark:data-[state=active]:text-white"
          >
            Pivot Points
          </TabsTrigger>
          <TabsTrigger
            value="breakouts"
            className="dark:data-[state=active]:bg-gray-700 dark:text-gray-300 dark:data-[state=active]:text-white"
          >
            Breakouts
          </TabsTrigger>
          <TabsTrigger
            value="scanner"
            className="dark:data-[state=active]:bg-gray-700 dark:text-gray-300 dark:data-[state=active]:text-white"
          >
            Stock Scanner
          </TabsTrigger>
        </TabsList>

        <TabsContent value="timeframes" className="space-y-4">
          {/* Morning Range Breakout Card - Added at the top for prominence */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <MorningRangeBreakoutCard
              instrument={instrument}
              // Using minute candles for more precise tracking
              refreshTrigger={refreshTrigger}
              onRefresh={handleGlobalRefresh}
              title="Morning Range Breakout (9:15-10:00)"
            />
          </div>

          {/* Regular Timeframe Cards */}
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
        </TabsContent>

        <TabsContent value="indicators" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Simple Moving Averages */}
            <TechnicalIndicatorCard
              candles={candleData}
              onRefresh={handleGlobalRefresh}
              defaultPeriod={4}
              defaultType="SMA"
              category="ma"
              title="4AVG (SMA)"
            />
            <TechnicalIndicatorCard
              candles={candleData}
              onRefresh={handleGlobalRefresh}
              defaultPeriod={9}
              defaultType="SMA"
              category="ma"
              title="9AVG (SMA)"
            />
            <TechnicalIndicatorCard
              candles={candleData}
              onRefresh={handleGlobalRefresh}
              defaultPeriod={18}
              defaultType="SMA"
              category="ma"
              title="18AVG (SMA)"
            />
            <TechnicalIndicatorCard
              candles={candleData}
              onRefresh={handleGlobalRefresh}
              defaultPeriod={50}
              defaultType="SMA"
              category="ma"
              title="50AVG (SMA)"
            />
            <TechnicalIndicatorCard
              candles={candleData}
              onRefresh={handleGlobalRefresh}
              defaultPeriod={200}
              defaultType="SMA"
              category="ma"
              title="200AVG (SMA)"
            />
            <TechnicalIndicatorCard
              candles={candleData}
              onRefresh={handleGlobalRefresh}
              defaultPeriod={250}
              defaultType="SMA"
              category="ma"
              title="W50AVG (SMA)"
            />
            <TechnicalIndicatorCard
              candles={candleData}
              onRefresh={handleGlobalRefresh}
              defaultPeriod={1000}
              defaultType="SMA"
              category="ma"
              title="W200AVG (SMA)"
            />

            {/* Exponential Moving Averages */}
            <TechnicalIndicatorCard
              candles={candleData}
              onRefresh={handleGlobalRefresh}
              defaultPeriod={50}
              defaultType="EMA"
              category="ma"
              title="50AVG (EMA)"
            />
            <TechnicalIndicatorCard
              candles={candleData}
              onRefresh={handleGlobalRefresh}
              defaultPeriod={200}
              defaultType="EMA"
              category="ma"
              title="200AVG (EMA)"
            />
          </div>
        </TabsContent>

        <TabsContent value="atr" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* ATR Indicators */}
            {ATR_TYPES.map((atrType: any) => (
              <TechnicalIndicatorCard
                key={atrType.value}
                candles={candleData}
                onRefresh={handleGlobalRefresh}
                defaultType={atrType.value}
                category="atr"
                title={atrType.label}
              />
            ))}

            {/* Super Trend indicator would go here if implemented */}
            <Card className="col-span-1 dark:bg-gray-800 dark:border-gray-700">
              <CardHeader>
                <CardTitle className="text-sm font-medium dark:text-gray-200">
                  Super Trend (ST)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Super Trend calculation requires ATR and a multiplier
                    factor.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-4 dark:border-gray-600 dark:text-gray-300"
                    disabled
                  >
                    <TrendingUp className="mr-2 h-4 w-4" />
                    Coming Soon
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="pivots" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Standard Pivot Points */}
            <PivotCard
              candles={candleData}
              onRefresh={handleGlobalRefresh}
              defaultPivotType={PivotType.STANDARD}
              title="Standard Pivot Points"
            />

            {/* Fibonacci Pivot Points */}
            <PivotCard
              candles={candleData}
              onRefresh={handleGlobalRefresh}
              defaultPivotType={PivotType.FIBONACCI}
              title="Fibonacci Pivot Points"
            />

            {/* Camarilla Pivot Points */}
            <PivotCard
              candles={candleData}
              onRefresh={handleGlobalRefresh}
              defaultPivotType={PivotType.CAMARILLA}
              title="Camarilla Pivot Points"
            />

            {/* Woodie Pivot Points */}
            <PivotCard
              candles={candleData}
              onRefresh={handleGlobalRefresh}
              defaultPivotType={PivotType.WOODIE}
              title="Woodie Pivot Points"
            />

            {/* DeMark Pivot Points */}
            <PivotCard
              candles={candleData}
              onRefresh={handleGlobalRefresh}
              defaultPivotType={PivotType.DEMARK}
              title="DeMark Pivot Points"
            />

            {/* CPR Pivot Points */}
            <PivotCard
              candles={candleData}
              onRefresh={handleGlobalRefresh}
              defaultPivotType={PivotType.CPR}
              title="Central Pivot Range (CPR)"
            />
          </div>
        </TabsContent>

        {/* New Scanner Tab */}
        <TabsContent value="scanner" className="space-y-4">
          <div className="grid gap-4 grid-cols-1">
            <StockScanner />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
