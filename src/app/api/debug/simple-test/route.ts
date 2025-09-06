import { NextResponse } from 'next/server';

import { addCorsHeaders } from '@/lib/cors';

export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    const debugInfo = {
      timestamp: new Date().toISOString(),
      query: query,
      url: request.url,
      environment: {
        NEXT_PUBLIC_STORAGE_TYPE: process.env.NEXT_PUBLIC_STORAGE_TYPE,
        NODE_ENV: process.env.NODE_ENV,
      },
      message: 'Simple test endpoint working',
    };

    const response = NextResponse.json(debugInfo);
    return addCorsHeaders(response);
  } catch (error) {
    console.error('Simple test error:', {
      error: error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    const errorResponse = NextResponse.json(
      {
        error: 'Simple test failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
    return addCorsHeaders(errorResponse);
  }
}
