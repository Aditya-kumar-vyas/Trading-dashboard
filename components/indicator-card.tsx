"use client";

import React, { useState, useEffect } from "react";
import { RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { OHLCData, IndicatorCategory, PriceField } from "../app/types";
import {
  MA_PERIODS,
  MA_TYPES,
  ATR_TYPES,
  DEFAULT_ATR_PERIOD,
  PRICE_FIELDS,
  MA_LABELS,
} from "../app/constants";
import {
  calculateATR,
  calculateWATR,
  calculateMATR,
  calculateVATR,
  calculateOHLCSMA,
  calculateOHLCEMA,
  getIndicatorLastValue,
} from "../lib/indicator";

interface TechnicalIndicatorCardProps {
  candles: OHLCData[];
  onRefresh: () => void;
  defaultPeriod?: number;
  defaultType?: string;
  category: IndicatorCategory;
  title?: string;
}

export default function TechnicalIndicatorCard({
  candles,
  onRefresh,
  defaultPeriod,
  defaultType,
  category,
  title,
}: TechnicalIndicatorCardProps): JSX.Element {
  // State for selected indicator options
  const [period, setPeriod] = useState<number>(
    defaultPeriod || (category === "ma" ? 50 : DEFAULT_ATR_PERIOD)
  );
  const [type, setType] = useState<string>(
    defaultType || (category === "ma" ? "SMA" : "ATR")
  );
  const [priceField, setPriceField] = useState<PriceField>("close");
  const [indicatorValue, setIndicatorValue] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Determine which options to show based on category
  const periodOptions =
    category === "ma"
      ? MA_PERIODS
      : [{ value: DEFAULT_ATR_PERIOD, label: `${DEFAULT_ATR_PERIOD} Days` }];
  const typeOptions = category === "ma" ? MA_TYPES : ATR_TYPES;

  // Helper to get label for the selected period
  const getPeriodLabel = () => {
    const option = periodOptions.find((p) => p.value === period);
    return option ? option.label : `${period} Days`;
  };

  // Calculate indicator value
  const calculateIndicatorValue = () => {
    if (!candles || candles.length === 0) {
      setError("No data available");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let value: number | null = null;

      // Calculate based on indicator type
      if (category === "ma") {
        if (type === "SMA") {
          console.log("calculateOHLCSMA", candles, period, priceField);
          const values = calculateOHLCSMA(candles, period, priceField);
          value = getIndicatorLastValue(values);
        } else if (type === "EMA") {
          const values = calculateOHLCEMA(candles, period, priceField);
          value = getIndicatorLastValue(values);
        }
      } else if (category === "atr") {
        switch (type) {
          case "ATR":
            const atrValues = calculateATR(candles, period);
            value = getIndicatorLastValue(atrValues);
            break;
          case "WATR":
            const watrValues = calculateWATR(candles, period);
            value = getIndicatorLastValue(watrValues);
            break;
          case "MATR":
            const matrValues = calculateMATR(candles, period);
            value = getIndicatorLastValue(matrValues);
            break;
          case "VATR":
            const vatrValues = calculateVATR(candles, period);
            value = getIndicatorLastValue(vatrValues);
            break;
        }
      }

      setIndicatorValue(value);
    } catch (err) {
      console.error("Error calculating indicator:", err);
      setError("Failed to calculate indicator");
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate on mount and when dependencies change
  useEffect(() => {
    calculateIndicatorValue();
  }, [candles, period, type, priceField]);

  // Get display title
  const getDisplayTitle = () => {
    if (title) return title;

    if (category === "ma") {
      // Use standard labels like 50AVG, 200AVG, etc.
      const maLabel =
        MA_LABELS[period as keyof typeof MA_LABELS] || `${period}AVG`;
      return `${maLabel} (${type})`;
    } else {
      return type;
    }
  };

  // Handle refresh click
  const handleRefresh = () => {
    calculateIndicatorValue();
    if (onRefresh) onRefresh();
  };

  return (
    <Card className="col-span-1">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">
          {getDisplayTitle()}
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Controls for indicator settings */}
          <div className="grid grid-cols-2 gap-2">
            {periodOptions.length > 1 && (
              <div>
                <label className="text-xs text-gray-500 block mb-1">
                  Period
                </label>
                <Select
                  value={period.toString()}
                  onValueChange={(value) => setPeriod(parseInt(value))}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder={getPeriodLabel()} />
                  </SelectTrigger>
                  <SelectContent>
                    {periodOptions.map((option) => (
                      <SelectItem
                        key={option.value}
                        value={option.value.toString()}
                      >
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <label className="text-xs text-gray-500 block mb-1">Type</label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder={type} />
                </SelectTrigger>
                <SelectContent>
                  {typeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {category === "ma" && (
              <div className="col-span-2">
                <label className="text-xs text-gray-500 block mb-1">
                  Price
                </label>
                <Select
                  value={priceField}
                  onValueChange={(value) => setPriceField(value as PriceField)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder={priceField} />
                  </SelectTrigger>
                  <SelectContent>
                    {PRICE_FIELDS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Indicator value display */}
          {isLoading ? (
            <div className="flex items-center justify-center py-2">
              <RefreshCw className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : error ? (
            <div className="text-sm text-red-500">{error}</div>
          ) : (
            <div className="text-center mt-2">
              <div className="text-2xl font-bold">
                {indicatorValue !== null ? indicatorValue.toFixed(2) : "N/A"}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {category === "ma"
                  ? `${type} of ${priceField} prices over ${period} periods`
                  : `${type} over ${period} periods`}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
