"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import marketDataService, {
  MarketData,
  InstrumentData,
} from "@/lib/marketDataService";

// Define the context type
interface MarketDataContextType {
  marketData: MarketData;
  isConnected: boolean;
  lastUpdated: Date | null;
  connect: (accessToken: string) => Promise<boolean>;
  disconnect: () => void;
  subscribeToInstruments: (instrumentKeys: string[]) => boolean;
  unsubscribeFromInstruments: (instrumentKeys: string[]) => boolean;
  getInstrumentData: (instrumentKey: string) => InstrumentData | null;
}

// Create the context with default values
const MarketDataContext = createContext<MarketDataContextType>({
  marketData: {},
  isConnected: false,
  lastUpdated: null,
  connect: async () => false,
  disconnect: () => {},
  subscribeToInstruments: () => false,
  unsubscribeFromInstruments: () => false,
  getInstrumentData: () => null,
});

// Provider props
interface MarketDataProviderProps {
  children: ReactNode;
  accessToken?: string;
}

// Provider component
export const MarketDataProvider: React.FC<MarketDataProviderProps> = ({
  children,
  accessToken = "eyJ0eXAiOiJKV1QiLCJrZXlfaWQiOiJza192MS4wIiwiYWxnIjoiSFMyNTYifQ.eyJzdWIiOiIzS0NIRUYiLCJqdGkiOiI2N2U1NGYxY2E4ZTMwMzUyMTRlMTQyNmIiLCJpc011bHRpQ2xpZW50IjpmYWxzZSwiaWF0IjoxNzQzMDgxMjQ0LCJpc3MiOiJ1ZGFwaS1nYXRld2F5LXNlcnZpY2UiLCJleHAiOjE3NDMxMTI4MDB9.7wB5Th35jUAzageON1B2ddIewUsyskiTWTupmGaYaZI",
}) => {
  const [marketData, setMarketData] = useState<MarketData>({});
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Connect to the market data service
  const connect = async (token: string = accessToken): Promise<boolean> => {
    try {
      marketDataService.setAccessToken(token);
      const connected = await marketDataService.initialize();
      setIsConnected(connected);
      return connected;
    } catch (error) {
      console.error("Error connecting to market data service:", error);
      setIsConnected(false);
      return false;
    }
  };

  // Disconnect from the market data service
  const disconnect = (): void => {
    marketDataService.disconnect();
    setIsConnected(false);
  };

  // Subscribe to instruments
  const subscribeToInstruments = (instrumentKeys: string[]): boolean => {
    return marketDataService.subscribeToInstruments(instrumentKeys);
  };

  // Unsubscribe from instruments
  const unsubscribeFromInstruments = (instrumentKeys: string[]): boolean => {
    return marketDataService.unsubscribeFromInstruments(instrumentKeys);
  };

  // Get data for a specific instrument
  const getInstrumentData = (instrumentKey: string): InstrumentData | null => {
    return marketDataService.getInstrumentData(instrumentKey);
  };

  // Set up event listeners for market data updates
  useEffect(() => {
    const handleDataUpdate = (data: MarketData) => {
      setMarketData({ ...data });
      setLastUpdated(new Date());
    };

    const handleConnection = () => {
      setIsConnected(true);
    };

    const handleDisconnection = () => {
      setIsConnected(false);
    };

    // Register event listeners
    marketDataService.on("dataUpdate", handleDataUpdate);
    marketDataService.on("connected", handleConnection);
    marketDataService.on("disconnected", handleDisconnection);

    // Connect on component mount if accessToken is provided
    if (accessToken) {
      connect(accessToken);
    }

    // Clean up event listeners on component unmount
    return () => {
      marketDataService.off("dataUpdate", handleDataUpdate);
      marketDataService.off("connected", handleConnection);
      marketDataService.off("disconnected", handleDisconnection);
    };
  }, [accessToken]);

  // Create the context value object
  const contextValue: MarketDataContextType = {
    marketData,
    isConnected,
    lastUpdated,
    connect,
    disconnect,
    subscribeToInstruments,
    unsubscribeFromInstruments,
    getInstrumentData,
  };

  // Provide the context to children
  return (
    <MarketDataContext.Provider value={contextValue}>
      {children}
    </MarketDataContext.Provider>
  );
};

// Custom hook to use the market data context
export const useMarketData = () => useContext(MarketDataContext);
