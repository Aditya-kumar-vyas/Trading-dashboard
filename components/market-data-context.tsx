"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import protobuf from "protobufjs";
import { Buffer } from "buffer";
import { MarketDataContextType } from "@/app/types";
import { API_TOKEN, WS_AUTH_ENDPOINT } from "@/app/constants";
import { arrayBufferToBuffer, blobToArrayBuffer } from "@/lib/utils";

// Create the context with default values
const MarketDataContext = createContext<MarketDataContextType>({
  isConnected: false,
  marketData: {},
  subscribeToInstruments: () => {},
});

// Hook for using market data
export const useMarketData = () => useContext(MarketDataContext);

// Market Data Provider Component
export function MarketDataProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [marketData, setMarketData] = useState<Record<string, any>>({});
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [protobufRoot, setProtobufRoot] = useState<any>(null);

  // Initialize Protobuf
  useEffect(() => {
    const initProtobuf = async () => {
      try {
        const root = await protobuf.load("/MarketDataFeed.proto");
        setProtobufRoot(root);
        console.log("Protobuf initialized successfully");
      } catch (error) {
        console.error("Failed to initialize Protobuf:", error);
      }
    };

    initProtobuf();
  }, []);

  // Function to get WebSocket URL
  const getWebSocketUrl = async (): Promise<string> => {
    const headers = {
      "Content-type": "application/json",
      Authorization: "Bearer " + API_TOKEN,
    };

    try {
      const response = await fetch(WS_AUTH_ENDPOINT, {
        method: "GET",
        headers: headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const res = await response.json();
      return res.data.authorizedRedirectUri;
    } catch (error) {
      console.error("Error getting WebSocket URL:", error);
      throw error;
    }
  };

  // Connect to WebSocket
  useEffect(() => {
    let ws: WebSocket | null = null;

    const connectWebSocket = async () => {
      try {
        if (!protobufRoot) {
          console.log("Waiting for Protobuf to be initialized...");
          return;
        }

        // Close existing connection if any
        if (socket) {
          socket.close();
        }

        // Get WebSocket URL
        const wsUrl = await getWebSocketUrl();
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          setIsConnected(true);
          setSocket(ws);
          console.log("WebSocket connected successfully");
        };

        ws.onclose = () => {
          setIsConnected(false);
          setSocket(null);
          console.log("WebSocket disconnected");
        };

        ws.onmessage = async (event) => {
          try {
            const arrayBuffer = await blobToArrayBuffer(event.data);
            const buffer = arrayBufferToBuffer(arrayBuffer);

            // Decode protobuf message
            const FeedResponse = protobufRoot.lookupType(
              "com.upstox.marketdatafeeder.rpc.proto.FeedResponse"
            );

            const response = FeedResponse.decode(buffer);

            // Process and update market data
            if (response && response.feeds) {
              // In this case, feeds is an object with instrument keys
              const feeds = response.feeds;

              // Iterate through each instrument in the feeds object
              Object.keys(feeds).forEach((instrumentKey) => {
                const feed = feeds[instrumentKey];

                // Check if we have the indexFF data structure
                if (feed.ff && feed.ff.indexFF) {
                  const indexFF = feed.ff.indexFF;

                  // Check if we have marketOHLC data
                  if (
                    indexFF.marketOHLC &&
                    indexFF.marketOHLC.ohlc &&
                    indexFF.marketOHLC.ohlc.length > 0
                  ) {
                    // Get the daily OHLC data (index 0 in the array with interval "1d")
                    const dailyOHLC = indexFF.marketOHLC.ohlc.find(
                      (item: any) => item.interval === "1d"
                    );

                    if (dailyOHLC) {
                      // Update market data state
                      setMarketData((prev) => ({
                        ...prev,
                        [instrumentKey]: {
                          ohlc: indexFF.marketOHLC.ohlc,
                          dailyOHLC: dailyOHLC,
                          lastPrice: indexFF.ltpc
                            ? parseFloat(indexFF.ltpc.ltp)
                            : 0,
                          lastUpdated: new Date().toISOString(),
                        },
                      }));
                    }
                  }
                }
              });
            }
          } catch (error) {
            console.error("Error processing WebSocket message:", error);
          }
        };

        ws.onerror = (error) => {
          console.error("WebSocket error:", error);
          setIsConnected(false);
          setSocket(null);
        };
      } catch (error) {
        console.error("WebSocket connection error:", error);
        setIsConnected(false);
        setSocket(null);
      }
    };

    if (protobufRoot && !socket) {
      connectWebSocket();
    }

    // Reconnect on disconnect with exponential backoff
    let reconnectTimeout: NodeJS.Timeout;
    let reconnectAttempts = 0;

    const reconnect = () => {
      if (reconnectAttempts < 5) {
        // Limit reconnect attempts
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000); // Exponential backoff with 30s max
        reconnectTimeout = setTimeout(() => {
          console.log(
            `Attempting to reconnect (attempt ${reconnectAttempts + 1})...`
          );
          connectWebSocket();
          reconnectAttempts++;
        }, delay);
      }
    };

    if (!isConnected && protobufRoot) {
      reconnect();
    }

    // Cleanup on unmount
    return () => {
      if (socket) {
        socket.close();
      }
      clearTimeout(reconnectTimeout);
    };
  }, [protobufRoot, isConnected]);

  // Subscribe to instruments
  const subscribeToInstruments = (instrumentKeys: string[]) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      console.warn("WebSocket not connected, cannot subscribe");
      return;
    }

    try {
      const subscriptionData = {
        guid: "trading-view-app",
        method: "sub",
        data: {
          mode: "full",
          instrumentKeys: instrumentKeys,
        },
      };

      socket.send(Buffer.from(JSON.stringify(subscriptionData)));
      console.log("Subscribed to instruments:", instrumentKeys);
    } catch (error) {
      console.error("Error subscribing to instruments:", error);
    }
  };

  return (
    <MarketDataContext.Provider
      value={{
        isConnected,
        marketData,
        subscribeToInstruments,
      }}
    >
      {children}
    </MarketDataContext.Provider>
  );
}
