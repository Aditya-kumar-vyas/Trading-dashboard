export default async function handler(req, res) {
  // Collect basic info about the environment
  const info = {
    timestamp: new Date().toISOString(),
    apiTokenPresent: !!process.env.NEXT_PUBLIC_API_TOKEN,
    apiTokenLength: process.env.NEXT_PUBLIC_API_TOKEN ? process.env.NEXT_PUBLIC_API_TOKEN.length : 0,
    apiTokenFirstChars: process.env.NEXT_PUBLIC_API_TOKEN ? process.env.NEXT_PUBLIC_API_TOKEN.substring(0, 10) + '...' : 'none',
    environment: process.env.NODE_ENV,
    nodeVersion: process.version,
  };
  
  // Check WebSocket connection
  try {
    const response = await fetch("https://api-v2.upstox.com/feed/market-data-feed/authorize", {
      method: "GET",
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_API_TOKEN || ""}`,
      },
    });
    
    info.wsAuthStatus = response.status;
    
    if (response.ok) {
      const data = await response.json();
      info.wsAuthSuccess = true;
      info.wsUrl = data.data?.authorizedRedirectUri || 'none';
    } else {
      info.wsAuthSuccess = false;
      info.wsAuthError = await response.text();
    }
  } catch (error) {
    info.wsAuthSuccess = false;
    info.wsError = error.message;
  }
  
  // Try to make a sample historical data request for today
  try {
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0]; // YYYY-MM-DD
    
    const response = await fetch(`https://api.upstox.com/v2/historical-candle/NSE_INDEX|Nifty 50/day/${formattedDate}/${formattedDate}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_API_TOKEN || ""}`,
      },
    });
    
    info.historicalStatus = response.status;
    
    if (response.ok) {
      const data = await response.json();
      info.historicalSuccess = data.status === 'success';
      info.hasTodayData = data.data?.candles?.length > 0;
      info.candleCount = data.data?.candles?.length || 0;
    } else {
      info.historicalSuccess = false;
      info.historicalError = await response.text();
    }
  } catch (error) {
    info.historicalSuccess = false;
    info.historicalError = error.message;
  }
  
  // Return the debug info
  return res.status(200).json({
    status: "success",
    info: info
  });
} 