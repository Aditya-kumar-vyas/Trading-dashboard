"use client";

import React, { useState, useEffect } from "react";
import { RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OHLCData } from "@/app/types";
import {
  PivotType,
  getAllPivotPoints,
  findSwingHighLow,
  isUptrend,
} from "../lib/indicator";
import {
  PIVOT_TYPES,
  STANDARD_PIVOT_LEVELS,
  FIBONACCI_PIVOT_LEVELS,
  CAMARILLA_PIVOT_LEVELS,
  WOODIE_PIVOT_LEVELS,
  DEMARK_PIVOT_LEVELS,
  CPR_PIVOT_LEVELS,
  FIBONACCI_EXTENSION_LEVELS,
  FIBONACCI_RETRACEMENT_LEVELS,
  DEFAULT_SWING_LOOKBACK,
  DEFAULT_TREND_LOOKBACK,
} from "@/lib/indicator-pivot-constants";

interface PivotCardProps {
  candles: OHLCData[];
  onRefresh: () => void;
  defaultPivotType?: PivotType;
  title?: string;
}

export default function PivotCard({
  candles,
  onRefresh,
  defaultPivotType = PivotType.STANDARD,
  title = "Pivot Points",
}: PivotCardProps): JSX.Element {
  const [pivotType, setPivotType] = useState<PivotType>(defaultPivotType);
  const [swingLookback, setSwingLookback] = useState<number>(
    DEFAULT_SWING_LOOKBACK
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [pivotData, setPivotData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string>("levels");
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  // Calculate pivot points
  const calculatePivots = () => {
    if (!candles || candles.length < 2) {
      setError("Not enough data to calculate pivot points");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get all pivot points
      const allPivots = getAllPivotPoints(candles);
      if (!allPivots) {
        throw new Error("Failed to calculate pivot points");
      }

      // Set the pivot data
      setPivotData(allPivots);

      // Auto-expand the selected pivot type
      let initialExpandedItems: React.SetStateAction<string[]> = [];
      switch (pivotType) {
        case PivotType.STANDARD:
          initialExpandedItems = ["standard-pivots"];
          break;
        case PivotType.FIBONACCI:
          initialExpandedItems = ["fibonacci-pivots"];
          break;
        case PivotType.CAMARILLA:
          initialExpandedItems = ["camarilla-pivots"];
          break;
        case PivotType.WOODIE:
          initialExpandedItems = ["woodie-pivots"];
          break;
        case PivotType.DEMARK:
          initialExpandedItems = ["demark-pivots"];
          break;
        case PivotType.CPR:
          initialExpandedItems = ["cpr-pivots"];
          break;
      }
      setExpandedItems(initialExpandedItems);
    } catch (err) {
      console.error("Error calculating pivot points:", err);
      setError("Failed to calculate pivot points");
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate on mount and when dependencies change
  useEffect(() => {
    calculatePivots();
  }, [candles, pivotType, swingLookback]);

  // Handle refresh click
  const handleRefresh = () => {
    calculatePivots();
    if (onRefresh) onRefresh();
  };

  // Get additional market information
  const getMarketInfo = () => {
    if (!candles || candles.length === 0) return null;

    const { swingHigh, swingLow } = findSwingHighLow(candles, swingLookback);
    const uptrend = isUptrend(candles, DEFAULT_TREND_LOOKBACK);
    const latestClose = candles[candles.length - 1].close;
    const latestHigh = candles[candles.length - 1].high;
    const latestLow = candles[candles.length - 1].low;

    return {
      swingHigh,
      swingLow,
      uptrend,
      latestClose,
      latestHigh,
      latestLow,
      range: swingHigh - swingLow,
      swingLookback,
    };
  };

  // Render pivot levels based on type
  const renderPivotLevels = () => {
    if (!pivotData) return null;

    // Get market info for context
    const marketInfo = getMarketInfo();
    if (!marketInfo) return null;

    const { latestClose } = marketInfo;

    // Helper to determine if a price level is above or below current price
    const isPriceAbove = (price: number) => price > latestClose;

    // Helper to format a price value
    const formatPrice = (price: number) => price.toFixed(2);

    // Helper to calculate distance from current price
    const calcDistance = (price: number) => {
      const dist = (((price - latestClose) / latestClose) * 100).toFixed(2);
      return `${dist}%`;
    };

    // Render based on active pivot type
    switch (pivotType) {
      case PivotType.STANDARD:
        return (
          <div className="space-y-2">
            {STANDARD_PIVOT_LEVELS.map((level) => {
              const price = pivotData.standard?.[level.key];
              if (price === undefined) return null;

              const isAbove = isPriceAbove(price);

              return (
                <div
                  key={level.key}
                  className="flex justify-between items-center"
                >
                  <span className="font-medium">{level.label}</span>
                  <div className="flex flex-col items-end">
                    <span
                      className={`font-bold ${
                        isAbove ? "text-red-500" : "text-green-500"
                      }`}
                    >
                      {formatPrice(price)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {isAbove ? "↑" : "↓"} {calcDistance(price)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        );

      case PivotType.FIBONACCI:
        return (
          <div className="space-y-2">
            {FIBONACCI_PIVOT_LEVELS.map((level) => {
              const price = pivotData.fibonacci?.[level.key];
              if (price === undefined) return null;

              const isAbove = isPriceAbove(price);

              return (
                <div
                  key={level.key}
                  className="flex justify-between items-center"
                >
                  <span className="font-medium">{level.label}</span>
                  <div className="flex flex-col items-end">
                    <span
                      className={`font-bold ${
                        isAbove ? "text-red-500" : "text-green-500"
                      }`}
                    >
                      {formatPrice(price)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {isAbove ? "↑" : "↓"} {calcDistance(price)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        );

      case PivotType.CAMARILLA:
        return (
          <div className="space-y-2">
            {CAMARILLA_PIVOT_LEVELS.map((level) => {
              const price = pivotData.camarilla?.[level.key];
              if (price === undefined) return null;

              const isAbove = isPriceAbove(price);

              return (
                <div
                  key={level.key}
                  className="flex justify-between items-center"
                >
                  <span className="font-medium">{level.label}</span>
                  <div className="flex flex-col items-end">
                    <span
                      className={`font-bold ${
                        isAbove ? "text-red-500" : "text-green-500"
                      }`}
                    >
                      {formatPrice(price)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {isAbove ? "↑" : "↓"} {calcDistance(price)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        );

      case PivotType.WOODIE:
        return (
          <div className="space-y-2">
            {WOODIE_PIVOT_LEVELS.map((level) => {
              const price = pivotData.woodie?.[level.key];
              if (price === undefined) return null;

              const isAbove = isPriceAbove(price);

              return (
                <div
                  key={level.key}
                  className="flex justify-between items-center"
                >
                  <span className="font-medium">{level.label}</span>
                  <div className="flex flex-col items-end">
                    <span
                      className={`font-bold ${
                        isAbove ? "text-red-500" : "text-green-500"
                      }`}
                    >
                      {formatPrice(price)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {isAbove ? "↑" : "↓"} {calcDistance(price)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        );

      case PivotType.DEMARK:
        return (
          <div className="space-y-2">
            {DEMARK_PIVOT_LEVELS.map((level) => {
              const price = pivotData.demark?.[level.key];
              if (price === undefined) return null;

              const isAbove = isPriceAbove(price);

              return (
                <div
                  key={level.key}
                  className="flex justify-between items-center"
                >
                  <span className="font-medium">{level.label}</span>
                  <div className="flex flex-col items-end">
                    <span
                      className={`font-bold ${
                        isAbove ? "text-red-500" : "text-green-500"
                      }`}
                    >
                      {formatPrice(price)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {isAbove ? "↑" : "↓"} {calcDistance(price)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        );

      case PivotType.CPR:
        return (
          <div className="space-y-2">
            {CPR_PIVOT_LEVELS.map((level) => {
              const price = pivotData.cpr?.[level.key];
              if (price === undefined) return null;

              const isAbove = isPriceAbove(price);

              return (
                <div
                  key={level.key}
                  className="flex justify-between items-center"
                >
                  <span className="font-medium">{level.label}</span>
                  <div className="flex flex-col items-end">
                    <span
                      className={`font-bold ${
                        isAbove ? "text-red-500" : "text-green-500"
                      }`}
                    >
                      {formatPrice(price)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {isAbove ? "↑" : "↓"} {calcDistance(price)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        );

      default:
        return null;
    }
  };

  // Render fibonacci extensions and retracements
  const renderFibonacciLevels = () => {
    if (!pivotData) return null;

    // Get market info for context
    const marketInfo = getMarketInfo();
    if (!marketInfo) return null;

    const { latestClose, uptrend } = marketInfo;

    return (
      <div className="space-y-6">
        {/* Extensions */}
        <div>
          <h3 className="text-sm font-semibold mb-2">
            Fibonacci Extensions ({uptrend ? "Uptrend" : "Downtrend"})
          </h3>
          <div className="space-y-2">
            {FIBONACCI_EXTENSION_LEVELS.map((level) => {
              const price = pivotData.fibExtensions?.[level.key];
              if (price === undefined) return null;

              const isAbove = price > latestClose;

              return (
                <div
                  key={level.key}
                  className="flex justify-between items-center"
                >
                  <span className="font-medium">{level.label}</span>
                  <div className="flex flex-col items-end">
                    <span
                      className={`font-bold ${
                        isAbove ? "text-red-500" : "text-green-500"
                      }`}
                    >
                      {price.toFixed(2)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {isAbove ? "↑" : "↓"}{" "}
                      {(((price - latestClose) / latestClose) * 100).toFixed(2)}
                      %
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Retracements */}
        <div>
          <h3 className="text-sm font-semibold mb-2">
            Fibonacci Retracements ({uptrend ? "Uptrend" : "Downtrend"})
          </h3>
          <div className="space-y-2">
            {FIBONACCI_RETRACEMENT_LEVELS.map((level) => {
              const price = pivotData.fibRetracements?.[level.key];
              if (price === undefined) return null;

              const isAbove = price > latestClose;

              return (
                <div
                  key={level.key}
                  className="flex justify-between items-center"
                >
                  <span className="font-medium">{level.label}</span>
                  <div className="flex flex-col items-end">
                    <span
                      className={`font-bold ${
                        isAbove ? "text-red-500" : "text-green-500"
                      }`}
                    >
                      {price.toFixed(2)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {isAbove ? "↑" : "↓"}{" "}
                      {(((price - latestClose) / latestClose) * 100).toFixed(2)}
                      %
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // Render market information
  const renderMarketInfo = () => {
    if (!pivotData) return null;

    const marketInfo = getMarketInfo();
    if (!marketInfo) return null;

    const {
      swingHigh,
      swingLow,
      uptrend,
      latestClose,
      latestHigh,
      latestLow,
      range,
      swingLookback,
    } = marketInfo;

    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold mb-2">Current Price Level</h3>
          <div className="text-2xl font-bold">{latestClose.toFixed(2)}</div>
          <div className="text-xs text-gray-500">
            H: {latestHigh.toFixed(2)} L: {latestLow.toFixed(2)}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-2">Market Trend</h3>
          <div
            className={`font-medium ${
              uptrend ? "text-green-500" : "text-red-500"
            }`}
          >
            {uptrend ? "Uptrend" : "Downtrend"}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold mb-2">
            Swing Levels ({swingLookback} periods)
          </h3>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span>Swing High:</span>
              <span className="font-medium">{swingHigh.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Swing Low:</span>
              <span className="font-medium">{swingLow.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Range:</span>
              <span className="font-medium">
                {range.toFixed(2)} ({((range / swingLow) * 100).toFixed(2)}%)
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render the accordion with all pivot types
  const renderAllPivots = () => {
    if (!pivotData) return null;

    return (
      <Accordion
        type="multiple"
        value={expandedItems}
        onValueChange={setExpandedItems}
        className="w-full"
      >
        {/* Standard Pivots */}
        <AccordionItem value="standard-pivots">
          <AccordionTrigger className="text-sm font-medium">
            Standard Pivot Points
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2 py-2">
              {STANDARD_PIVOT_LEVELS.map((level) => {
                const price = pivotData.standard?.[level.key];
                if (price === undefined) return null;

                return (
                  <div
                    key={level.key}
                    className="flex justify-between items-center"
                  >
                    <span>{level.label}</span>
                    <span className="font-medium">{price.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Fibonacci Pivots */}
        <AccordionItem value="fibonacci-pivots">
          <AccordionTrigger className="text-sm font-medium">
            Fibonacci Pivot Points
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2 py-2">
              {FIBONACCI_PIVOT_LEVELS.map((level) => {
                const price = pivotData.fibonacci?.[level.key];
                if (price === undefined) return null;

                return (
                  <div
                    key={level.key}
                    className="flex justify-between items-center"
                  >
                    <span>{level.label}</span>
                    <span className="font-medium">{price.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Camarilla Pivots */}
        <AccordionItem value="camarilla-pivots">
          <AccordionTrigger className="text-sm font-medium">
            Camarilla Pivot Points
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2 py-2">
              {CAMARILLA_PIVOT_LEVELS.map((level) => {
                const price = pivotData.camarilla?.[level.key];
                if (price === undefined) return null;

                return (
                  <div
                    key={level.key}
                    className="flex justify-between items-center"
                  >
                    <span>{level.label}</span>
                    <span className="font-medium">{price.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Woodie Pivots */}
        <AccordionItem value="woodie-pivots">
          <AccordionTrigger className="text-sm font-medium">
            Woodie Pivot Points
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2 py-2">
              {WOODIE_PIVOT_LEVELS.map((level) => {
                const price = pivotData.woodie?.[level.key];
                if (price === undefined) return null;

                return (
                  <div
                    key={level.key}
                    className="flex justify-between items-center"
                  >
                    <span>{level.label}</span>
                    <span className="font-medium">{price.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* DeMark Pivots */}
        <AccordionItem value="demark-pivots">
          <AccordionTrigger className="text-sm font-medium">
            DeMark Pivot Points
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2 py-2">
              {DEMARK_PIVOT_LEVELS.map((level) => {
                const price = pivotData.demark?.[level.key];
                if (price === undefined) return null;

                return (
                  <div
                    key={level.key}
                    className="flex justify-between items-center"
                  >
                    <span>{level.label}</span>
                    <span className="font-medium">{price.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* CPR Pivots */}
        <AccordionItem value="cpr-pivots">
          <AccordionTrigger className="text-sm font-medium">
            Central Pivot Range (CPR)
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2 py-2">
              {CPR_PIVOT_LEVELS.map((level) => {
                const price = pivotData.cpr?.[level.key];
                if (price === undefined) return null;

                return (
                  <div
                    key={level.key}
                    className="flex justify-between items-center"
                  >
                    <span>{level.label}</span>
                    <span className="font-medium">{price.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Fibonacci Extensions */}
        <AccordionItem value="fib-extensions">
          <AccordionTrigger className="text-sm font-medium">
            Fibonacci Extensions
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2 py-2">
              {FIBONACCI_EXTENSION_LEVELS.map((level) => {
                const price = pivotData.fibExtensions?.[level.key];
                if (price === undefined) return null;

                return (
                  <div
                    key={level.key}
                    className="flex justify-between items-center"
                  >
                    <span>{level.label}</span>
                    <span className="font-medium">{price.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Fibonacci Retracements */}
        <AccordionItem value="fib-retracements">
          <AccordionTrigger className="text-sm font-medium">
            Fibonacci Retracements
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2 py-2">
              {FIBONACCI_RETRACEMENT_LEVELS.map((level) => {
                const price = pivotData.fibRetracements?.[level.key];
                if (price === undefined) return null;

                return (
                  <div
                    key={level.key}
                    className="flex justify-between items-center"
                  >
                    <span>{level.label}</span>
                    <span className="font-medium">{price.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    );
  };

  return (
    <Card className="col-span-1">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="flex items-center space-x-2">
          <Select
            value={pivotType}
            onValueChange={(value: any) => setPivotType(value)}
          >
            <SelectTrigger className="h-8 w-[180px] text-xs">
              <SelectValue placeholder="Pivot Type" />
            </SelectTrigger>
            <SelectContent>
              {PIVOT_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <RefreshCw className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : error ? (
          <div className="text-sm text-red-500">{error}</div>
        ) : (
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList className="w-full mb-4">
              <TabsTrigger value="levels" className="flex-1">
                Pivot Levels
              </TabsTrigger>
              <TabsTrigger value="fibonacci" className="flex-1">
                Fibonacci
              </TabsTrigger>
              <TabsTrigger value="allpivots" className="flex-1">
                All Pivots
              </TabsTrigger>
              <TabsTrigger value="market" className="flex-1">
                Market Info
              </TabsTrigger>
            </TabsList>

            <TabsContent value="levels" className="space-y-4">
              {renderPivotLevels()}
            </TabsContent>

            <TabsContent value="fibonacci" className="space-y-4">
              {renderFibonacciLevels()}
            </TabsContent>

            <TabsContent value="allpivots" className="space-y-4">
              {renderAllPivots()}
            </TabsContent>

            <TabsContent value="market" className="space-y-4">
              {renderMarketInfo()}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
