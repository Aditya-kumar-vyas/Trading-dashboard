"use client";

import React, { useState, useEffect } from "react";
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
import TechnicalIndicatorCard from "./indicator-card";
import PivotCard from "./pivot-grid";
import { PivotType } from "../lib/indicator";

export default function TradingView(): JSX.Element {
  const [interval, setInterval] = useState<Interval>("day");
  const [instrument, setInstrument] = useState<string>(INSTRUMENTS[0].key);
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

  // Automatically subscribe to the selected instrument when WebSocket is connected
  useEffect(() => {
    if (isConnected) {
      // Convert instrument key format if necessary
      let wsInstrumentKey = instrument;
      if (instrument.includes("%7C")) {
        wsInstrumentKey = instrument.replace(/%7C/g, "|").replace(/%20/g, " ");
      }
      subscribeToInstruments([wsInstrumentKey]);
    }
  }, [isConnected, instrument]);

  // Fetch historical data when instrument changes or on manual refresh
  useEffect(() => {
    fetchHistoricalData();
  }, [instrument, refreshTrigger]);

  const handleFilterInstrument = (instrumentKey: string): void => {
    setInstrument(instrumentKey);
  };

  const handleGlobalRefresh = (): void => {
    setRefreshTrigger((prev) => prev + 1);
  };

  // Find the current instrument label for initializing the search field
  const currentInstrumentLabel =
    INSTRUMENTS.find((inst) => inst.key === instrument)?.label || "";

  const fetchHistoricalData = async () => {
    try {
      // Default to 1 year of data for indicators
      const today = new Date();
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(today.getFullYear() - 1);

      const formattedToDate = format(today, "yyyy-MM-dd");
      const formattedFromDate = format(oneYearAgo, "yyyy-MM-dd");

      const response = await fetch(
        `https://api.upstox.com/v2/historical-candle/${instrument}/day/${formattedToDate}/${formattedFromDate}`
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
    <div className="space-y-8">
      {isConnected ? (
        <Alert className="bg-green-50 border-green-200">
          <Activity className="h-4 w-4 text-green-500" />
          <AlertTitle>Real-time data connected</AlertTitle>
          <AlertDescription>
            Live market data is available for Today's timeframe.
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

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="timeframes">OHLC</TabsTrigger>
          <TabsTrigger value="moving-averages">Moving Averages</TabsTrigger>
          <TabsTrigger value="atr">True Range Indicators</TabsTrigger>
          <TabsTrigger value="pivots">Pivot Points</TabsTrigger>
        </TabsList>

        <TabsContent value="timeframes" className="space-y-4">
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

        <TabsContent value="moving-averages" className="space-y-4">
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
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  Super Trend (ST)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <p className="text-sm text-gray-500">
                    Super Trend calculation requires ATR and a multiplier
                    factor.
                  </p>
                  <Button variant="outline" className="mt-4" disabled>
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
      </Tabs>
    </div>
  );
}
