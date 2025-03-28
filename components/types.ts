// types.ts
export type Interval = 
  | "1minute"
  | "5minute" 
  | "10minute"
  | "30minute"
  | "60minute"
  | "day"
  | "week"
  | "month";

export interface OHLCData {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface APIResponse {
  status: string;
  data: {
    candles?: Candle[];
    message?: string;
  };
  message?: string;
}

export type Candle = [string, number, number, number, number]; // [timestamp, open, high, low, close]