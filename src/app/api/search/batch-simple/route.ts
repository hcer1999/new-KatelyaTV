import { NextResponse } from 'next/server';

import { addCorsHeaders } from '@/lib/cors';

export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const batch = searchParams.get('batch') || 'high';

    // 最简单的响应，不调用任何复杂的函数
    const response = NextResponse.json({
      results: [],
      batch,
      completed: true,
      message: 'Simple batch test working',
      query,
      timestamp: new Date().toISOString(),
    });

    return addCorsHeaders(response);
  } catch (error) {
    console.error('Simple batch test error:', {
      error: error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    const errorResponse = NextResponse.json(
      {
        error: 'Simple batch test failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
    return addCorsHeaders(errorResponse);
  }
}
