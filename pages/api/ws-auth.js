export default async function handler(req, res) {
  try {
    console.log('WebSocket authorization request received');
    
    // Forward the request to Upstox WebSocket authorization endpoint
    const response = await fetch("https://api-v2.upstox.com/feed/market-data-feed/authorize", {
      method: "GET",
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_API_TOKEN || ""}`,
      },
    });
    
    if (!response.ok) {
      console.error(`WebSocket auth failed with status: ${response.status}`);
      const errorText = await response.text();
      throw new Error(`HTTP error! Status: ${response.status}, Response: ${errorText}`);
    }
    
    // Get the response data
    const data = await response.json();
    console.log('WebSocket authorization successful');
    
    // Return the response
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error getting WebSocket authorization:', error);
    return res.status(500).json({ error: 'Failed to get WebSocket authorization', details: error.message });
  }
} 