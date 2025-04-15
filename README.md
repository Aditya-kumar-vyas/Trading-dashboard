# Stock Market Dashboard

A real-time stock market dashboard application using Next.js.

## Environment Setup

This application requires an API token from Upstox to access market data. Follow these steps to set up your environment:

1. Create a `.env` file in the root directory of the project
2. Add your Upstox API token to the `.env` file:
   ```
   NEXT_PUBLIC_API_TOKEN="your_api_token_here"
   ```
3. A `.env.example` file is provided as a template (without the actual token)

## CORS Handling

This application includes API routes that act as proxies to the Upstox API to avoid CORS issues. The following API routes handle this:

- `/api/historical-data` - Fetches historical candle data from Upstox
- `/api/last-trading-day` - Finds the most recent trading day with available data (handles weekends/holidays)
- `/api/ws-auth` - Specialized proxy for WebSocket authorization
- `/api/test` - Simple test endpoint to verify API routes are working

These routes allow the frontend to make requests to the Upstox API through the same origin, bypassing CORS restrictions.

## Features

- Real-time market data via WebSocket connection
- Historical data for multiple timeframes
- Smart handling of market holidays and weekends (shows last available trading day)
- Technical indicators including Moving Averages, ATR, and Pivot Points
- Morning Range Breakout detection

## Troubleshooting API Routes

If you encounter issues with the API routes:

1. Check the console logs for detailed error messages
2. Verify your API token is correctly set in the `.env` file
3. Test the basic API connection with `/api/test` endpoint
4. Ensure Next.js is properly configured to handle API routes in `next.config.js`
5. For deployment on platforms like Vercel, check that environment variables are properly set

## Getting Started

First, install the dependencies:

```bash
npm install
# or
yarn install
```

Then, run the development server:

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
