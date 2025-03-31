
export type InstrumentOption = {
  key: string;
  label: string;
};

export type OHLCData = {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume ?: number;
};

// Types for the trading application

// API response types
export interface APIResponse {
  status: string;
  data: {
    candles: Candle[];
  };
}

// OHLC data types
export type Candle = [string, number, number, number, number]; // [timestamp, open, high, low, close]



// Interval types for API calls
export type Interval = 
  | "minute" 
  | "3minute"
  | "5minute"
  | "10minute" 
  | "30minute" 
  | "60minute" 
  | "day" 
  | "week" 
  | "month";

// Timeframe types for display
export type Timeframe =
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
  | "previousYear";

// Market data context types
export interface MarketDataContextType {
  isConnected: boolean;
  marketData: Record<string, any>;
  subscribeToInstruments: (instrumentKeys: string[]) => void;
}

// Types for technical indicators
export type IndicatorCategory = 'ma' | 'atr';

export type IndicatorType = 
  | 'SMA'  // Simple Moving Average
  | 'EMA'  // Exponential Moving Average
  | 'ATR'  // Average True Range
  | 'WATR' // Wilder's ATR
  | 'MATR' // Modified ATR
  | 'VATR' // Volume-Adjusted ATR
  | 'ST';  // Super Trend

export type PriceField = 'open' | 'high' | 'low' | 'close';