# Stock Market Dashboard

A comprehensive real-time stock market dashboard that helps traders and investors analyze market data, identify trends, and make informed decisions.

## Features & Functionality

### Real-Time Market Data

- **Live Price Updates**: Watch stocks move in real-time with automatic price updates
- **Index Tracking**: Monitor major market indices and their constituent stocks
- **Market Depth**: View buy/sell order distribution to understand market sentiment
- **Trade Volume Analysis**: Track trading volume to identify significant market moves

### Multi-Timeframe Analysis

- **Current Day**: Real-time monitoring of today's price action
- **Previous Day**: Compare against previous trading session
- **3-Day Trading View**: Analyze the last three _actual_ trading days (excludes weekends and holidays)
- **Weekly Analysis**: Current and previous week performance
- **Monthly View**: Current and previous month statistics
- **Quarterly Data**: Quarterly performance metrics
- **Yearly Overview**: Current and previous year performance comparison

### Advanced Analytics

- **Price Change Calculation**: View price changes against previous day's close
- **OHLC Data**: Complete Open-High-Low-Close data for all timeframes
- **Smart Weekend/Holiday Handling**: System intelligently handles non-trading days
- **Index Component Analysis**: Drill down to see the performance of individual stocks within an index

### User Experience Features

- **Responsive Design**: Works seamlessly across desktop, tablet, and mobile devices
- **Data Caching**: Smart caching reduces API calls and speeds up the application
- **Sort & Filter**: Organize data by different metrics (price, change %, etc.)
- **Quick Refresh**: Manually refresh data when needed with cache control options

## Getting Started

### Local Setup

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd stock-market-dashboard
   ```

2. **Environment Setup**

   - Create a `.env` file in the root directory
   - Add your Upstox API token:
     ```
     NEXT_PUBLIC_API_TOKEN="your_api_token_here"
     ```
   - You can obtain an API token by registering on the Upstox Developer Portal

3. **Install dependencies**

   ```bash
   npm install
   # or
   yarn install
   ```

4. **Run the development server**

   ```bash
   npm run dev
   # or
   yarn dev
   ```

5. **Access the dashboard**
   - Open [http://localhost:3000](http://localhost:3000) in your browser
   - The dashboard should connect to the market data API automatically

### Using the Dashboard

1. **Select an instrument** from the dropdown menu to view its data
2. **Choose a timeframe** to analyze specific periods
3. **Toggle views** between single instrument and all stocks in an index
4. **Refresh data** using the refresh button (with or without cache)
5. **Sort table columns** by clicking on column headers

## Troubleshooting

If you encounter issues:

- Check that your API token is valid and properly configured
- Ensure you have a stable internet connection for real-time data
- Clear your browser cache if you see stale data
- Verify that the market is open (dashboard shows different data during market hours vs. after hours)

## Feedback and Support

We welcome your feedback and suggestions for improving the dashboard! Feel free to submit issues or feature requests through our repository.
