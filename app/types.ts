export type Interval = '1minute' | '30minute' | 'day' | 'week' | 'month';

export type InstrumentOption = {
  key: string;
  label: string;
};

export type Candle = [string, number, number, number, number, number, number];

export type APIResponse = {
  status: string;
  data: {
    candles: Candle[];
  };
};

export type OHLCData = {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
};