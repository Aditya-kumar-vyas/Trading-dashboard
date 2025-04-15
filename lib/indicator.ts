import { OHLCData, PriceField } from "../app/types";
import { getLastValue } from "./utils";

/**
 * Calculate Average True Range (ATR)
 * ATR is the greatest of:
 * - Current high less the current low
 * - Absolute value of current high less previous close
 * - Absolute value of current low less previous close
 */
export const calculateATR = (data: OHLCData[], period: number = 14): number[] => {
  if (!data || data.length < 2) return [];
  
  // Sort data by timestamp in ascending order (oldest first)
  const sortedData = [...data].sort((a, b) => {
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });
  console.log("sortedData-ATR", sortedData);
  // Calculate true ranges first
  const trueRanges: number[] = [];
  
  for (let i = 1; i < sortedData.length; i++) {
    const current = sortedData[i];
    const previous = sortedData[i - 1];
    
    const tr1 = current.high - current.low; // Current high less current low
    const tr2 = Math.abs(current.high - previous.close); // Abs of current high less previous close
    const tr3 = Math.abs(current.low - previous.close); // Abs of current low less previous close
    
    const trueRange = Math.max(tr1, tr2, tr3);
    trueRanges.push(trueRange);
  }
  
  // For initial ATR, take simple average of first 'period' true ranges
  let atr: number[] = [];
  
  if (trueRanges.length >= period) {
    // Initial ATR is just the average of the first 'period' true ranges
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += trueRanges[i];
    }
    atr.push(sum / period);
    
    // Calculate subsequent ATRs using the smoothing formula:
    // ATR = ((Prior ATR * (period - 1)) + Current TR) / period
    for (let i = period; i < trueRanges.length; i++) {
      const currentAtr = ((atr[atr.length - 1] * (period - 1)) + trueRanges[i]) / period;
      atr.push(currentAtr);
    }
  }
  
  return atr;
};

/**
 * Calculate Wilder's ATR (WATR)
 * Uses Wilder's smoothing method for ATR calculation
 */
export const calculateWATR = (data: OHLCData[], period: number = 14): number[] => {
  return calculateATR(data, period); // For this implementation, we use the same calculation
};

/**
 * Calculate Modified ATR (MATR)
 * This implementation assumes a slight modification using EMA
 */
export const calculateMATR = (data: OHLCData[], period: number = 14): number[] => {
  if (!data || data.length < 2) return [];
  
  // Sort data by timestamp in ascending order (oldest first)
  const sortedData = [...data].sort((a, b) => {
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });
  
  // Calculate true ranges first
  const trueRanges: number[] = [];
  
  for (let i = 1; i < sortedData.length; i++) {
    const current = sortedData[i];
    const previous = sortedData[i - 1];
    
    const tr1 = current.high - current.low; // Current high less current low
    const tr2 = Math.abs(current.high - previous.close); // Abs of current high less previous close
    const tr3 = Math.abs(current.low - previous.close); // Abs of current low less previous close
    
    const trueRange = Math.max(tr1, tr2, tr3);
    trueRanges.push(trueRange);
  }
  
  // Simplified MATR uses an exponential smoothing with alpha = 2/(period+1)
  let matr: number[] = [];
  
  if (trueRanges.length >= period) {
    // Initial MATR is just the average of the first 'period' true ranges
    let sum = 0;
    for (let i = 0; i < period; i++) {
      sum += trueRanges[i];
    }
    matr.push(sum / period);
    
    // Alpha factor for EMA calculation
    const alpha = 2 / (period + 1);
    
    // Calculate subsequent MATRs using the EMA formula
    for (let i = period; i < trueRanges.length; i++) {
      const currentMatr = (trueRanges[i] * alpha) + (matr[matr.length - 1] * (1 - alpha));
      matr.push(currentMatr);
    }
  }
  
  return matr;
};

/**
 * Calculate Volume-Adjusted ATR (VATR)
 * This applies volume weighting to the ATR calculation
 */
export const calculateVATR = (data: OHLCData[], period: number = 14): number[] => {
  // This is a simplified example assuming OHLCData has a volume property
  // In a real implementation, ensure your data includes volume information
  if (!data || data.length < 2) return [];
  
  // If data doesn't have volume information, default to regular ATR
  if (!('volume' in data[0])) {
    return calculateATR(data, period);
  }
  
  // Sort data by timestamp in ascending order (oldest first)
  const sortedData = [...data].sort((a, b) => {
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });
  
  // Calculate volume-weighted true ranges
  const trueRanges: number[] = [];
  const volumeRatios: number[] = [];
  
  // First, get average volume for normalization
  let totalVolume = 0;
  for (let i = 1; i < sortedData.length; i++) {
    totalVolume += sortedData[i].volume || 1;
  }
  const avgVolume = totalVolume / (sortedData.length - 1);
  
  for (let i = 1; i < sortedData.length; i++) {
    const current = sortedData[i];
    const previous = sortedData[i - 1];
    
    const tr1 = current.high - current.low; 
    const tr2 = Math.abs(current.high - previous.close);
    const tr3 = Math.abs(current.low - previous.close);
    
    const trueRange = Math.max(tr1, tr2, tr3);
    
    // Apply volume weighting (normalize by average volume)
    const volumeRatio = (current.volume || 1) / avgVolume;
    volumeRatios.push(volumeRatio);
    trueRanges.push(trueRange * volumeRatio);
  }
  
  // Calculate VATR
  let vatr: number[] = [];
  
  if (trueRanges.length >= period) {
    // Initial VATR
    let sumTR = 0;
    let sumVol = 0;
    for (let i = 0; i < period; i++) {
      sumTR += trueRanges[i];
      sumVol += volumeRatios[i];
    }
    vatr.push(sumTR / sumVol);
    
    // Subsequent VATR calculations
    for (let i = period; i < trueRanges.length; i++) {
      // Use EMA-style smoothing with volume adjustment
      const alpha = 2 / (period + 1);
      const currentVatr = (trueRanges[i] * alpha) + (vatr[vatr.length - 1] * (1 - alpha));
      vatr.push(currentVatr);
    }
  }
  
  return vatr;
};

/**
 * Calculate Simple Moving Average (SMA)
 */
export const calculateSMA = (data: number[], period: number): number[] => {
  const sma: number[] = [];
  
  if (data.length < period) {
    return sma;
  }
  
  // Calculate initial SMA
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i];
  }
  sma.push(sum / period);
  
  // Calculate remaining SMAs
  for (let i = period; i < data.length; i++) {
    // Remove oldest value, add newest value
    sum = sum - data[i - period] + data[i];
    sma.push(sum / period);
  }
  
  return sma;
};

/**
 * Calculate Exponential Moving Average (EMA)
 */
export const calculateEMA = (data: number[], period: number): number[] => {
  const ema: number[] = [];
  
  if (data.length < period) {
    return ema;
  }
  
  // Calculate initial SMA as the first EMA value
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += data[i];
  }
  ema.push(sum / period);
  
  // Multiplier for EMA calculation
  const multiplier = 2 / (period + 1);
  
  // Calculate remaining EMAs
  for (let i = period; i < data.length; i++) {
    const currentEma = (data[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1];
    ema.push(currentEma);
  }
  
  return ema;
};

/**
 * Calculate SMA for a specific period for OHLC data
 */
export const calculateOHLCSMA = (
  data: OHLCData[], 
  period: number, 
  field: PriceField = 'close'
): number[] => {
  if (!data || data.length < period) return [];
  
  // Sort data by timestamp in ascending order (oldest first)
  const sortedData = [...data].sort((a, b) => {
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });
  
  // Extract the field values
  const fieldValues = sortedData.map(candle => candle[field]);
  
  // Calculate the SMA
  return calculateSMA(fieldValues, period);
};

/**
 * Calculate EMA for a specific period for OHLC data
 */
export const calculateOHLCEMA = (
  data: OHLCData[], 
  period: number, 
  field: PriceField = 'close'
): number[] => {
  if (!data || data.length < period) return [];
  
  // Sort data by timestamp in ascending order (oldest first)
  const sortedData = [...data].sort((a, b) => {
    return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
  });
  
  // Extract the field values
  const fieldValues = sortedData.map(candle => candle[field]);
  console.log("fieldValues", fieldValues);
  
  // Calculate the EMA
  return calculateEMA(fieldValues, period);
};

/**
 * Get the latest value of a technical indicator
 */
export const getIndicatorLastValue = (values: number[]): number | null => {
  return getLastValue(values);
};

/**
 * Helper function to calculate a technical indicator and return the last value
 */
export const calculateIndicator = (
  data: OHLCData[], 
  indicator: 'ATR' | 'WATR' | 'MATR' | 'VATR' | 'SMA' | 'EMA', 
  period: number,
  field: PriceField = 'close'
): number | null => {
  if (!data || data.length === 0) return null;

  let values: number[] = [];
  
  switch (indicator) {
    case 'ATR':
      values = calculateATR(data, period);
      break;
    case 'WATR':
      values = calculateWATR(data, period);
      break;
    case 'MATR':
      values = calculateMATR(data, period);
      break;
    case 'VATR':
      values = calculateVATR(data, period);
      break;
    case 'SMA':
      values = calculateOHLCSMA(data, period, field);
      break;
    case 'EMA':
      values = calculateOHLCEMA(data, period, field);
      break;
    default:
      return null;
  }
  
  return getIndicatorLastValue(values);
};
/**
 * Fibonacci Ratios commonly used in technical analysis
 */
export const FIBONACCI_RATIOS = {
  R0: 0,
  R236: 0.236,
  R382: 0.382,
  R500: 0.5,
  R618: 0.618,
  R786: 0.786,
  R1000: 1.0,
  R1618: 1.618,
  R2618: 2.618,
  R3618: 3.618,
  R4236: 4.236
};

/**
 * Pivot Point Types
 */
export enum PivotType {
  STANDARD = "standard",
  FIBONACCI = "fibonacci",
  CAMARILLA = "camarilla",
  WOODIE = "woodie",
  DEMARK = "demark",
  CPR = "cpr" // Central Pivot Range
}

/**
 * Interface for Standard Pivot Points
 */
export interface StandardPivotPoints {
  pivot: number;       // Central pivot point
  r1: number;          // Resistance 1
  r2: number;          // Resistance 2
  r3: number;          // Resistance 3
  s1: number;          // Support 1
  s2: number;          // Support 2
  s3: number;          // Support 3
}

/**
 * Interface for Fibonacci Pivot Points
 */
export interface FibonacciPivotPoints extends StandardPivotPoints {
  r4: number;          // Resistance 4
  r5: number;          // Resistance 5
  s4: number;          // Support 4
  s5: number;          // Support 5
}

/**
 * Interface for Camarilla Pivot Points
 */
export interface CamarillaPivotPoints {
  pivot: number;
  r1: number;
  r2: number;
  r3: number;
  r4: number;
  s1: number;
  s2: number;
  s3: number;
  s4: number;
}

/**
 * Interface for Woodie Pivot Points
 */
export interface WoodiePivotPoints {
  pivot: number;
  r1: number;
  r2: number;
  s1: number;
  s2: number;
}

/**
 * Interface for DeMark Pivot Points
 */
export interface DeMarkPivotPoints {
  pivot: number;
  r1: number;
  s1: number;
}

/**
 * Interface for Central Pivot Range
 */
export interface CPRPivotPoints {
  tc: number;         // Top Central Pivot
  pivot: number;      // Central Pivot
  bc: number;         // Bottom Central Pivot
}

/**
 * Calculate Floor Pivot Points (Standard)
 * The calculation for the floor trader pivot points is straightforward:
 * - Pivot (PP) = (High + Low + Close) / 3
 * - Support 1 (S1) = (2 * PP) - High
 * - Support 2 (S2) = PP - (High - Low)
 * - Support 3 (S3) = Low - 2 * (High - PP)
 * - Resistance 1 (R1) = (2 * PP) - Low
 * - Resistance 2 (R2) = PP + (High - Low)
 * - Resistance 3 (R3) = High + 2 * (PP - Low)
 * 
 * @param prevHigh Previous period's high
 * @param prevLow Previous period's low
 * @param prevClose Previous period's close
 * @returns Standard pivot points
 */
export function calculateStandardPivots(
  prevHigh: number,
  prevLow: number,
  prevClose: number
): StandardPivotPoints {
  const pivot = (prevHigh + prevLow + prevClose) / 3;
  
  const r1 = (2 * pivot) - prevLow;
  const r2 = pivot + (prevHigh - prevLow);
  const r3 = prevHigh + 2 * (pivot - prevLow);
  
  const s1 = (2 * pivot) - prevHigh;
  const s2 = pivot - (prevHigh - prevLow);
  const s3 = prevLow - 2 * (prevHigh - pivot);

  return {
    pivot,
    r1,
    r2,
    r3,
    s1,
    s2,
    s3
  };
}

/**
 * Calculate Fibonacci Pivot Points
 * Fibonacci pivot points use the Fibonacci ratios to calculate support and resistance levels.
 * 
 * @param prevHigh Previous period's high
 * @param prevLow Previous period's low
 * @param prevClose Previous period's close
 * @returns Fibonacci pivot points
 */
export function calculateFibonacciPivots(
  prevHigh: number,
  prevLow: number,
  prevClose: number
): FibonacciPivotPoints {
  const pivot = (prevHigh + prevLow + prevClose) / 3;
  const range = prevHigh - prevLow;

  // Calculate Fibonacci levels
  const r1 = pivot + (FIBONACCI_RATIOS.R382 * range);
  const r2 = pivot + (FIBONACCI_RATIOS.R618 * range);
  const r3 = pivot + (FIBONACCI_RATIOS.R1000 * range);
  const r4 = pivot + (FIBONACCI_RATIOS.R1618 * range);
  const r5 = pivot + (FIBONACCI_RATIOS.R2618 * range);

  const s1 = pivot - (FIBONACCI_RATIOS.R382 * range);
  const s2 = pivot - (FIBONACCI_RATIOS.R618 * range);
  const s3 = pivot - (FIBONACCI_RATIOS.R1000 * range);
  const s4 = pivot - (FIBONACCI_RATIOS.R1618 * range);
  const s5 = pivot - (FIBONACCI_RATIOS.R2618 * range);

  return {
    pivot,
    r1,
    r2,
    r3,
    r4,
    r5,
    s1,
    s2,
    s3,
    s4,
    s5
  };
}

/**
 * Calculate Camarilla Pivot Points
 * Camarilla pivot points use specific multipliers to calculate intraday support and resistance levels.
 * 
 * @param prevHigh Previous period's high
 * @param prevLow Previous period's low
 * @param prevClose Previous period's close
 * @returns Camarilla pivot points
 */
export function calculateCamarillaPivots(
  prevHigh: number,
  prevLow: number,
  prevClose: number
): CamarillaPivotPoints {
  const pivot = (prevHigh + prevLow + prevClose) / 3;
  const range = prevHigh - prevLow;

  // Camarilla multipliers
  const r1 = prevClose + (range * 1.1 / 12);
  const r2 = prevClose + (range * 1.1 / 6);
  const r3 = prevClose + (range * 1.1 / 4);
  const r4 = prevClose + (range * 1.1 / 2);

  const s1 = prevClose - (range * 1.1 / 12);
  const s2 = prevClose - (range * 1.1 / 6);
  const s3 = prevClose - (range * 1.1 / 4);
  const s4 = prevClose - (range * 1.1 / 2);

  return {
    pivot,
    r1,
    r2,
    r3,
    r4,
    s1,
    s2,
    s3,
    s4
  };
}

/**
 * Calculate Woodie Pivot Points
 * Woodie pivot points give more weight to the closing price of the previous period.
 * 
 * @param prevHigh Previous period's high
 * @param prevLow Previous period's low
 * @param prevClose Previous period's close
 * @param currentOpen Current period's open
 * @returns Woodie pivot points
 */
export function calculateWoodiePivots(
  prevHigh: number,
  prevLow: number,
  prevClose: number,
  currentOpen: number
): WoodiePivotPoints {
  // Woodie's formula for pivot point
  const pivot = (prevHigh + prevLow + (2 * prevClose)) / 4;
  
  const r1 = (2 * pivot) - prevLow;
  const r2 = pivot + (prevHigh - prevLow);
  
  const s1 = (2 * pivot) - prevHigh;
  const s2 = pivot - (prevHigh - prevLow);

  return {
    pivot,
    r1,
    r2,
    s1,
    s2
  };
}

/**
 * Calculate DeMark Pivot Points
 * DeMark pivot points use a different formula based on the relationship between open and close.
 * 
 * @param prevHigh Previous period's high
 * @param prevLow Previous period's low
 * @param prevOpen Previous period's open
 * @param prevClose Previous period's close
 * @returns DeMark pivot points
 */
export function calculateDeMarkPivots(
  prevHigh: number,
  prevLow: number,
  prevOpen: number,
  prevClose: number
): DeMarkPivotPoints {
  // Different calculation based on Open/Close relationship
  let x: number;
  
  if (prevClose < prevOpen) {
    x = prevHigh + (2 * prevLow) + prevClose;
  } else if (prevClose > prevOpen) {
    x = (2 * prevHigh) + prevLow + prevClose;
  } else { // prevClose == prevOpen
    x = prevHigh + prevLow + (2 * prevClose);
  }
  
  const pivot = x / 4;
  
  const r1 = (x / 2) - prevLow;
  const s1 = (x / 2) - prevHigh;

  return {
    pivot,
    r1,
    s1
  };
}

/**
 * Calculate Central Pivot Range (CPR)
 * CPR consists of three levels: Top Central Pivot (TC), Central Pivot (P), and Bottom Central Pivot (BC).
 * 
 * @param prevHigh Previous period's high
 * @param prevLow Previous period's low
 * @param prevClose Previous period's close
 * @returns CPR pivot points
 */
export function calculateCPRPivots(
  prevHigh: number,
  prevLow: number,
  prevClose: number
): CPRPivotPoints {
  // Central Pivot Point
  const pivot = (prevHigh + prevLow + prevClose) / 3;
  
  // BC (Bottom Central) Pivot
  const bc = (prevHigh + prevLow) / 2;
  
  // TC (Top Central) Pivot
  const tc = (pivot - bc) + pivot;

  return {
    tc,
    pivot,
    bc
  };
}

/**
 * Calculate Fibonacci Extensions
 * Calculate Fibonacci extension levels based on a swing high and low
 *
 * @param swingHigh The highest price in the swing
 * @param swingLow The lowest price in the swing
 * @param isUptrend Whether the market is in an uptrend (true) or downtrend (false)
 * @returns Object containing Fibonacci extension levels
 */
export function calculateFibonacciExtensions(
  swingHigh: number,
  swingLow: number,
  isUptrend: boolean
) {
  const range = swingHigh - swingLow;
  
  if (isUptrend) {
    // Extensions above swing high in an uptrend
    return {
      ext0: swingHigh,
      ext618: swingHigh + (FIBONACCI_RATIOS.R618 * range),
      ext1000: swingHigh + (FIBONACCI_RATIOS.R1000 * range),
      ext1618: swingHigh + (FIBONACCI_RATIOS.R1618 * range),
      ext2618: swingHigh + (FIBONACCI_RATIOS.R2618 * range),
      ext3618: swingHigh + (FIBONACCI_RATIOS.R3618 * range),
      ext4236: swingHigh + (FIBONACCI_RATIOS.R4236 * range)
    };
  } else {
    // Extensions below swing low in a downtrend
    return {
      ext0: swingLow,
      ext618: swingLow - (FIBONACCI_RATIOS.R618 * range),
      ext1000: swingLow - (FIBONACCI_RATIOS.R1000 * range),
      ext1618: swingLow - (FIBONACCI_RATIOS.R1618 * range),
      ext2618: swingLow - (FIBONACCI_RATIOS.R2618 * range),
      ext3618: swingLow - (FIBONACCI_RATIOS.R3618 * range),
      ext4236: swingLow - (FIBONACCI_RATIOS.R4236 * range)
    };
  }
}

/**
 * Calculate Fibonacci Retracements
 * Calculate Fibonacci retracement levels between a swing high and low
 *
 * @param swingHigh The highest price in the swing
 * @param swingLow The lowest price in the swing
 * @param isUptrend Whether the market is in an uptrend (true) or downtrend (false)
 * @returns Object containing Fibonacci retracement levels
 */
export function calculateFibonacciRetracements(
  swingHigh: number,
  swingLow: number,
  isUptrend: boolean
) {
  const range = swingHigh - swingLow;
  
  if (isUptrend) {
    // Retracements below swing high in an uptrend
    return {
      ret0: swingHigh,
      ret236: swingHigh - (FIBONACCI_RATIOS.R236 * range),
      ret382: swingHigh - (FIBONACCI_RATIOS.R382 * range),
      ret500: swingHigh - (FIBONACCI_RATIOS.R500 * range),
      ret618: swingHigh - (FIBONACCI_RATIOS.R618 * range),
      ret786: swingHigh - (FIBONACCI_RATIOS.R786 * range),
      ret1000: swingLow
    };
  } else {
    // Retracements above swing low in a downtrend
    return {
      ret0: swingLow,
      ret236: swingLow + (FIBONACCI_RATIOS.R236 * range),
      ret382: swingLow + (FIBONACCI_RATIOS.R382 * range),
      ret500: swingLow + (FIBONACCI_RATIOS.R500 * range),
      ret618: swingLow + (FIBONACCI_RATIOS.R618 * range),
      ret786: swingLow + (FIBONACCI_RATIOS.R786 * range),
      ret1000: swingHigh
    };
  }
}

/**
 * Find the most recent trading day's candle data
 * This function handles market holidays by searching backward until it finds valid data
 * @param candles Array of OHLC data sorted by time (oldest to newest)
 * @param currentIndex Index of the "current" candle
 * @returns The most recent valid trading day's candle or null if not found
 */
export function findMostRecentTradingDay(
  candles: OHLCData[],
  currentIndex: number = candles.length - 1
): OHLCData | null {
  if (candles.length === 0 || currentIndex < 1) {
    return null;
  }

  // Look back a maximum of 10 days to find a valid trading day
  const maxLookback = 10;
  let lookback = 1;

  // Expected date would be exactly 1 day back (typical case)
  const expectedPreviousDay = currentIndex - 1;
  const expectedDate = candles[expectedPreviousDay]?.timestamp 
    ? new Date(candles[expectedPreviousDay].timestamp) 
    : null;

  while (lookback <= maxLookback && currentIndex - lookback >= 0) {
    const previousCandle = candles[currentIndex - lookback];
    
    // A valid trading day candle should have reasonable OHLC values
    // Checking for zeroes or very small values that might indicate a holiday or non-trading day
    if (
      previousCandle &&
      previousCandle.high > 0 &&
      previousCandle.low > 0 &&
      previousCandle.open > 0 &&
      previousCandle.close > 0 &&
      // Additional check: high should be greater than or equal to low (sanity check)
      previousCandle.high >= previousCandle.low
    ) {
      // Log when we had to look back further than 1 day (indicating holiday handling)
      if (lookback > 1) {
        const actualDate = new Date(previousCandle.timestamp);
        console.log(
          `Market holiday detected: Using trading data from ${actualDate.toLocaleDateString()} instead of ${expectedDate?.toLocaleDateString() || 'expected date'}`
        );
      }
      
      return previousCandle;
    }
    
    lookback++;
  }
  
  // If we exhausted our lookback and still didn't find a valid candle
  console.warn(`Could not find valid trading data in the last ${maxLookback} days`);
  return null;
}

/**
 * Get pivot points for a specific candle using the previous period's data
 * @param candles Array of OHLC data sorted by time (oldest to newest)
 * @param pivotType Type of pivot points to calculate
 * @param index Index of the candle to calculate pivots for (uses previous candle's data)
 * @returns The requested pivot points or null if not enough data
 */
export function getPivotPoints(
  candles: OHLCData[],
  pivotType: PivotType,
  index: number = candles.length - 1
) {
  // Need at least two candles (previous and current)
  if (candles.length < 2 || index < 1 || index >= candles.length) {
    return null;
  }

  // Get the most recent valid trading day's data
  const tradingDayCandle = findMostRecentTradingDay(candles, index);
  
  if (!tradingDayCandle) {
    console.warn("Could not find a recent valid trading day's data for pivot calculation");
    return null;
  }
  
  // Previous candle data for pivot calculation (using the most recent trading day)
  const prevHigh = tradingDayCandle.high;
  const prevLow = tradingDayCandle.low;
  const prevClose = tradingDayCandle.close;
  const prevOpen = tradingDayCandle.open;
  
  // Current candle data (needed for some pivot types)
  const currentCandle = candles[index];
  const currentOpen = currentCandle.open;

  // Calculate requested pivot type
  switch (pivotType) {
    case PivotType.STANDARD:
      return calculateStandardPivots(prevHigh, prevLow, prevClose);
    
    case PivotType.FIBONACCI:
      return calculateFibonacciPivots(prevHigh, prevLow, prevClose);
    
    case PivotType.CAMARILLA:
      return calculateCamarillaPivots(prevHigh, prevLow, prevClose);
    
    case PivotType.WOODIE:
      return calculateWoodiePivots(prevHigh, prevLow, prevClose, currentOpen);
    
    case PivotType.DEMARK:
      return calculateDeMarkPivots(prevHigh, prevLow, prevOpen, prevClose);
    
    case PivotType.CPR:
      return calculateCPRPivots(prevHigh, prevLow, prevClose);
    
    default:
      return calculateStandardPivots(prevHigh, prevLow, prevClose);
  }
}

/**
 * Find swing high and low in a range of candles
 * @param candles Array of OHLC data
 * @param lookbackPeriod Number of candles to look back
 * @returns Object containing swing high and low values
 */
export function findSwingHighLow(
  candles: OHLCData[],
  lookbackPeriod: number = 20
) {
  if (candles.length === 0) return { swingHigh: 0, swingLow: 0 };
  
  // Get subset of candles for analysis
  const subset = candles.slice(-Math.min(lookbackPeriod, candles.length));
  
  // Find swing high and low
  const swingHigh = Math.max(...subset.map(candle => candle.high));
  const swingLow = Math.min(...subset.map(candle => candle.low));
  
  return { swingHigh, swingLow };
}

/**
 * Determine market trend based on closing prices
 * @param candles Array of OHLC data
 * @param lookbackPeriod Number of candles to consider for trend
 * @returns Boolean indicating if market is in uptrend
 */
export function isUptrend(candles: OHLCData[], lookbackPeriod: number = 10): boolean {
  if (candles.length < lookbackPeriod) return true;
  
  const recentCandles = candles.slice(-lookbackPeriod);
  const firstClose = recentCandles[0].close;
  const lastClose = recentCandles[recentCandles.length - 1].close;
  
  return lastClose > firstClose;
}

/**
 * Calculate all pivot types for the most recent candle
 * @param candles Array of OHLC data sorted by time (oldest to newest)
 * @returns Object containing all pivot point calculations
 */
export function getAllPivotPoints(candles: OHLCData[]) {
  if (candles.length < 2) return null;
  
  // Find the most recent valid trading day's data
  const tradingDayCandle = findMostRecentTradingDay(candles);
  if (!tradingDayCandle) {
    console.error("Could not find recent valid trading day for pivot calculations");
    return null;
  }
  
  const { swingHigh, swingLow } = findSwingHighLow(candles);
  const uptrend = isUptrend(candles);
  
  // Include the actual trading day date used for pivot calculations
  return {
    standard: getPivotPoints(candles, PivotType.STANDARD),
    fibonacci: getPivotPoints(candles, PivotType.FIBONACCI),
    camarilla: getPivotPoints(candles, PivotType.CAMARILLA),
    woodie: getPivotPoints(candles, PivotType.WOODIE),
    demark: getPivotPoints(candles, PivotType.DEMARK),
    cpr: getPivotPoints(candles, PivotType.CPR),
    fibExtensions: calculateFibonacciExtensions(swingHigh, swingLow, uptrend),
    fibRetracements: calculateFibonacciRetracements(swingHigh, swingLow, uptrend),
    tradingDate: tradingDayCandle.timestamp // Include the date of the candle used for calculations
  };
}