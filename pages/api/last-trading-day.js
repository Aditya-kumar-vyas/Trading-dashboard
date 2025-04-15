export default async function handler(req, res) {
  const { instrument } = req.query;
  
  if (!instrument) {
    return res.status(400).json({ error: 'Missing instrument parameter' });
  }
  
  try {
    const today = new Date();
    
    // Try up to 10 previous days to find trading data
    // This handles weekends, holidays, and other market closures
    for (let i = 1; i <= 10; i++) {
      const testDate = new Date(today);
      testDate.setDate(today.getDate() - i);
      
      const formattedDate = testDate.toISOString().split('T')[0]; // YYYY-MM-DD format
      
      // Build the Upstox API URL for this test date
      const upstoxUrl = `https://api.upstox.com/v2/historical-candle/${instrument}/day/${formattedDate}/${formattedDate}`;
      
      console.log(`Trying to find last trading day: ${upstoxUrl}`);
      
      // Try to fetch data for this date
      const response = await fetch(upstoxUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_API_TOKEN || ""}`,
        },
      });
      
      if (!response.ok) {
        console.log(`No data for ${formattedDate}, status: ${response.status}`);
        continue; // Try the next day
      }
      
      const data = await response.json();
      
      // Check if we have valid candle data
      if (data.status === "success" && data.data.candles && data.data.candles.length > 0) {
        console.log(`Found last trading day: ${formattedDate}`);
        
        // Return both the data and the date we found
        return res.status(200).json({
          status: "success",
          lastTradingDate: formattedDate,
          data: data.data
        });
      }
      
      console.log(`No candles for ${formattedDate}`);
    }
    
    // If we tried 10 days and found nothing, return an error
    return res.status(404).json({ 
      error: 'Could not find recent trading data in the last 10 days'
    });
    
  } catch (error) {
    console.error('Error finding last trading day:', error);
    return res.status(500).json({ 
      error: 'Failed to find last trading day',
      details: error.message
    });
  }
} 