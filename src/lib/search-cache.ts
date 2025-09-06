/* eslint-disable @typescript-eslint/no-explicit-any */

import { SearchResult } from './types';

// 搜索缓存接口
interface SearchCacheItem {
  results: SearchResult[];
  timestamp: number;
  batch?: string;
}

// 内存缓存 - 在生产环境中可以考虑使用 Redis
const searchCache = new Map<string, SearchCacheItem>();

// 缓存过期时间 (30分钟)
const CACHE_EXPIRY = 30 * 60 * 1000;

// 生成缓存键
export function generateCacheKey(
  query: string,
  batch?: string,
  userName?: string
): string {
  const normalizedQuery = query.trim().toLowerCase();
  const userFilter = userName || 'anonymous';
  const batchSuffix = batch ? `_${batch}` : '';
  return `search_${normalizedQuery}_${userFilter}${batchSuffix}`;
}

// 获取缓存的搜索结果
export function getCachedSearchResult(
  query: string,
  batch?: string,
  userName?: string
): SearchResult[] | null {
  const cacheKey = generateCacheKey(query, batch, userName);
  const cached = searchCache.get(cacheKey);

  if (!cached) {
    return null;
  }

  // 检查是否过期
  if (Date.now() - cached.timestamp > CACHE_EXPIRY) {
    searchCache.delete(cacheKey);
    return null;
  }

  return cached.results;
}

// 缓存搜索结果
export function setCachedSearchResult(
  query: string,
  results: SearchResult[],
  batch?: string,
  userName?: string
): void {
  const cacheKey = generateCacheKey(query, batch, userName);
  searchCache.set(cacheKey, {
    results,
    timestamp: Date.now(),
    batch,
  });

  // 定期清理过期缓存
  cleanExpiredCache();
}

// 清理过期缓存
function cleanExpiredCache(): void {
  const now = Date.now();
  for (const [key, item] of searchCache.entries()) {
    if (now - item.timestamp > CACHE_EXPIRY) {
      searchCache.delete(key);
    }
  }
}

// 清空所有缓存
export function clearSearchCache(): void {
  searchCache.clear();
}

// 获取缓存统计信息
export function getCacheStats(): {
  size: number;
  keys: string[];
} {
  return {
    size: searchCache.size,
    keys: Array.from(searchCache.keys()),
  };
}

// 定期清理任务 (每10分钟执行一次)
if (typeof window === 'undefined') {
  // 只在服务器端设置定期清理
  setInterval(cleanExpiredCache, 10 * 60 * 1000);
}
