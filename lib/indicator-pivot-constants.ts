import { PivotType } from "./indicator";

// Pivot Types with labels for display
export const PIVOT_TYPES = [
  { value: PivotType.STANDARD, label: "Standard" },
  { value: PivotType.FIBONACCI, label: "Fibonacci" },
  { value: PivotType.CAMARILLA, label: "Camarilla" },
  { value: PivotType.WOODIE, label: "Woodie" },
  { value: PivotType.DEMARK, label: "DeMark" },
  { value: PivotType.CPR, label: "Central Pivot Range (CPR)" },
];

// Pivot Levels for Standard Pivots
export const STANDARD_PIVOT_LEVELS = [
  { key: "r3", label: "R3 (Resistance 3)", description: "Strong resistance level" },
  { key: "r2", label: "R2 (Resistance 2)", description: "Moderate resistance level" },
  { key: "r1", label: "R1 (Resistance 1)", description: "Weak resistance level" },
  { key: "pivot", label: "PP (Pivot Point)", description: "Central pivot level" },
  { key: "s1", label: "S1 (Support 1)", description: "Weak support level" },
  { key: "s2", label: "S2 (Support 2)", description: "Moderate support level" },
  { key: "s3", label: "S3 (Support 3)", description: "Strong support level" },
];

// Pivot Levels for Fibonacci Pivots
export const FIBONACCI_PIVOT_LEVELS = [
  { key: "r5", label: "R5 (261.8%)", description: "Strong resistance level" },
  { key: "r4", label: "R4 (161.8%)", description: "Resistance 4" },
  { key: "r3", label: "R3 (100%)", description: "Resistance 3" },
  { key: "r2", label: "R2 (61.8%)", description: "Resistance 2" },
  { key: "r1", label: "R1 (38.2%)", description: "Resistance 1" },
  { key: "pivot", label: "PP (Pivot Point)", description: "Central pivot level" },
  { key: "s1", label: "S1 (38.2%)", description: "Support 1" },
  { key: "s2", label: "S2 (61.8%)", description: "Support 2" },
  { key: "s3", label: "S3 (100%)", description: "Support 3" },
  { key: "s4", label: "S4 (161.8%)", description: "Support 4" },
  { key: "s5", label: "S5 (261.8%)", description: "Strong support level" },
];

// Pivot Levels for Camarilla Pivots
export const CAMARILLA_PIVOT_LEVELS = [
  { key: "r4", label: "R4", description: "Strong resistance level" },
  { key: "r3", label: "R3", description: "Resistance 3" },
  { key: "r2", label: "R2", description: "Resistance 2" },
  { key: "r1", label: "R1", description: "Resistance 1" },
  { key: "pivot", label: "PP (Pivot Point)", description: "Central pivot level" },
  { key: "s1", label: "S1", description: "Support 1" },
  { key: "s2", label: "S2", description: "Support 2" },
  { key: "s3", label: "S3", description: "Support 3" },
  { key: "s4", label: "S4", description: "Strong support level" },
];

// Pivot Levels for Woodie Pivots
export const WOODIE_PIVOT_LEVELS = [
  { key: "r2", label: "R2", description: "Strong resistance level" },
  { key: "r1", label: "R1", description: "Resistance 1" },
  { key: "pivot", label: "PP (Pivot Point)", description: "Central pivot level" },
  { key: "s1", label: "S1", description: "Support 1" },
  { key: "s2", label: "S2", description: "Strong support level" },
];

// Pivot Levels for DeMark Pivots
export const DEMARK_PIVOT_LEVELS = [
  { key: "r1", label: "R1", description: "Resistance level" },
  { key: "pivot", label: "PP (Pivot Point)", description: "Central pivot level" },
  { key: "s1", label: "S1", description: "Support level" },
];

// Pivot Levels for CPR Pivots
export const CPR_PIVOT_LEVELS = [
  { key: "tc", label: "TC (Top Central)", description: "Top of central pivot range" },
  { key: "pivot", label: "PP (Pivot Point)", description: "Central pivot point" },
  { key: "bc", label: "BC (Bottom Central)", description: "Bottom of central pivot range" },
];

// Fibonacci Extensions Levels
export const FIBONACCI_EXTENSION_LEVELS = [
  { key: "ext4236", label: "423.6% Extension", description: "Extreme extension level" },
  { key: "ext3618", label: "361.8% Extension", description: "Major extension level" },
  { key: "ext2618", label: "261.8% Extension", description: "Strong extension level" },
  { key: "ext1618", label: "161.8% Extension", description: "Golden ratio extension" },
  { key: "ext1000", label: "100% Extension", description: "Equal movement extension" },
  { key: "ext618", label: "61.8% Extension", description: "Partial extension" },
  { key: "ext0", label: "0% (Base)", description: "Base level for extensions" },
];

// Fibonacci Retracement Levels
export const FIBONACCI_RETRACEMENT_LEVELS = [
  { key: "ret0", label: "0% Retracement", description: "Start of retracement" },
  { key: "ret236", label: "23.6% Retracement", description: "Shallow retracement" },
  { key: "ret382", label: "38.2% Retracement", description: "Moderate retracement" },
  { key: "ret500", label: "50% Retracement", description: "Half retracement" },
  { key: "ret618", label: "61.8% Retracement", description: "Golden ratio retracement" },
  { key: "ret786", label: "78.6% Retracement", description: "Deep retracement" },
  { key: "ret1000", label: "100% Retracement", description: "Complete retracement" },
];

// Default lookback period for swing high/low calculation
export const DEFAULT_SWING_LOOKBACK = 20;

// Default trend determination period
export const DEFAULT_TREND_LOOKBACK = 10;

// Pivot point default display options
export const DEFAULT_PIVOT_OPTIONS = {
  showExtensions: true,
  showRetracements: true,
  lineColors: {
    standard: {
      r3: "#FF0000", // Red
      r2: "#FF6666",
      r1: "#FFCCCC",
      pivot: "#FFFF00", // Yellow
      s1: "#CCFFCC",
      s2: "#66FF66",
      s3: "#00FF00", // Green
    },
    fibonacci: {
      pivot: "#FFD700", // Gold
      resistances: "#FF6347", // Tomato
      supports: "#20B2AA", // Light Sea Green
    },
    extensions: "#9370DB", // Medium Purple
    retracements: "#4682B4", // Steel Blue
  }
};