"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  X,
  FilterX,
  Filter,
  ArrowDown,
  ArrowUp,
  RefreshCw,
  Save,
} from "lucide-react";
import { useMarketData } from "./market-data-context";
import { INSTRUMENTS, INTERVALS } from "@/app/constants";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Type definitions
type ComparisonOperator =
  | "greaterThan"
  | "lessThan"
  | "greaterThanEqual"
  | "lessThanEqual"
  | "equals"
  | "notEquals"
  | "crossedAbove"
  | "crossedBelow";

type ScanTimeframe =
  | "current"
  | "1DayAgo"
  | "2DaysAgo"
  | "3DaysAgo"
  | "1WeekAgo"
  | "2WeeksAgo"
  | "1MonthAgo";

type ScanField = "open" | "high" | "low" | "close" | "volume" | "percentChange";

type MarketSegment =
  | "nifty50"
  | "nifty100"
  | "nifty200"
  | "nifty500"
  | "niftyBank"
  | "niftyIT"
  | "niftyAuto"
  | "niftyPharma"
  | "niftyFMCG"
  | "niftyMetal"
  | "niftyRealty"
  | "niftyPSUBank"
  | "niftyPvtBank"
  | "niftyFinService"
  | "niftyNext50"
  | "niftyMidcap50"
  | "niftyMidcap100"
  | "niftyMidcap150"
  | "niftySmallcap50"
  | "niftySmallcap100"
  | "niftySmallcap250"
  | "niftyMidsml400"
  | "niftyConsumerDurables"
  | "niftyHealthcare"
  | "niftyOilAndGas";

type MatchMode = "all" | "any";

// Interface for a single condition
interface ScanCondition {
  id: string;
  field: string;
  operator: string;
  value: string;
  timeframe: string;
  comparisonField?: string;
  comparisonTimeframe?: string;
}

// Interface for scan results
interface ScanResult {
  instrumentKey: string;
  instrumentName: string;
  currentPrice: number;
  percentChange: number;
  matchedConditions: number;
  fieldValues: Record<string, any>;
}

// Define the possible comparison operators
const COMPARISON_OPERATORS = [
  {
    value: "greaterThan" as ComparisonOperator,
    label: "Greater than",
    symbol: ">",
  },
  { value: "lessThan" as ComparisonOperator, label: "Less than", symbol: "<" },
  {
    value: "greaterThanEqual" as ComparisonOperator,
    label: "Greater than or equal to",
    symbol: "≥",
  },
  {
    value: "lessThanEqual" as ComparisonOperator,
    label: "Less than or equal to",
    symbol: "≤",
  },
  { value: "equals" as ComparisonOperator, label: "Equals", symbol: "=" },
  {
    value: "notEquals" as ComparisonOperator,
    label: "Not equals",
    symbol: "≠",
  },
  {
    value: "crossedAbove" as ComparisonOperator,
    label: "Crossed above",
    symbol: "↗",
  },
  {
    value: "crossedBelow" as ComparisonOperator,
    label: "Crossed below",
    symbol: "↘",
  },
];

// Define the price fields that can be compared
const PRICE_FIELDS = [
  { value: "open" as ScanField, label: "Open" },
  { value: "high" as ScanField, label: "High" },
  { value: "low" as ScanField, label: "Low" },
  { value: "close" as ScanField, label: "Close" },
  { value: "volume" as ScanField, label: "Volume" },
  { value: "percentChange" as ScanField, label: "% Change" },
];

// Define the timeframes for lookback periods
const TIMEFRAMES = [
  { value: "current" as ScanTimeframe, label: "Current" },
  { value: "1DayAgo" as ScanTimeframe, label: "1 day ago" },
  { value: "2DaysAgo" as ScanTimeframe, label: "2 days ago" },
  { value: "3DaysAgo" as ScanTimeframe, label: "3 days ago" },
  { value: "1WeekAgo" as ScanTimeframe, label: "1 week ago" },
  { value: "2WeeksAgo" as ScanTimeframe, label: "2 weeks ago" },
  { value: "1MonthAgo" as ScanTimeframe, label: "1 month ago" },
];

// Define the segments/indices to select from
const SEGMENTS = [
  { value: "nifty50" as MarketSegment, label: "Nifty 50" },
  { value: "nifty100" as MarketSegment, label: "Nifty 100" },
  { value: "nifty200" as MarketSegment, label: "Nifty 200" },
  { value: "nifty500" as MarketSegment, label: "Nifty 500" },
  { value: "niftyBank" as MarketSegment, label: "Nifty Bank" },
  { value: "niftyIT" as MarketSegment, label: "Nifty IT" },
  { value: "niftyAuto" as MarketSegment, label: "Nifty Auto" },
  { value: "niftyPharma" as MarketSegment, label: "Nifty Pharma" },
  { value: "niftyFMCG" as MarketSegment, label: "Nifty FMCG" },
  { value: "niftyMetal" as MarketSegment, label: "Nifty Metal" },
  { value: "niftyRealty" as MarketSegment, label: "Nifty Realty" },
  { value: "niftyPSUBank" as MarketSegment, label: "Nifty PSU Bank" },
  { value: "niftyPvtBank" as MarketSegment, label: "Nifty Private Bank" },
  {
    value: "niftyFinService" as MarketSegment,
    label: "Nifty Financial Services",
  },
  { value: "niftyNext50" as MarketSegment, label: "Nifty Next 50" },
  { value: "niftyMidcap50" as MarketSegment, label: "Nifty Midcap 50" },
  { value: "niftyMidcap100" as MarketSegment, label: "Nifty Midcap 100" },
  { value: "niftyMidcap150" as MarketSegment, label: "Nifty Midcap 150" },
  { value: "niftySmallcap50" as MarketSegment, label: "Nifty Smallcap 50" },
  { value: "niftySmallcap100" as MarketSegment, label: "Nifty Smallcap 100" },
  { value: "niftySmallcap250" as MarketSegment, label: "Nifty Smallcap 250" },
  { value: "niftyMidsml400" as MarketSegment, label: "Nifty MidSmallcap 400" },
  {
    value: "niftyConsumerDurables" as MarketSegment,
    label: "Nifty Consumer Durables",
  },
  { value: "niftyHealthcare" as MarketSegment, label: "Nifty Healthcare" },
  { value: "niftyOilAndGas" as MarketSegment, label: "Nifty Oil & Gas" },
];

// Define some predefined scan templates
const SCAN_TEMPLATES = [
  {
    name: "Price Up 5%+",
    data: {
      conditions: [
        {
          id: "template1",
          field: "percentChange",
          operator: "greaterThanEqual",
          value: "5",
          timeframe: "current",
        },
      ],
      segment: "nifty50" as MarketSegment,
      matchMode: "any" as MatchMode,
    },
  },
  {
    name: "Volume Surge",
    data: {
      conditions: [
        {
          id: "template2",
          field: "volume",
          operator: "greaterThan",
          value: "1000000",
          timeframe: "current",
        },
      ],
      segment: "nifty50" as MarketSegment,
      matchMode: "any" as MatchMode,
    },
  },
  {
    name: "Higher High",
    data: {
      conditions: [
        {
          id: "template3-1",
          field: "high",
          operator: "greaterThan",
          value: "0",
          timeframe: "1DayAgo",
        },
      ],
      segment: "nifty50" as MarketSegment,
      matchMode: "all" as MatchMode,
    },
  },
  {
    name: "Strong Bullish",
    data: {
      conditions: [
        {
          id: "template4-1",
          field: "close",
          operator: "greaterThan",
          value: "0",
          timeframe: "open",
        },
        {
          id: "template4-2",
          field: "percentChange",
          operator: "greaterThan",
          value: "2",
          timeframe: "current",
        },
      ],
      segment: "nifty50" as MarketSegment,
      matchMode: "all" as MatchMode,
    },
  },
];

export default function StockScanner() {
  const { isConnected, marketData, subscribeToInstruments } = useMarketData();

  // State for conditions and segment
  const [conditions, setConditions] = useState<ScanCondition[]>([]);
  const [selectedSegment, setSelectedSegment] =
    useState<MarketSegment>("nifty50");
  const [matchMode, setMatchMode] = useState<MatchMode>("any");
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [sortField, setSortField] = useState<string>("instrumentName");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [scanName, setScanName] = useState<string>("");
  const [savedScans, setSavedScans] = useState<
    {
      name: string;
      data: {
        conditions: ScanCondition[];
        segment: MarketSegment;
        matchMode: MatchMode;
      };
    }[]
  >([]);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState<boolean>(false);

  // Load saved scans from localStorage on first render
  useEffect(() => {
    const savedScansFromStorage = localStorage.getItem("savedScans");
    if (savedScansFromStorage) {
      try {
        setSavedScans(JSON.parse(savedScansFromStorage));
      } catch (error) {
        console.error("Error loading saved scans:", error);
      }
    }
  }, []);

  // Save a scan to localStorage
  const saveScan = () => {
    if (!scanName.trim()) {
      alert("Please enter a name for your scan");
      return;
    }

    if (conditions.length === 0) {
      alert("Please add at least one condition to save");
      return;
    }

    const newScan = {
      name: scanName,
      data: {
        conditions: [...conditions],
        segment: selectedSegment,
        matchMode: matchMode,
      },
    };

    const updatedSavedScans = [...savedScans, newScan];
    setSavedScans(updatedSavedScans);

    // Also save to localStorage
    localStorage.setItem("savedScans", JSON.stringify(updatedSavedScans));

    // Clear the name input and close modal
    setScanName("");
    setIsSaveModalOpen(false);
  };

  // Load a saved scan
  const loadScan = (scanIndex: number) => {
    const scan = savedScans[scanIndex];
    if (scan) {
      setConditions(scan.data.conditions);
      setSelectedSegment(scan.data.segment);
      setMatchMode(scan.data.matchMode);
    }
  };

  // Delete a saved scan
  const deleteScan = (scanIndex: number) => {
    const updatedSavedScans = savedScans.filter(
      (_, index) => index !== scanIndex
    );
    setSavedScans(updatedSavedScans);

    // Also update localStorage
    localStorage.setItem("savedScans", JSON.stringify(updatedSavedScans));
  };

  // Generate a unique ID for each condition
  const generateId = () => Math.random().toString(36).substring(2, 11);

  // Add a new condition to the list
  const addCondition = () => {
    const newCondition: ScanCondition = {
      id: generateId(),
      field: "close",
      operator: "greaterThan",
      value: "",
      timeframe: "current",
    };
    setConditions([...conditions, newCondition]);
  };

  // Remove a condition by ID
  const removeCondition = (id: string) => {
    setConditions(conditions.filter((condition) => condition.id !== id));
  };

  // Update a condition by ID
  const updateCondition = (id: string, updates: Partial<ScanCondition>) => {
    setConditions(
      conditions.map((condition) =>
        condition.id === id ? { ...condition, ...updates } : condition
      )
    );
  };

  // Subscribe to all instruments in the selected segment when it changes
  useEffect(() => {
    if (isConnected) {
      const segmentInstruments = getInstrumentsForSegment(selectedSegment);
      const instrumentKeys = segmentInstruments.map(
        (instrument) => instrument.key
      );

      if (instrumentKeys.length > 0) {
        console.log(
          `Subscribing to ${instrumentKeys.length} instruments in ${selectedSegment}`
        );
        subscribeToInstruments(instrumentKeys);
      }
    }
  }, [isConnected, selectedSegment, subscribeToInstruments]);

  // Helper to get instruments for a specific segment
  const getInstrumentsForSegment = (segment: string) => {
    // Find the index instrument first
    const findIndexInstrument = () => {
      return INSTRUMENTS.find((inst) => {
        const label = inst.label.toLowerCase();

        switch (segment) {
          case "nifty50":
            return label === "nifty 50";
          case "nifty100":
            return label === "nifty 100";
          case "nifty200":
            return label === "nifty 200";
          case "nifty500":
            return label === "nifty 500";
          case "niftyBank":
            return label === "nifty bank";
          case "niftyIT":
            return label === "nifty it";
          case "niftyAuto":
            return label === "nifty auto";
          case "niftyPharma":
            return label === "nifty pharma";
          case "niftyFMCG":
            return label === "nifty fmcg";
          case "niftyMetal":
            return label === "nifty metal";
          case "niftyRealty":
            return label === "nifty realty";
          case "niftyPSUBank":
            return label === "nifty psu bank";
          case "niftyPvtBank":
            return label === "nifty pvt bank";
          case "niftyFinService":
            return label === "nifty fin service";
          case "niftyNext50":
            return label === "nifty next 50";
          case "niftyMidcap50":
            return label === "nifty midcap 50";
          case "niftyMidcap100":
            return label === "nifty midcap 100" || label === "nifty midcap100";
          case "niftyMidcap150":
            return label === "nifty midcap 150";
          case "niftySmallcap50":
            return label === "nifty smlcap 50" || label === "nifty smallcap 50";
          case "niftySmallcap100":
            return (
              label === "nifty smlcap 100" || label === "nifty smallcap 100"
            );
          case "niftySmallcap250":
            return (
              label === "nifty smlcap 250" || label === "nifty smallcap 250"
            );
          case "niftyMidsml400":
            return label === "nifty midsml 400";
          case "niftyConsumerDurables":
            return (
              label === "nifty consr durbl" ||
              label === "nifty consumer durables"
            );
          case "niftyHealthcare":
            return label === "nifty healthcare";
          case "niftyOilAndGas":
            return label === "nifty oil and gas";
          default:
            return false;
        }
      });
    };

    const indexInstrument = findIndexInstrument();

    if (!indexInstrument) {
      console.warn(`Could not find index instrument for segment: ${segment}`);
      return INSTRUMENTS.slice(0, 10); // Fallback to first 10 instruments to avoid processing too many
    }

    // Log that we found the index
    console.log(
      `Found index instrument for ${segment}: ${indexInstrument.label}`
    );

    // In a real application, we would:
    // 1. Fetch constituent stocks of the index from an API or database
    // 2. Filter INSTRUMENTS to only include those constituents
    // 3. Return the filtered list

    // For demonstration purposes, we're returning just the index instrument
    // and a few random stocks to simulate the behavior
    const mockConstituents = [
      indexInstrument,
      ...INSTRUMENTS.filter((inst) => inst.key.includes("NSE|")).slice(0, 10),
    ];

    console.log(
      `Returning ${mockConstituents.length} instruments for ${segment}`
    );
    return mockConstituents;
  };

  // Run the scan with current conditions
  const runScan = () => {
    if (conditions.length === 0) {
      alert("Please add at least one condition to scan");
      return;
    }

    setIsScanning(true);

    try {
      // Get all instruments for the selected segment
      const segmentInstruments = getInstrumentsForSegment(selectedSegment);

      // Filter instruments based on conditions
      const results: ScanResult[] = [];

      segmentInstruments.forEach((instrument) => {
        const instrumentData = marketData[instrument.key];

        if (!instrumentData) return; // Skip if no data available

        // Get relevant data for this instrument
        const currentPrice = instrumentData.lastPrice || 0;
        const percentChange =
          instrumentData.ff?.indexFF?.ltpc?.change_percentage || 0;
        const dailyOHLC = instrumentData.dailyOHLC || {};

        // Create a map of all available field values for condition checking
        const fieldValues: Record<string, any> = {
          open: parseFloat(dailyOHLC.open) || 0,
          high: parseFloat(dailyOHLC.high) || 0,
          low: parseFloat(dailyOHLC.low) || 0,
          close: currentPrice || parseFloat(dailyOHLC.close) || 0,
          volume: parseFloat(dailyOHLC.volume) || 0,
          percentChange: percentChange,
        };

        // Check each condition for this instrument
        let matchedConditions = 0;

        for (const condition of conditions) {
          const { field, operator, value, timeframe } = condition;

          // Get the field value (handling timeframes would require historical data)
          const fieldValue = fieldValues[field] || 0;
          const comparisonValue = parseFloat(value);

          // Skip invalid conditions
          if (isNaN(comparisonValue)) continue;

          // Check if condition is met
          let isConditionMet = false;

          switch (operator) {
            case "greaterThan":
              isConditionMet = fieldValue > comparisonValue;
              break;
            case "lessThan":
              isConditionMet = fieldValue < comparisonValue;
              break;
            case "greaterThanEqual":
              isConditionMet = fieldValue >= comparisonValue;
              break;
            case "lessThanEqual":
              isConditionMet = fieldValue <= comparisonValue;
              break;
            case "equals":
              isConditionMet = fieldValue === comparisonValue;
              break;
            case "notEquals":
              isConditionMet = fieldValue !== comparisonValue;
              break;
            // Crossing conditions would require historical data
            default:
              isConditionMet = false;
          }

          if (isConditionMet) {
            matchedConditions++;
          }
        }

        // Add to results if meeting the match criteria
        const shouldInclude =
          matchMode === "all"
            ? matchedConditions === conditions.length
            : matchedConditions > 0;

        if (shouldInclude) {
          results.push({
            instrumentKey: instrument.key,
            instrumentName: instrument.label,
            currentPrice,
            percentChange,
            matchedConditions,
            fieldValues,
          });
        }
      });

      // Sort results
      const sortedResults = [...results].sort((a, b) => {
        if (sortField === "instrumentName") {
          return sortDirection === "asc"
            ? a.instrumentName.localeCompare(b.instrumentName)
            : b.instrumentName.localeCompare(a.instrumentName);
        } else if (sortField === "currentPrice") {
          return sortDirection === "asc"
            ? a.currentPrice - b.currentPrice
            : b.currentPrice - a.currentPrice;
        } else if (sortField === "percentChange") {
          return sortDirection === "asc"
            ? a.percentChange - b.percentChange
            : b.percentChange - a.percentChange;
        }
        return 0;
      });

      setScanResults(sortedResults);
    } catch (error) {
      console.error("Error running scan:", error);
    } finally {
      setIsScanning(false);
    }
  };

  // Handle sorting
  const handleSort = (field: string) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // New field, default to asc
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Clear all conditions
  const clearConditions = () => {
    setConditions([]);
  };

  // Format a number with commas and decimals
  const formatNumber = (num: number, decimals = 2) => {
    return num.toLocaleString("en-IN", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  // Load a template scan
  const loadTemplate = (templateIndex: number) => {
    const template = SCAN_TEMPLATES[templateIndex];
    if (template) {
      // Generate new unique IDs for the conditions
      const conditionsWithNewIds = template.data.conditions.map((cond) => ({
        ...cond,
        id: generateId(),
      }));
      setConditions(conditionsWithNewIds);
      setSelectedSegment(template.data.segment);
      setMatchMode(template.data.matchMode);
    }
  };

  // Export results as CSV
  const exportToCsv = () => {
    if (scanResults.length === 0) return;

    // Prepare CSV headers and content
    const headers = ["Stock", "Price", "Change %", "Matched Conditions"];

    // Add additional columns for field values
    PRICE_FIELDS.forEach((field) => {
      headers.push(field.label);
    });

    // Convert results to CSV rows
    const rows = scanResults.map((result) => {
      const row = [
        result.instrumentName,
        result.currentPrice.toString(),
        result.percentChange.toString(),
        `${result.matchedConditions}/${conditions.length}`,
      ];

      // Add values for each field
      PRICE_FIELDS.forEach((field) => {
        row.push(result.fieldValues[field.value]?.toString() || "N/A");
      });

      return row;
    });

    // Combine headers and rows
    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    // Create a Blob and download link
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `stock-scan-${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Stock Scanner</CardTitle>
        <div className="flex space-x-2">
          <Badge variant={isConnected ? "default" : "destructive"}>
            {isConnected ? "Connected" : "Disconnected"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {/* Segment Selection */}
        <div className="mb-6">
          <div className="flex flex-row items-center gap-4 mb-2">
            <label className="text-sm font-medium">Stock</label>
            <Select
              value={matchMode}
              onValueChange={(value) => setMatchMode(value as MatchMode)}
            >
              <SelectTrigger className="w-24">
                <SelectValue>
                  {matchMode === "all" ? "passes all" : "passes any"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">passes all</SelectItem>
                <SelectItem value="any">passes any</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm">of the below filters in</span>
            <Select
              value={selectedSegment}
              onValueChange={(value) =>
                setSelectedSegment(value as MarketSegment)
              }
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Select a segment" />
              </SelectTrigger>
              <SelectContent>
                {SEGMENTS.map((segment) => (
                  <SelectItem key={segment.value} value={segment.value}>
                    {segment.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm">segment:</span>
          </div>
        </div>

        {/* Saved Scans Dropdown */}
        <div className="mb-4 flex gap-2">
          {savedScans.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">Load Saved Scan</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Saved Scans</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {savedScans.map((scan, index) => (
                  <DropdownMenuItem
                    key={index}
                    className="flex justify-between items-center"
                    onClick={() => loadScan(index)}
                  >
                    <span>{scan.name}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteScan(index);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Templates Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">Use Template</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Predefined Templates</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {SCAN_TEMPLATES.map((template, index) => (
                <DropdownMenuItem
                  key={index}
                  onClick={() => loadTemplate(index)}
                >
                  {template.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Conditions */}
        <div className="space-y-4 mb-6">
          {conditions.map((condition) => (
            <div key={condition.id} className="flex items-center space-x-2">
              <Select
                value={condition.timeframe}
                onValueChange={(value) =>
                  updateCondition(condition.id, { timeframe: value })
                }
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Timeframe" />
                </SelectTrigger>
                <SelectContent>
                  {TIMEFRAMES.map((timeframe) => (
                    <SelectItem key={timeframe.value} value={timeframe.value}>
                      {timeframe.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={condition.field}
                onValueChange={(value) =>
                  updateCondition(condition.id, { field: value })
                }
              >
                <SelectTrigger className="w-28">
                  <SelectValue placeholder="Field" />
                </SelectTrigger>
                <SelectContent>
                  {PRICE_FIELDS.map((field) => (
                    <SelectItem key={field.value} value={field.value}>
                      {field.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={condition.operator}
                onValueChange={(value) =>
                  updateCondition(condition.id, { operator: value })
                }
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Operator" />
                </SelectTrigger>
                <SelectContent>
                  {COMPARISON_OPERATORS.map((operator) => (
                    <SelectItem key={operator.value} value={operator.value}>
                      {operator.label} ({operator.symbol})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                type="number"
                placeholder="Value"
                className="w-32"
                value={condition.value}
                onChange={(e) =>
                  updateCondition(condition.id, { value: e.target.value })
                }
              />

              <Button
                variant="outline"
                size="icon"
                onClick={() => removeCondition(condition.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <div className="flex space-x-2">
            <Button variant="outline" size="sm" onClick={addCondition}>
              <Plus className="h-4 w-4 mr-2" />
              Add Condition
            </Button>

            {conditions.length > 0 && (
              <Button variant="outline" size="sm" onClick={clearConditions}>
                <FilterX className="h-4 w-4 mr-2" />
                Clear All
              </Button>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between mb-6">
          <Button
            onClick={runScan}
            disabled={isScanning || !isConnected || conditions.length === 0}
          >
            <Filter className="h-4 w-4 mr-2" />
            Run Scan
          </Button>

          <Sheet open={isSaveModalOpen} onOpenChange={setIsSaveModalOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                disabled={isScanning || conditions.length === 0}
              >
                <Save className="h-4 w-4 mr-2" />
                Save Scan
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Save Scan</SheetTitle>
                <SheetDescription>
                  Give your scan a name to save it for future use.
                </SheetDescription>
              </SheetHeader>
              <div className="py-4">
                <Input
                  placeholder="Enter scan name..."
                  value={scanName}
                  onChange={(e) => setScanName(e.target.value)}
                  className="mb-4"
                />
                <div className="text-sm text-muted-foreground mb-4">
                  This will save your current conditions and filters.
                </div>
              </div>
              <SheetFooter>
                <SheetClose asChild>
                  <Button variant="outline">Cancel</Button>
                </SheetClose>
                <Button onClick={saveScan} disabled={!scanName.trim()}>
                  Save
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        </div>

        {/* Results */}
        {scanResults.length > 0 && (
          <div>
            <div className="mb-2 flex justify-between items-center">
              <h3 className="text-lg font-medium">
                Results ({scanResults.length} stocks)
              </h3>
              <div className="flex space-x-2">
                <Button variant="outline" size="sm" onClick={exportToCsv}>
                  Export CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setScanResults([])}
                >
                  Clear Results
                </Button>
              </div>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort("instrumentName")}
                    >
                      Stock
                      {sortField === "instrumentName" &&
                        (sortDirection === "asc" ? (
                          <ArrowDown className="inline h-4 w-4 ml-1" />
                        ) : (
                          <ArrowUp className="inline h-4 w-4 ml-1" />
                        ))}
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort("currentPrice")}
                    >
                      Price
                      {sortField === "currentPrice" &&
                        (sortDirection === "asc" ? (
                          <ArrowDown className="inline h-4 w-4 ml-1" />
                        ) : (
                          <ArrowUp className="inline h-4 w-4 ml-1" />
                        ))}
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort("percentChange")}
                    >
                      Change %
                      {sortField === "percentChange" &&
                        (sortDirection === "asc" ? (
                          <ArrowDown className="inline h-4 w-4 ml-1" />
                        ) : (
                          <ArrowUp className="inline h-4 w-4 ml-1" />
                        ))}
                    </TableHead>
                    <TableHead className="text-right">Conditions Met</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scanResults.map((result) => (
                    <TableRow key={result.instrumentKey}>
                      <TableCell className="font-medium">
                        {result.instrumentName}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(result.currentPrice)}
                      </TableCell>
                      <TableCell
                        className={`text-right ${
                          result.percentChange >= 0
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {result.percentChange >= 0 ? "+" : ""}
                        {formatNumber(result.percentChange, 2)}%
                      </TableCell>
                      <TableCell className="text-right">
                        {result.matchedConditions}/{conditions.length}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* No results message */}
        {scanResults.length === 0 && conditions.length > 0 && !isScanning && (
          <div className="text-center py-6 text-muted-foreground">
            No stocks match your criteria. Try adjusting your filters or running
            the scan again.
          </div>
        )}

        {/* Loading indicator */}
        {isScanning && (
          <div className="text-center py-6">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
            <p className="text-muted-foreground">Scanning stocks...</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
