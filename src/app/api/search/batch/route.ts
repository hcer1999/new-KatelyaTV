import { NextResponse } from 'next/server';

import { getBatchedApiSites, getCacheTime } from '@/lib/config';
import { addCorsHeaders, handleOptionsRequest } from '@/lib/cors';
import { getStorage } from '@/lib/db';
import { searchFromApi } from '@/lib/downstream';
import {
  getCachedSearchResult,
  setCachedSearchResult,
} from '@/lib/search-cache';

export const runtime = 'edge';

// 处理OPTIONS预检请求
export async function OPTIONS() {
  return handleOptionsRequest();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');
  const batch = searchParams.get('batch') || 'high'; // high, medium, low

  // 从 Authorization header 或 query parameter 获取用户名
  let userName: string | undefined = searchParams.get('user') || undefined;
  if (!userName) {
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      userName = authHeader.substring(7);
    }
  }

  if (!query) {
    const cacheTime = await getCacheTime();
    const response = NextResponse.json(
      {
        results: [],
        batch,
        completed: true,
      },
      {
        headers: {
          'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
          'CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
        },
      }
    );
    return addCorsHeaders(response);
  }

  try {
    // 检查缓存
    const cachedResults = getCachedSearchResult(query, batch, userName);
    if (cachedResults) {
      const cacheTime = await getCacheTime();
      const response = NextResponse.json(
        {
          results: cachedResults,
          batch,
          completed: true,
          cached: true,
          total_results: cachedResults.length,
        },
        {
          headers: {
            'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
            'CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
          },
        }
      );
      return addCorsHeaders(response);
    }

    // 获取用户的成人内容过滤设置
    let shouldFilterAdult = true; // 默认过滤
    if (userName) {
      try {
        const storage = getStorage();
        const userSettings = await storage.getUserSettings(userName);
        shouldFilterAdult = userSettings?.filter_adult_content !== false;
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn('Failed to get user settings, using default filter:', {
          error: error,
          message: error instanceof Error ? error.message : String(error),
          userName: userName,
        });
        shouldFilterAdult = true;
      }
    }

    // 获取分批的API站点
    const batchedSites = await getBatchedApiSites(shouldFilterAdult);

    let sitesToSearch: typeof batchedSites.high = [];
    switch (batch) {
      case 'high':
        sitesToSearch = batchedSites.high;
        break;
      case 'medium':
        sitesToSearch = batchedSites.medium;
        break;
      case 'low':
        sitesToSearch = batchedSites.low;
        break;
      default:
        sitesToSearch = batchedSites.high;
    }

    if (!sitesToSearch || sitesToSearch.length === 0) {
      const cacheTime = await getCacheTime();
      const response = NextResponse.json(
        {
          results: [],
          batch,
          completed: true,
        },
        {
          headers: {
            'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
            'CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
          },
        }
      );
      return addCorsHeaders(response);
    }

    // 设置不同批次的超时时间
    const timeouts = {
      high: 3000, // 3秒 - 高优先级源要求快速响应
      medium: 5000, // 5秒 - 中等优先级源
      low: 8000, // 8秒 - 低优先级源保持原有超时
    };

    const timeout = timeouts[batch as keyof typeof timeouts] || 3000;

    // 搜索当前批次的所有站点
    const searchPromises = sitesToSearch.map(async (site) => {
      try {
        // 为每个搜索添加批次级别的超时控制
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const searchPromise = searchFromApi(site, query);
        const result = await Promise.race([
          searchPromise,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Batch timeout')), timeout)
          ),
        ]);

        clearTimeout(timeoutId);
        return result as Awaited<ReturnType<typeof searchFromApi>>;
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn(`Search failed for site ${site.key}:`, error);
        return [];
      }
    });

    const searchResults = (await Promise.all(searchPromises)).flat();

    // 缓存搜索结果
    if (searchResults.length > 0) {
      setCachedSearchResult(query, searchResults, batch, userName);
    }

    const cacheTime = await getCacheTime();
    const response = NextResponse.json(
      {
        results: searchResults,
        batch,
        completed: true,
        sites_searched: sitesToSearch.length,
        total_results: searchResults.length,
        cached: false,
      },
      {
        headers: {
          'Cache-Control': `public, max-age=${cacheTime}, s-maxage=${cacheTime}`,
          'CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
          'Vercel-CDN-Cache-Control': `public, s-maxage=${cacheTime}`,
        },
      }
    );
    return addCorsHeaders(response);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Batch search error - 详细错误信息:', {
      error: error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      query: query,
      batch: batch,
      userName: userName,
      url: request.url,
    });
    const response = NextResponse.json(
      {
        results: [],
        batch,
        completed: false,
        error: 'Search failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
    return addCorsHeaders(response);
  }
}
