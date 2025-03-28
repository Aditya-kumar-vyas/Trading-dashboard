import { EventEmitter } from 'events';
const UpstoxClient = require('upstox-js-sdk');
import * as protobuf from 'protobufjs';
import * as ws from 'ws';

// Define TypeScript interface for market data
export interface OHLCData {
  interval: string;
  open: number;
  high: number;
  low: number;
  close: number;
  timestamp: number;
}

export interface InstrumentData {
  ltp?: number;
  lastClose?: number;
  yearlyHigh?: number;
  yearlyLow?: number;
  ohlcData: {
    [interval: string]: OHLCData;
  };
  lastUpdated: number;
}

export interface MarketData {
  [instrumentKey: string]: InstrumentData;
}

class MarketDataService extends EventEmitter {
  private static instance: MarketDataService;
  private websocket: ws.WebSocket | null = null;
  private protobufRoot: any = null;
  private connected: boolean = false;
  private marketData: MarketData = {};
  private accessToken: string = '';
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  private constructor() {
    super();
    // Make the constructor private to enforce singleton pattern
  }

  public static getInstance(): MarketDataService {
    if (!MarketDataService.instance) {
      MarketDataService.instance = new MarketDataService();
    }
    return MarketDataService.instance;
  }

  public setAccessToken(token: string): void {
    this.accessToken = token;
  }

  public async initialize(): Promise<boolean> {
    try {
      // Initialize protobuf
      this.protobufRoot = await protobuf.load('/MarketDataFeed.proto');
      console.log('Protobuf initialization complete');
      
      // Get WebSocket URL
      const wsUrl = await this.getMarketFeedUrl();
      
      // Connect to WebSocket
      await this.connectWebSocket(wsUrl);
      
      return true;
    } catch (error) {
      console.error('Failed to initialize market data service:', error);
      this.emit('error', error);
      return false;
    }
  }

  public isConnected(): boolean {
    return this.connected;
  }

  public getMarketData(): MarketData {
    return this.marketData;
  }

  public getInstrumentData(instrumentKey: string): InstrumentData | null {
    return this.marketData[instrumentKey] || null;
  }

  private async getMarketFeedUrl(): Promise<string> {
    try {
      const url = 'https://api.upstox.com/v2/feed/market-data-feed/authorize';
      console.log("Trying direct API call to:", url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer eyJ0eXAiOiJKV1QiLCJrZXlfaWQiOiJza192MS4wIiwiYWxnIjoiSFMyNTYifQ.eyJzdWIiOiIzS0NIRUYiLCJqdGkiOiI2N2U2OTE3OGZmM2RhYTQzYWQ4MzEwOWEiLCJpc011bHRpQ2xpZW50IjpmYWxzZSwiaWF0IjoxNzQzMTYzNzY4LCJpc3MiOiJ1ZGFwaS1nYXRld2F5LXNlcnZpY2UiLCJleHAiOjE3NDMxOTkyMDB9.FmCUAB2zTeWb2hEazxB6mP-TYCrimIk7qHYZt5gJ0Bw}`,
          'Api-Version': '2.0',
          'Content-Type': 'application/json',
        },
      });
      
      console.log("Response status:", response.status);
      const data = await response.json();
      console.log("Response data:", data);
      
      if (!response.ok) {
        throw new Error(`API error: ${JSON.stringify(data)}`);
      }
      
      return data.data.authorizedRedirectUri;
    } catch (error) {
      console.error('Error getting market feed URL:', error);
      throw error;
    }
  }

  private async connectWebSocket(wsUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Create WebSocket with just the URL
    
         this.websocket = new ws.WebSocket(wsUrl, {
            headers: {
                'Authorization': `Bearer eyJ0eXAiOiJKV1QiLCJrZXlfaWQiOiJza192MS4wIiwiYWxnIjoiSFMyNTYifQ.eyJzdWIiOiIzS0NIRUYiLCJqdGkiOiI2N2U2MWM5OWZmM2RhYTQzYWQ4MzA1MTgiLCJpc011bHRpQ2xpZW50IjpmYWxzZSwiaWF0IjoxNzQzMTMzODQ5LCJpc3MiOiJ1ZGFwaS1nYXRld2F5LXNlcnZpY2UiLCJleHAiOjE3NDMxOTkyMDB9.yRSr6JoP6xuygbN3Ttu-XL69ccI-a94svcOeb1oZvbw}`,
                'Api-Version': '2.0',
                'Content-Type': 'application/json',
            },
            followRedirects: true,
          });
        console.log('WebSocket object created with URL:', wsUrl);

        this.websocket.onopen = () => {
          console.log('WebSocket connected');
          this.connected = true;
          this.reconnectAttempts = 0;
          this.emit('connected');
          resolve();

          
          
          // Subscribe to instruments after connection
          
        };

        this.websocket.onclose = () => {
          console.log('WebSocket disconnected');
          this.connected = false;
          this.emit('disconnected');
          
          // Attempt to reconnect
          this.attemptReconnect();
        };

        this.websocket.onmessage = (event) => {
          try {
            console.log("WebSocket message received of type:", typeof event.data);
            
            if (event.data instanceof ArrayBuffer) {
              console.log("Binary data received, length:", event.data.byteLength);
            } else if (event.data instanceof Blob) {
              console.log("Blob data received, size:", event.data.size);
            } else if (typeof event.data === 'string') {
              console.log("String data received, first 100 chars:", event.data.substring(0, 100));
            }
            
            this.handleWebSocketMessage(event.data);
          } catch (error) {
            console.error('Error processing WebSocket message:', error);
          }
        };

        this.websocket.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.emit('error', error);
          reject(error);
        };
      } catch (error) {
        console.error('Error creating WebSocket:', error);
        reject(error);
      }
    });
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Maximum reconnect attempts reached');
      this.emit('maxReconnectAttemptsReached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(30000, Math.pow(2, this.reconnectAttempts) * 1000);
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    
    this.reconnectTimeout = setTimeout(async () => {
      try {
        const wsUrl = await this.getMarketFeedUrl();
        await this.connectWebSocket(wsUrl);
      } catch (error) {
        console.error('Reconnect attempt failed:', error);
      }
    }, delay);
  }

  private  async handleWebSocketMessage  (data: any): Promise<void> {
    try {
      // Try to handle as JSON string first (which your sample shows is what you're getting)
      if (typeof data === 'string') {
        try {
          const jsonData = JSON.parse(data);
          console.log("Successfully parsed WebSocket data as JSON");
          this.processJsonData(jsonData);
          return;
        } catch (e) {
          console.log("Data is not valid JSON, falling back to protobuf handling");
        }
      }
      
      // Handle binary protobuf data if it's not JSON
      if (data instanceof ArrayBuffer || data instanceof Blob) {
        if (!this.protobufRoot) {
          console.warn('Protobuf not initialized yet');
          return;
        }
        
        let buffer = data;
        
        if (data instanceof Blob) {
          // Convert Blob to ArrayBuffer
          buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as ArrayBuffer);
            reader.onerror = reject;
            reader.readAsArrayBuffer(data);
          });
        }
        
        const FeedResponse = this.protobufRoot.lookupType('com.upstox.marketdatafeeder.rpc.proto.FeedResponse');
        const decoded = FeedResponse.decode(new Uint8Array(buffer as ArrayBuffer));
        this.processMarketData(decoded);
      } else {
        console.warn("Received data of unsupported type:", typeof data);
      }
    } catch (error) {
      console.error('Error in handleWebSocketMessage:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message);
        console.error('Stack trace:', error.stack);
      }
    }
  }
  
  // Process JSON formatted data
  private processJsonData(data: any): void {
    console.log("Processing JSON data:", data);
    
    if (!data || !data.feeds) {
      console.warn("Invalid JSON data structure - missing 'feeds' property");
      return;
    }
    
    const currentTimestamp = Date.now();
    const feedsCount = Object.keys(data.feeds).length;
    console.log(`Processing ${feedsCount} feeds`);
    
    Object.entries(data.feeds).forEach(([instrumentKey, feedData]) => {
      console.log(`Processing feed for ${instrumentKey}`);
      
      if (!this.marketData[instrumentKey]) {
        this.marketData[instrumentKey] = {
          ohlcData: {},
          lastUpdated: currentTimestamp
        };
      }
      
      const feed = feedData as any;
      
      if (feed.ff && feed.ff.indexFF) {
        const indexData = feed.ff.indexFF;
        console.log(`Index data for ${instrumentKey}:`, indexData);
        
        if (indexData.ltpc) {
          this.marketData[instrumentKey].ltp = indexData.ltpc.ltp;
          this.marketData[instrumentKey].lastClose = indexData.ltpc.cp;
        }
        
        if (indexData.marketOHLC && indexData.marketOHLC.ohlc) {
          console.log(`OHLC data found for ${instrumentKey}, count:`, indexData.marketOHLC.ohlc.length);
          
          indexData.marketOHLC.ohlc.forEach((item: any) => {
            console.log(`Adding interval ${item.interval} data`);
            this.marketData[instrumentKey].ohlcData[item.interval] = {
              interval: item.interval,
              open: item.open,
              high: item.high,
              low: item.low,
              close: item.close,
              timestamp: parseInt(item.ts)
            };
          });
        }
        
        if (indexData.yh) this.marketData[instrumentKey].yearlyHigh = indexData.yh;
        if (indexData.yl) this.marketData[instrumentKey].yearlyLow = indexData.yl;
        
        this.marketData[instrumentKey].lastUpdated = currentTimestamp;
      }
    });
    
    console.log("Updated market data:", JSON.stringify(this.marketData, null, 2));
    this.emit('dataUpdate', this.marketData);
  }

  private processMarketData(decoded: any): void {
    if (!decoded.feeds) return;

    const currentTimestamp = Date.now();
    console.log('Processing protobuf market data:', decoded);

    // Process each instrument feed
    Object.entries(decoded.feeds).forEach(([instrumentKey, data]) => {
      if (!this.marketData[instrumentKey]) {
        this.marketData[instrumentKey] = {
          ohlcData: {},
          lastUpdated: currentTimestamp
        };
      }

      const feed = data as any;
      
      // For indices
      if (feed.ff && feed.ff.indexFF) {
        const indexData = feed.ff.indexFF;
        
        // Process LTPC data
        if (indexData.ltpc) {
          this.marketData[instrumentKey].ltp = indexData.ltpc.ltp;
          this.marketData[instrumentKey].lastClose = indexData.ltpc.cp;
        }
        
        // Process OHLC data
        if (indexData.marketOHLC && indexData.marketOHLC.ohlc) {
          indexData.marketOHLC.ohlc.forEach((item: any) => {
            this.marketData[instrumentKey].ohlcData[item.interval] = {
              interval: item.interval,
              open: item.open,
              high: item.high,
              low: item.low,
              close: item.close,
              timestamp: parseInt(item.ts)
            };
          });
        }
        
        // Process yearly high/low
        if (indexData.yh) this.marketData[instrumentKey].yearlyHigh = indexData.yh;
        if (indexData.yl) this.marketData[instrumentKey].yearlyLow = indexData.yl;
        
        // Update last updated timestamp
        this.marketData[instrumentKey].lastUpdated = currentTimestamp;
      }
    });
    
    this.emit('dataUpdate', this.marketData);
  }

  public subscribeToInstruments(instrumentKeys: string[]): boolean {
    if (!this.connected || !this.websocket) {
      console.warn('Cannot subscribe: WebSocket not connected');
      return false;
    }
  
    const data = {
      guid: 'tradingview-' + Date.now(),
      method: 'sub',
      data: {
        mode: 'full',
        instrumentKeys: instrumentKeys
      }
    };
  
    try {
      const jsonString = JSON.stringify(data);
      console.log("Sending subscription request:", jsonString);  // ✅ Log the outgoing subscription request
      this.websocket.send(jsonString);
      console.log(`✅ Subscribed to: ${instrumentKeys.join(', ')}`);
      return true;
    } catch (error) {
      console.error('❌ Error subscribing to instruments:', error);
      return false;
    }
  }

  public unsubscribeFromInstruments(instrumentKeys: string[]): boolean {
    if (!this.connected || !this.websocket) {
      console.warn('Cannot unsubscribe: WebSocket not connected');
      return false;
    }

    const data = {
      guid: 'tradingview-' + Date.now(),
      method: 'unsub',
      data: {
        instrumentKeys: instrumentKeys
      }
    };

    try {
      const jsonString = JSON.stringify(data);
      console.log("Sending unsubscription request:", jsonString);
      this.websocket.send(jsonString);
      console.log(`Unsubscribed from: ${instrumentKeys.join(', ')}`);
      return true;
    } catch (error) {
      console.error('Error unsubscribing from instruments:', error);
      return false;
    }
  }

  public disconnect(): void {
    if (this.websocket) {
      try {
        this.websocket.close();
      } catch (error) {
        console.error('Error closing WebSocket:', error);
      } finally {
        this.websocket = null;
        this.connected = false;
      }
    }
  }
}

// Create a singleton instance
export default MarketDataService.getInstance();