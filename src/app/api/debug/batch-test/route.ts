import { NextResponse } from 'next/server';

import { getBatchedApiSites, getCacheTime } from '@/lib/config';
import { addCorsHeaders } from '@/lib/cors';
import { getStorage } from '@/lib/db';

export const runtime = 'edge';

export async function GET(request: Request) {
  const debugSteps: any[] = [];

  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const batch = searchParams.get('batch') || 'high';

    debugSteps.push({
      step: 'Parse URL params',
      success: true,
      query,
      batch,
    });

    // Step 1: Test getCacheTime
    try {
      const cacheTime = await getCacheTime();
      debugSteps.push({
        step: 'getCacheTime',
        success: true,
        cacheTime,
      });
    } catch (error) {
      debugSteps.push({
        step: 'getCacheTime',
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Step 2: Test getStorage
    try {
      const storage = getStorage();
      debugSteps.push({
        step: 'getStorage',
        success: true,
        storageType: storage.constructor.name,
      });
    } catch (error) {
      debugSteps.push({
        step: 'getStorage',
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Step 3: Test getBatchedApiSites
    try {
      const batchedSites = await getBatchedApiSites(true);
      debugSteps.push({
        step: 'getBatchedApiSites',
        success: true,
        high: batchedSites.high.length,
        medium: batchedSites.medium.length,
        low: batchedSites.low.length,
        highSites: batchedSites.high.slice(0, 3).map((s) => s.key), // 只显示前3个
      });
    } catch (error) {
      debugSteps.push({
        step: 'getBatchedApiSites',
        success: false,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }

    const response = NextResponse.json({
      timestamp: new Date().toISOString(),
      environment: {
        NEXT_PUBLIC_STORAGE_TYPE: process.env.NEXT_PUBLIC_STORAGE_TYPE,
        NODE_ENV: process.env.NODE_ENV,
      },
      steps: debugSteps,
      message: 'Batch test completed',
    });
    return addCorsHeaders(response);
  } catch (error) {
    debugSteps.push({
      step: 'Main catch',
      success: false,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    const errorResponse = NextResponse.json(
      {
        error: 'Batch test failed',
        details: error instanceof Error ? error.message : String(error),
        steps: debugSteps,
      },
      { status: 500 }
    );
    return addCorsHeaders(errorResponse);
  }
}
