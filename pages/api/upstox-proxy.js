export default async function handler(req, res) {
  const { endpoint, params } = req.query;
  
  if (!endpoint) {
    return res.status(400).json({ error: 'Missing endpoint parameter' });
  }
  
  try {
    // Handle the historical-candle endpoint specifically since it has a specific format
    let upstoxUrl;
    
    if (endpoint === 'historical-candle' && params) {
      // For historical-candle, we expect params to be in the format: instrument/interval/to_date/from_date
      upstoxUrl = `https://api.upstox.com/v2/historical-candle/${params}`;
    } else {
      // For other endpoints
      upstoxUrl = `https://api.upstox.com/v2/${endpoint}${params ? `/${params}` : ''}`;
    }
    
    console.log(`Proxying request to: ${upstoxUrl}`);
    
    // Forward the request to Upstox API with the authorization token
    const response = await fetch(upstoxUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_API_TOKEN || ""}`,
      },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
    });
    
    // Get the response data
    const data = await response.json();
    
    // Return the response
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('Error proxying request to Upstox API:', error);
    return res.status(500).json({ error: 'Failed to fetch data from Upstox API', details: error.message });
  }
} 