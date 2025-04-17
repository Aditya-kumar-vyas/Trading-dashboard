export default async function handler(req, res) {
  try {
    const apiToken = process.env.NEXT_PUBLIC_API_TOKEN;
    
    if (!apiToken) {
      return res.status(401).json({
        status: "error",
        message: "API token is not configured"
      });
    }
    
    // Try to make a simple request to the Upstox API to check token validity
    const instrument = "NSE_INDEX|Nifty 50"; // Common instrument for testing
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0]; // YYYY-MM-DD format
    
    console.log(`Checking token validity with request to Upstox API...`);
    
    // First check WebSocket auth endpoint
    const wsResponse = await fetch("https://api-v2.upstox.com/feed/market-data-feed/authorize", {
      method: "GET",
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`,
      },
    });
    
    const wsAuthStatus = wsResponse.status;
    let wsAuthResult;
    
    try {
      wsAuthResult = await wsResponse.json();
    } catch (e) {
      wsAuthResult = { error: e.message };
    }
    
    // Then check historical data endpoint
    const dataResponse = await fetch(`https://api.upstox.com/v2/historical-candle/${instrument}/day/${formattedDate}/${formattedDate}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiToken}`,
      },
    });
    
    const dataStatus = dataResponse.status;
    let dataResult;
    
    try {
      dataResult = await dataResponse.json();
    } catch (e) {
      dataResult = { error: e.message };
    }
    
    // Return comprehensive results
    return res.status(200).json({
      status: "success",
      tokenLength: apiToken.length,
      tokenFirstChars: apiToken.substring(0, 5) + "...",
      wsAuthStatus,
      wsAuthValid: wsResponse.ok,
      wsAuthDetails: wsAuthResult,
      dataStatus,
      dataValid: dataResponse.ok,
      dataDetails: dataResult
    });
    
  } catch (error) {
    console.error('Error checking token validity:', error);
    return res.status(500).json({
      status: "error",
      message: "Failed to check token validity",
      error: error.message
    });
  }
} 