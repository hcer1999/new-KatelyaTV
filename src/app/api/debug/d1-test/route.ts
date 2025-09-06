import { NextResponse } from 'next/server';

import { addCorsHeaders } from '@/lib/cors';

export const runtime = 'edge';

export async function GET() {
  try {
    const debugInfo: any = {
      timestamp: new Date().toISOString(),
      environment: {
        NEXT_PUBLIC_STORAGE_TYPE: process.env.NEXT_PUBLIC_STORAGE_TYPE,
        NODE_ENV: process.env.NODE_ENV,
        VERCEL: process.env.VERCEL,
        VERCEL_ENV: process.env.VERCEL_ENV,
      },
      tests: [],
    };

    // Test 1: Check if D1 database is available
    try {
      const db = (process.env as any).DB;
      if (!db) {
        debugInfo.tests.push({
          test: 'D1 Database Availability',
          success: false,
          error: 'DB environment variable is not set',
        });
      } else {
        debugInfo.tests.push({
          test: 'D1 Database Availability',
          success: true,
          message: 'DB environment variable is available',
        });

        // Test 2: Try a simple query
        try {
          const result = await db.prepare('SELECT 1 as test').first();
          debugInfo.tests.push({
            test: 'Simple Query',
            success: true,
            result: result,
          });
        } catch (error) {
          debugInfo.tests.push({
            test: 'Simple Query',
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }

        // Test 3: Check if user_settings table exists
        try {
          const result = await db
            .prepare(
              "SELECT name FROM sqlite_master WHERE type='table' AND name='user_settings'"
            )
            .first();
          debugInfo.tests.push({
            test: 'user_settings Table Check',
            success: true,
            exists: !!result,
            result: result,
          });
        } catch (error) {
          debugInfo.tests.push({
            test: 'user_settings Table Check',
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }

        // Test 4: Check if admin_configs table exists
        try {
          const result = await db
            .prepare(
              "SELECT name FROM sqlite_master WHERE type='table' AND name='admin_configs'"
            )
            .first();
          debugInfo.tests.push({
            test: 'admin_configs Table Check',
            success: true,
            exists: !!result,
            result: result,
          });
        } catch (error) {
          debugInfo.tests.push({
            test: 'admin_configs Table Check',
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }

        // Test 5: List all tables
        try {
          const result = await db
            .prepare(
              "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
            )
            .all();
          debugInfo.tests.push({
            test: 'List All Tables',
            success: true,
            tables: result.results.map((r: any) => r.name),
          });
        } catch (error) {
          debugInfo.tests.push({
            test: 'List All Tables',
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    } catch (error) {
      debugInfo.tests.push({
        test: 'D1 Database Access',
        success: false,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }

    const response = NextResponse.json(debugInfo);
    return addCorsHeaders(response);
  } catch (error) {
    const errorResponse = NextResponse.json(
      {
        error: 'D1 test endpoint failed',
        details: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 }
    );
    return addCorsHeaders(errorResponse);
  }
}
