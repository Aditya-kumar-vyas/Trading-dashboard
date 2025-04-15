export default async function handler(req, res) {
  // Extract query parameters
  const { instrument, interval, to_date, from_date } = req.query;
  
  if (!instrument || !interval || !to_date || !from_date) {
    return res.status(400).json({ 
      error: 'Missing required parameters. Need: instrument, interval, to_date, from_date' 
    });
  }
  
  try {
    // Build the Upstox API URL directly
    const upstoxUrl = `https://api.upstox.com/v2/historical-candle/${instrument}/${interval}/${to_date}/${from_date}`;
    
    console.log(`Fetching historical data from: ${upstoxUrl}`);
    
    // Forward the request to Upstox API with the authorization token
    const response = await fetch(upstoxUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.NEXT_PUBLIC_API_TOKEN || ""}`,
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Upstox API error: ${response.status}, ${errorText}`);
      return res.status(response.status).json({ 
        error: `Error from Upstox API: ${response.status}`,
        details: errorText
      });
    }
    
    // Get the response data
    const data = await response.json();
    
    // Return the response
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error fetching historical data:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch historical data',
      details: error.message
    });
  }
} 