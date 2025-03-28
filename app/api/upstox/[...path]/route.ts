// app/api/upstox/[...path]/route.ts
import { NextRequest, NextResponse } from 'next/server';

const UPSTOX_BASE_URL = 'https://api.upstox.com/v2';

// Add detailed logging
function logRequest(method: string, url: string, headers: any, body?: any) {
  console.log(`[Upstox Proxy] ${method} ${url}`);
  console.log(`[Upstox Proxy] Headers:`, headers);
  if (body) {
    console.log(`[Upstox Proxy] Body:`, body);
  }
}

// Add detailed logging for responses
function logResponse(method: string, url: string, status: number, data: any) {
  console.log(`[Upstox Proxy] Response for ${method} ${url}: ${status}`);
  console.log(`[Upstox Proxy] Response data:`, data);
}

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    // Get the token from the request header
    const authorization = request.headers.get('authorization');
    
    if (!authorization) {
      console.log('[Upstox Proxy] Missing authorization header');
      return NextResponse.json(
        { error: 'Authorization token is required' },
        { status: 401 }
      );
    }

    // Construct the full path
    const path = params.path.join('/');
    const url = `${UPSTOX_BASE_URL}/${path}`;
    
    // Prepare headers
    const headers = {
      'Authorization': authorization,
      'Api-Version': '2.0',
      'Content-Type': 'application/json',
    };
    
    // Log the request details
    logRequest('GET', url, headers);
    
    // Forward the request to Upstox
    const response = await fetch(url, {
      method: 'GET',
      headers,
      cache: 'no-store', // Ensure fresh data
    });

    // Get response data
    const data = await response.json();
    
    // Log the response
    logResponse('GET', url, response.status, data);
    
    // Return with the same status code
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    // Detailed error logging
    console.error(`[Upstox Proxy] Error in GET request:`, error);
    
    // Return a more informative error
    return NextResponse.json(
      { 
        error: 'Failed to fetch data from Upstox API',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    // Get the token from the request header
    const authorization = request.headers.get('authorization');
    
    if (!authorization) {
      console.log('[Upstox Proxy] Missing authorization header');
      return NextResponse.json(
        { error: 'Authorization token is required' },
        { status: 401 }
      );
    }

    // Get request body safely
    let body = null;
    const contentType = request.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      try {
        body = await request.json();
      } catch (e) {
        console.log('[Upstox Proxy] Failed to parse JSON body', e);
      }
    }

    // Construct the full path
    const path = params.path.join('/');
    const url = `${UPSTOX_BASE_URL}/${path}`;
    
    // Prepare headers
    const headers = {
      'Authorization': authorization,
      'Api-Version': '2.0',
      'Content-Type': 'application/json',
    };
    
    // Log the request details
    logRequest('POST', url, headers, body);
    
    // Forward the request to Upstox
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    // Get response data
    const data = await response.json();
    
    // Log the response
    logResponse('POST', url, response.status, data);
    
    // Return with the same status code
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    // Detailed error logging
    console.error(`[Upstox Proxy] Error in POST request:`, error);
    
    // Return a more informative error
    return NextResponse.json(
      { 
        error: 'Failed to fetch data from Upstox API',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}