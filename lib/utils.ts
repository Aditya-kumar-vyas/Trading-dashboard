import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}


import { Candle, OHLCData } from "../app/types";

/**
 * Transform candle data from API format to OHLCData format
 */
export const transformCandle = (candle: Candle): OHLCData => ({
  timestamp: candle[0],
  open: candle[1],
  high: candle[2],
  low: candle[3],
  close: candle[4],
});

/**
 * Convert instrument key format for WebSocket
 * Replaces URL-encoded characters with their regular form
 */
export const formatInstrumentKeyForWS = (instrumentKey: string): string => {
  let key = instrumentKey;
  if (key.includes("%7C")) {
    key = key.replace(/%7C/g, "|").replace(/%20/g, " ");
  }
  return key;
};

/**
 * Helper function to convert ArrayBuffer to Buffer
 */
export const arrayBufferToBuffer = (arrayBuffer: ArrayBuffer): Buffer => {
  return Buffer.from(arrayBuffer);
};

/**
 * Helper function to convert Blob to ArrayBuffer
 */
export const blobToArrayBuffer = async (blob: Blob): Promise<ArrayBuffer> => {
  if ("arrayBuffer" in blob) return await blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error("Failed to read blob as array buffer"));
    reader.readAsArrayBuffer(blob);
  });
};

/**
 * Format a number with fixed decimal places
 */
export const formatNumber = (value: number | null, decimals: number = 2): string => {
  if (value === null) return "N/A";
  return value.toFixed(decimals);
};

/**
 * Get the last value from an array
 */
export const getLastValue = <T>(array: T[]): T | null => {
  if (!array || array.length === 0) return null;
  return array[array.length - 1];
};