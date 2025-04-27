"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import protobuf from "protobufjs";
import { Buffer } from "buffer";
import { MarketDataContextType } from "@/app/types";
import { WS_AUTH_ENDPOINT } from "@/app/constants";
import { arrayBufferToBuffer, blobToArrayBuffer } from "@/lib/utils";

// Create the context with default values
const MarketDataContext = createContext<MarketDataContextType>({
  isConnected: false,
  marketData: {},
  subscribeToInstruments: () => {},
});

// Hook for using market data
export const useMarketData = () => useContext(MarketDataContext);

// Constants for localStorage
const WS_DATA_CACHE_KEY = "ws_market_data";
const WS_CACHE_EXPIRY_TIME = 24 * 60 * 60 * 1000; // 24 hours

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
  const [subscribedInstruments, setSubscribedInstruments] = useState<
    Set<string>
  >(new Set());
  const [pendingSubscriptions, setPendingSubscriptions] = useState<string[]>(
    []
  );
  const [lastCacheSave, setLastCacheSave] = useState<number>(0);

  // Load cached market data on initial load
  useEffect(() => {
    try {
      // Load cached market data
      const cachedMarketData = localStorage.getItem(WS_DATA_CACHE_KEY);
      if (cachedMarketData) {
        const parsed = JSON.parse(cachedMarketData);
        if (
          parsed &&
          parsed.timestamp &&
          Date.now() - parsed.timestamp < WS_CACHE_EXPIRY_TIME &&
          parsed.data
        ) {
          setMarketData(parsed.data);
          console.log(
            `Loaded cached market data for ${
              Object.keys(parsed.data).length
            } instruments`
          );
        }
      }
    } catch (error) {
      console.error("Error loading from localStorage:", error);
    }
  }, []);

  // Periodically save market data to localStorage (every 30 seconds)
  useEffect(() => {
    const saveMarketDataToCache = () => {
      if (
        Object.keys(marketData).length > 0 &&
        Date.now() - lastCacheSave > 30000
      ) {
        try {
          localStorage.setItem(
            WS_DATA_CACHE_KEY,
            JSON.stringify({
              timestamp: Date.now(),
              data: marketData,
            })
          );
          console.log(
            `Saved market data for ${
              Object.keys(marketData).length
            } instruments to localStorage`
          );
          setLastCacheSave(Date.now());
        } catch (error) {
          console.warn("Error saving market data to localStorage:", error);
        }
      }
    };

    const intervalId = setInterval(saveMarketDataToCache, 30000);
    return () => clearInterval(intervalId);
  }, [marketData, lastCacheSave]);

  // Debug when marketData changes
  useEffect(() => {
    // Log the number of instruments with real-time data
    const instrumentsWithData = Object.keys(marketData).filter(
      (key) => marketData[key]?.lastPrice || marketData[key]?.dailyOHLC
    );

    if (instrumentsWithData.length > 0) {
      console.log(
        `Currently have real-time data for ${instrumentsWithData.length} instruments:`,
        instrumentsWithData.slice(0, 5).join(", ") +
          (instrumentsWithData.length > 5 ? "..." : "")
      );
    }
  }, [marketData]);

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
    try {
      const response = await fetch(`/api/ws-auth`);

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

  // Improved subscribe to instruments function with better error handling and retries
  const subscribeToInstruments = useCallback(
    (instrumentKeys: string[]) => {
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        console.warn("WebSocket not connected, queueing subscription requests");

        // Store instruments for subscription when socket connects
        setPendingSubscriptions((prev) => {
          const newKeys = instrumentKeys.filter((key) => !prev.includes(key));
          return [...prev, ...newKeys];
        });
        return;
      }

      try {
        // Normalize instrument keys to ensure proper format
        const normalizedKeys = instrumentKeys.map((key) => {
          // If key doesn't contain a pipe, assume it's an NSE equity and format it
          if (!key.includes("|") && !key.includes("_INDEX")) {
            return `NSE_EQ|${key}`;
          }
          return key;
        });

        // Filter out already subscribed instruments
        const newInstruments = normalizedKeys.filter(
          (key) => !subscribedInstruments.has(key)
        );

        if (newInstruments.length === 0) {
          console.log("All instruments already subscribed");
          return;
        }

        console.log(`Subscribing to ${newInstruments.length} new instruments`);

        // Batch subscriptions to avoid overwhelming socket
        const BATCH_SIZE = 5; // Smaller batch size to be safer
        for (let i = 0; i < newInstruments.length; i += BATCH_SIZE) {
          const batch = newInstruments.slice(i, i + BATCH_SIZE);

          const subscriptionData = {
            guid: `trading-view-app-${Date.now()}-${i}`, // Unique identifier for each batch
            method: "sub",
            data: {
              mode: "full",
              instrumentKeys: batch,
            },
          };

          socket.send(Buffer.from(JSON.stringify(subscriptionData)));
          console.log(
            `Batch subscribed to instruments [${i}-${i + batch.length - 1}]:`,
            batch
          );

          // Add proper delay between batches (200ms)
          if (i + BATCH_SIZE < newInstruments.length) {
            setTimeout(() => {}, 200);
          }
        }

        // Update subscribed instruments list
        setSubscribedInstruments((prev) => {
          const updated = new Set(prev);
          newInstruments.forEach((key) => updated.add(key));
          return updated;
        });
      } catch (error) {
        console.error("Error subscribing to instruments:", error);
      }
    },
    [socket, subscribedInstruments]
  );

  // Process pending subscriptions when socket connects
  useEffect(() => {
    if (
      isConnected &&
      pendingSubscriptions.length > 0 &&
      socket?.readyState === WebSocket.OPEN
    ) {
      console.log(
        `Processing ${pendingSubscriptions.length} pending subscriptions`
      );
      subscribeToInstruments(pendingSubscriptions);
      setPendingSubscriptions([]);
    }
  }, [isConnected, pendingSubscriptions, socket, subscribeToInstruments]);

  // Connect to WebSocket with improved reconnection and subscription handling
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

        console.log("Fetching WebSocket URL...");
        // Get WebSocket URL
        const wsUrl = await getWebSocketUrl();
        console.log("WebSocket URL obtained:", wsUrl);

        ws = new WebSocket(wsUrl);
        console.log("WebSocket connecting...");

        ws.onopen = () => {
          setIsConnected(true);
          setSocket(ws);
          console.log("WebSocket connected successfully");

          // Auto-subscribe to some default instruments when connected
          if (ws) {
            const defaultInstruments = [
              "NSE_INDEX|Nifty 50",
              "NSE_INDEX|Nifty Bank",
            ];
            const subscriptionData = {
              guid: "trading-view-app-default",
              method: "sub",
              data: {
                mode: "full",
                instrumentKeys: defaultInstruments,
              },
            };

            console.log(
              "Auto-subscribing to default instruments:",
              defaultInstruments
            );
            ws.send(Buffer.from(JSON.stringify(subscriptionData)));

            // Add default instruments to subscribed list
            setSubscribedInstruments((prev) => {
              const updated = new Set(prev);
              defaultInstruments.forEach((key) => updated.add(key));
              return updated;
            });
          }
        };

        ws.onclose = (event) => {
          console.log(
            `WebSocket closed with code: ${event.code}, reason: ${event.reason}`
          );
          setIsConnected(false);
          setSocket(null);
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

            // Log the first message to see its structure
            if (!isConnected) {
              console.log(
                "First WebSocket message received:",
                JSON.stringify(response).substring(0, 200) + "..."
              );
            }

            // Process and update market data
            if (response && response.feeds) {
              // In this case, feeds is an object with instrument keys
              const feeds = response.feeds;

              // Log what instruments we received data for
              const instrumentKeys = Object.keys(feeds);
              if (
                instrumentKeys.length > 0 &&
                instrumentKeys.some((key) => !marketData[key])
              ) {
                console.log(
                  "Received data for new instruments:",
                  instrumentKeys.filter((key) => !marketData[key])
                );
              }

              // Iterate through each instrument in the feeds object
              instrumentKeys.forEach((instrumentKey) => {
                const feed = feeds[instrumentKey];

                // Check for different types of feed structures
                if (feed.ff && feed.ff.indexFF) {
                  // Handle index feed format
                  const indexFF = feed.ff.indexFF;

                  // Log the first time we receive OHLC data
                  if (
                    indexFF.marketOHLC &&
                    indexFF.marketOHLC.ohlc &&
                    indexFF.marketOHLC.ohlc.length > 0 &&
                    !marketData[instrumentKey]?.dailyOHLC
                  ) {
                    console.log(
                      `Received first OHLC data for ${instrumentKey}`
                    );
                  }

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
                          ...prev[instrumentKey],
                          ohlc: indexFF.marketOHLC.ohlc,
                          dailyOHLC: dailyOHLC,
                          ff: feed.ff,
                          lastPrice: indexFF.ltpc
                            ? parseFloat(indexFF.ltpc.ltp)
                            : 0,
                          lastUpdated: new Date().toISOString(),
                        },
                      }));
                    }
                  } else if (indexFF.ltpc) {
                    // If we don't have OHLC but have last traded price/close
                    setMarketData((prev) => ({
                      ...prev,
                      [instrumentKey]: {
                        ...prev[instrumentKey],
                        ff: feed.ff,
                        lastPrice: parseFloat(indexFF.ltpc.ltp),
                        lastUpdated: new Date().toISOString(),
                      },
                    }));
                  }
                } else if (feed.ff && feed.ff.marketFF) {
                  // Handle market feed format (for individual stocks)
                  const marketFF = feed.ff.marketFF;

                  // Check if we have OHLC data
                  if (
                    marketFF.marketOHLC &&
                    marketFF.marketOHLC.ohlc &&
                    marketFF.marketOHLC.ohlc.length > 0
                  ) {
                    // Get the daily OHLC data
                    const dailyOHLC = marketFF.marketOHLC.ohlc.find(
                      (item: any) => item.interval === "1d"
                    );

                    if (dailyOHLC) {
                      setMarketData((prev) => ({
                        ...prev,
                        [instrumentKey]: {
                          ...prev[instrumentKey],
                          ohlc: marketFF.marketOHLC.ohlc,
                          dailyOHLC: dailyOHLC,
                          ff: feed.ff,
                          lastPrice: marketFF.ltpc
                            ? parseFloat(marketFF.ltpc.ltp)
                            : 0,
                          lastUpdated: new Date().toISOString(),
                        },
                      }));
                    }
                  } else if (marketFF.ltpc) {
                    // If we don't have OHLC but have last traded price
                    setMarketData((prev) => ({
                      ...prev,
                      [instrumentKey]: {
                        ...prev[instrumentKey],
                        ff: feed.ff,
                        lastPrice: parseFloat(marketFF.ltpc.ltp),
                        lastUpdated: new Date().toISOString(),
                      },
                    }));
                  }
                } else if (feed.marketFF) {
                  // Handle market feed format (different structure)
                  setMarketData((prev) => ({
                    ...prev,
                    [instrumentKey]: {
                      ...prev[instrumentKey],
                      ff: feed,
                      lastPrice: feed.marketFF.ltpc
                        ? parseFloat(feed.marketFF.ltpc.ltp)
                        : 0,
                      lastUpdated: new Date().toISOString(),
                    },
                  }));
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
  }, [protobufRoot, isConnected, socket]);

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
