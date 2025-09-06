import { NextResponse } from 'next/server';

import { getBatchedApiSites, getCacheTime, getConfig } from '@/lib/config';
import { addCorsHeaders } from '@/lib/cors';
import { getStorage } from '@/lib/db';

export const runtime = 'edge';

export async function GET() {
  try {
    const debugInfo: any = {
      timestamp: new Date().toISOString(),
      environment: {
        DOCKER_ENV: process.env.DOCKER_ENV,
        NEXT_PUBLIC_STORAGE_TYPE: process.env.NEXT_PUBLIC_STORAGE_TYPE,
        NODE_ENV: process.env.NODE_ENV,
        VERCEL: process.env.VERCEL,
        VERCEL_ENV: process.env.VERCEL_ENV,
      },
      steps: [],
    };

    // Step 1: Test storage
    try {
      const storage = getStorage();
      debugInfo.steps.push({
        step: 'getStorage',
        success: true,
        storageType: storage.constructor.name,
      });
    } catch (error) {
      debugInfo.steps.push({
        step: 'getStorage',
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Step 2: Test getConfig
    try {
      const config = await getConfig();
      debugInfo.steps.push({
        step: 'getConfig',
        success: true,
        hasSourceConfig: !!config.SourceConfig,
        sourceCount: config.SourceConfig?.length || 0,
        siteConfigName: config.SiteConfig?.SiteName,
      });
    } catch (error) {
      debugInfo.steps.push({
        step: 'getConfig',
        success: false,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }

    // Step 3: Test getBatchedApiSites
    try {
      const batchedSites = await getBatchedApiSites(true);
      debugInfo.steps.push({
        step: 'getBatchedApiSites',
        success: true,
        high: batchedSites.high.length,
        medium: batchedSites.medium.length,
        low: batchedSites.low.length,
        sites: {
          high: batchedSites.high.map((s) => ({ key: s.key, name: s.name })),
          medium: batchedSites.medium.map((s) => ({
            key: s.key,
            name: s.name,
          })),
          low: batchedSites.low.map((s) => ({ key: s.key, name: s.name })),
        },
      });
    } catch (error) {
      debugInfo.steps.push({
        step: 'getBatchedApiSites',
        success: false,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }

    // Step 4: Test getCacheTime
    try {
      const cacheTime = await getCacheTime();
      debugInfo.steps.push({
        step: 'getCacheTime',
        success: true,
        cacheTime,
      });
    } catch (error) {
      debugInfo.steps.push({
        step: 'getCacheTime',
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    const response = NextResponse.json(debugInfo);
    return addCorsHeaders(response);
  } catch (error) {
    const errorResponse = NextResponse.json(
      {
        error: 'Debug endpoint failed',
        details: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
    return addCorsHeaders(errorResponse);
  }
}
