/* eslint-disable react-hooks/exhaustive-deps, @typescript-eslint/no-explicit-any */
'use client';

import { ChevronUp, Search, X } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { getAuthInfoFromBrowserCookie } from '@/lib/auth';
import {
  addSearchHistory,
  clearSearchHistory,
  deleteSearchHistory,
  getSearchHistory,
  subscribeToDataUpdates,
} from '@/lib/db.client';
import { SearchResult } from '@/lib/types';

import PageLayout from '@/components/PageLayout';
import VideoCard from '@/components/VideoCard';

function SearchPageClient() {
  // 搜索历史
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  // 返回顶部按钮显示状态
  const [showBackToTop, setShowBackToTop] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);

  // 分批加载状态
  const [batchLoading, setBatchLoading] = useState<{
    high: boolean;
    medium: boolean;
    low: boolean;
  }>({ high: false, medium: false, low: false });

  const [batchResults, setBatchResults] = useState<{
    high: SearchResult[];
    medium: SearchResult[];
    low: SearchResult[];
  }>({ high: [], medium: [], low: [] });

  const [loadingStats, setLoadingStats] = useState<{
    totalSources: number;
    completedSources: number;
    currentBatch: string;
  }>({ totalSources: 0, completedSources: 0, currentBatch: '' });

  // 分组结果状态
  const [groupedResults, setGroupedResults] = useState<{
    regular: SearchResult[];
    adult: SearchResult[];
  } | null>(null);

  // 分组标签页状态
  const [activeTab, setActiveTab] = useState<'regular' | 'adult'>('regular');

  // 源筛选状态
  const [sourceFilter, setSourceFilter] = useState<string>('all'); // 'all' 或具体源的key
  const [availableSources, setAvailableSources] = useState<
    Array<{ key: string; name: string; count: number }>
  >([]);
  const [showAllSources, setShowAllSources] = useState(false);

  // 获取默认聚合设置：只读取用户本地设置，默认为 true
  const getDefaultAggregate = () => {
    if (typeof window !== 'undefined') {
      const userSetting = localStorage.getItem('defaultAggregateSearch');
      if (userSetting !== null) {
        return JSON.parse(userSetting);
      }
    }
    return true; // 默认启用聚合
  };

  const [viewMode, setViewMode] = useState<'agg' | 'all'>(() => {
    return getDefaultAggregate() ? 'agg' : 'all';
  });

  // 统计各源的结果数量
  const updateAvailableSources = (results: SearchResult[]) => {
    const sourceMap = new Map<
      string,
      { key: string; name: string; count: number }
    >();

    results.forEach((result) => {
      const key = result.source;
      const name = result.source_name || key;

      if (sourceMap.has(key)) {
        const existing = sourceMap.get(key);
        if (existing) {
          existing.count++;
        }
      } else {
        sourceMap.set(key, { key, name, count: 1 });
      }
    });

    const sources = Array.from(sourceMap.values()).sort(
      (a, b) => b.count - a.count
    ); // 按结果数量降序排列

    setAvailableSources(sources);
  };

  // 聚合函数
  const aggregateResults = (results: SearchResult[]) => {
    const map = new Map<string, SearchResult[]>();
    results.forEach((item) => {
      // 使用 title + year + type 作为键
      const key = `${item.title.replaceAll(' ', '')}-${
        item.year || 'unknown'
      }-${item.episodes.length === 1 ? 'movie' : 'tv'}`;
      const arr = map.get(key) || [];
      arr.push(item);
      map.set(key, arr);
    });
    return Array.from(map.entries()).sort((a, b) => {
      // 优先排序：标题与搜索词完全一致的排在前面
      const aExactMatch = a[1][0].title
        .replaceAll(' ', '')
        .includes(searchQuery.trim().replaceAll(' ', ''));
      const bExactMatch = b[1][0].title
        .replaceAll(' ', '')
        .includes(searchQuery.trim().replaceAll(' ', ''));

      if (aExactMatch && !bExactMatch) return -1;
      if (!aExactMatch && bExactMatch) return 1;

      // 年份排序
      if (a[1][0].year === b[1][0].year) {
        return a[0].localeCompare(b[0]);
      } else {
        const aYear = a[1][0].year;
        const bYear = b[1][0].year;

        if (aYear === 'unknown' && bYear === 'unknown') {
          return 0;
        } else if (aYear === 'unknown') {
          return 1;
        } else if (bYear === 'unknown') {
          return -1;
        } else {
          return aYear > bYear ? -1 : 1;
        }
      }
    });
  };

  useEffect(() => {
    // 无搜索参数时聚焦搜索框
    !searchParams.get('q') && document.getElementById('searchInput')?.focus();

    // 初始加载搜索历史
    getSearchHistory().then(setSearchHistory);

    // 监听搜索历史更新事件
    const unsubscribe = subscribeToDataUpdates(
      'searchHistoryUpdated',
      (newHistory: string[]) => {
        setSearchHistory(newHistory);
      }
    );

    // 获取滚动位置的函数 - 专门针对 body 滚动
    const getScrollTop = () => {
      return document.body.scrollTop || 0;
    };

    // 使用 requestAnimationFrame 持续检测滚动位置
    let isRunning = false;
    const checkScrollPosition = () => {
      if (!isRunning) return;

      const scrollTop = getScrollTop();
      const shouldShow = scrollTop > 300;
      setShowBackToTop(shouldShow);

      requestAnimationFrame(checkScrollPosition);
    };

    // 启动持续检测
    isRunning = true;
    checkScrollPosition();

    // 监听 body 元素的滚动事件
    const handleScroll = () => {
      const scrollTop = getScrollTop();
      setShowBackToTop(scrollTop > 300);
    };

    document.body.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      unsubscribe();
      isRunning = false; // 停止 requestAnimationFrame 循环

      // 移除 body 滚动事件监听器
      document.body.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    // 当搜索参数变化时更新搜索状态
    const query = searchParams.get('q');
    if (query) {
      setSearchQuery(query);
      fetchSearchResults(query);

      // 保存到搜索历史 (事件监听会自动更新界面)
      addSearchHistory(query);
    } else {
      setShowResults(false);
    }
  }, [searchParams]);

  // 分批搜索单个批次
  const fetchBatchResults = async (
    query: string,
    batch: 'high' | 'medium' | 'low'
  ) => {
    try {
      // 获取用户认证信息
      const authInfo = getAuthInfoFromBrowserCookie();

      // 构建请求头
      const headers: HeadersInit = {};
      if (authInfo?.username) {
        headers['Authorization'] = `Bearer ${authInfo.username}`;
      }

      const response = await fetch(
        `/api/search/batch?q=${encodeURIComponent(
          query.trim()
        )}&batch=${batch}`,
        {
          headers: {
            ...headers,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          },
        }
      );
      const data = await response.json();

      return {
        results: data.results || [],
        sitesSearched: data.sites_searched || 0,
        cached: data.cached || false,
      };
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Batch ${batch} search failed:`, error);
      return { results: [], sitesSearched: 0, cached: false };
    }
  };

  // 新的分批搜索函数
  const fetchSearchResults = async (query: string) => {
    try {
      setIsLoading(true);
      setShowResults(true);

      // 重置状态
      setBatchResults({ high: [], medium: [], low: [] });
      setBatchLoading({ high: true, medium: false, low: false });
      setLoadingStats({
        totalSources: 0,
        completedSources: 0,
        currentBatch: 'high',
      });
      setSourceFilter('all');
      setAvailableSources([]);
      setShowAllSources(false);

      // 第一批：高优先级源 (3秒内完成)
      setLoadingStats((prev) => ({ ...prev, currentBatch: '高优先级源' }));
      const highResults = await fetchBatchResults(query, 'high');

      setBatchResults((prev) => ({ ...prev, high: highResults.results }));
      setBatchLoading((prev) => ({ ...prev, high: false, medium: true }));
      setLoadingStats((prev) => ({
        ...prev,
        completedSources: prev.completedSources + highResults.sitesSearched,
        currentBatch: '中优先级源',
      }));

      // 立即显示第一批结果
      const initialResults = highResults.results;
      setSearchResults(initialResults);
      updateAvailableSources(initialResults);

      // 如果第一批有足够结果且来自缓存，可以考虑不继续搜索
      if (initialResults.length >= 20 && highResults.cached) {
        setBatchLoading({ high: false, medium: false, low: false });
        setIsLoading(false);
        setLoadingStats((prev) => ({ ...prev, currentBatch: '搜索完成' }));
        return;
      }

      // 第二批：中优先级源 (5秒内完成)
      const mediumResults = await fetchBatchResults(query, 'medium');

      setBatchResults((prev) => ({ ...prev, medium: mediumResults.results }));
      setBatchLoading((prev) => ({ ...prev, medium: false, low: true }));
      setLoadingStats((prev) => ({
        ...prev,
        completedSources: prev.completedSources + mediumResults.sitesSearched,
        currentBatch: '低优先级源',
      }));

      // 合并前两批结果
      const combinedResults = [...initialResults, ...mediumResults.results];
      setSearchResults(combinedResults);
      updateAvailableSources(combinedResults);

      // 第三批：低优先级源 (后台搜索)
      const lowResults = await fetchBatchResults(query, 'low');

      setBatchResults((prev) => ({ ...prev, low: lowResults.results }));
      setBatchLoading({ high: false, medium: false, low: false });
      setLoadingStats((prev) => ({
        ...prev,
        completedSources: prev.completedSources + lowResults.sitesSearched,
        currentBatch: '搜索完成',
      }));

      // 最终合并所有结果
      const allResults = [...combinedResults, ...lowResults.results];
      setSearchResults(allResults);
      updateAvailableSources(allResults);

      // 兼容原有的分组逻辑 (简化处理)
      setGroupedResults({
        regular: allResults,
        adult: [],
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Search failed:', error);
      setSearchResults([]);
      setGroupedResults({ regular: [], adult: [] });
    } finally {
      setIsLoading(false);
      setBatchLoading({ high: false, medium: false, low: false });
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchQuery.trim().replace(/\s+/g, ' ');
    if (!trimmed) return;

    // 回显搜索框
    setSearchQuery(trimmed);
    setIsLoading(true);
    setShowResults(true);

    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    // 直接发请求
    fetchSearchResults(trimmed);

    // 保存到搜索历史 (事件监听会自动更新界面)
    addSearchHistory(trimmed);
  };

  // 返回顶部功能
  const scrollToTop = () => {
    try {
      // 根据调试结果，真正的滚动容器是 document.body
      document.body.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    } catch (error) {
      // 如果平滑滚动完全失败，使用立即滚动
      document.body.scrollTop = 0;
    }
  };

  return (
    <PageLayout activePath='/search'>
      <div className='px-4 sm:px-10 py-4 sm:py-8 overflow-visible mb-10'>
        {/* 搜索框 */}
        <div className='mb-8'>
          <form onSubmit={handleSearch} className='max-w-2xl mx-auto'>
            <div className='relative flex items-center gap-3'>
              <div className='relative flex-1'>
                <Search className='absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 dark:text-gray-500' />
                <input
                  id='searchInput'
                  type='text'
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder='搜索电影、电视剧...'
                  className='w-full h-12 rounded-lg bg-gray-50/80 py-3 pl-10 pr-4 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-400 focus:bg-white border border-gray-200/50 shadow-sm dark:bg-gray-800 dark:text-gray-300 dark:placeholder-gray-500 dark:focus:bg-gray-700 dark:border-gray-700'
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSearch(e as any);
                    }
                  }}
                />
              </div>
              <button
                type='submit'
                disabled={isLoading || !searchQuery.trim()}
                className='h-12 px-6 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all duration-200 transform hover:scale-105 disabled:hover:scale-100 shadow-lg hover:shadow-xl disabled:shadow-none flex items-center justify-center min-w-[120px]'
              >
                {isLoading ? (
                  <div className='flex items-center gap-2'>
                    <div className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin'></div>
                    <span className='text-sm'>搜索中</span>
                  </div>
                ) : (
                  <div className='flex items-center gap-2'>
                    <Search className='w-4 h-4' />
                    <span className='text-sm font-medium'>搜索</span>
                  </div>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* 搜索结果或搜索历史 */}
        <div className='max-w-[95%] mx-auto mt-12 overflow-visible'>
          {isLoading ? (
            <div className='flex flex-col justify-center items-center h-40 space-y-4'>
              <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-green-500'></div>
              <div className='text-center'>
                <p className='text-sm text-gray-600 dark:text-gray-400'>
                  正在搜索{loadingStats.currentBatch}...
                </p>
                {loadingStats.completedSources > 0 && (
                  <p className='text-xs text-gray-500 dark:text-gray-500 mt-1'>
                    已搜索 {loadingStats.completedSources} 个源
                  </p>
                )}
              </div>
            </div>
          ) : showResults ? (
            <section className='mb-12'>
              {/* 标题 + 聚合开关 */}
              <div className='mb-8 flex items-center justify-between'>
                <div className='flex flex-col'>
                  <h2 className='text-xl font-bold text-gray-800 dark:text-gray-200'>
                    搜索结果
                  </h2>
                  {/* 分批加载进度 */}
                  {(batchLoading.high ||
                    batchLoading.medium ||
                    batchLoading.low) && (
                    <div className='mt-2 flex items-center space-x-4 text-sm'>
                      <div
                        className={`flex items-center space-x-1 ${
                          batchLoading.high
                            ? 'text-blue-600'
                            : batchResults.high.length > 0
                            ? 'text-green-600'
                            : 'text-gray-400'
                        }`}
                      >
                        <div
                          className={`w-2 h-2 rounded-full ${
                            batchLoading.high
                              ? 'bg-blue-600 animate-pulse'
                              : batchResults.high.length > 0
                              ? 'bg-green-600'
                              : 'bg-gray-400'
                          }`}
                        ></div>
                        <span>高优先级</span>
                      </div>
                      <div
                        className={`flex items-center space-x-1 ${
                          batchLoading.medium
                            ? 'text-blue-600'
                            : batchResults.medium.length > 0
                            ? 'text-green-600'
                            : 'text-gray-400'
                        }`}
                      >
                        <div
                          className={`w-2 h-2 rounded-full ${
                            batchLoading.medium
                              ? 'bg-blue-600 animate-pulse'
                              : batchResults.medium.length > 0
                              ? 'bg-green-600'
                              : 'bg-gray-400'
                          }`}
                        ></div>
                        <span>中优先级</span>
                      </div>
                      <div
                        className={`flex items-center space-x-1 ${
                          batchLoading.low
                            ? 'text-blue-600'
                            : batchResults.low.length > 0
                            ? 'text-green-600'
                            : 'text-gray-400'
                        }`}
                      >
                        <div
                          className={`w-2 h-2 rounded-full ${
                            batchLoading.low
                              ? 'bg-blue-600 animate-pulse'
                              : batchResults.low.length > 0
                              ? 'bg-green-600'
                              : 'bg-gray-400'
                          }`}
                        ></div>
                        <span>低优先级</span>
                      </div>
                    </div>
                  )}
                </div>
                {/* 聚合开关 */}
                <label className='flex items-center gap-2 cursor-pointer select-none'>
                  <span className='text-sm text-gray-700 dark:text-gray-300'>
                    聚合
                  </span>
                  <div className='relative'>
                    <input
                      type='checkbox'
                      className='sr-only peer'
                      checked={viewMode === 'agg'}
                      onChange={() =>
                        setViewMode(viewMode === 'agg' ? 'all' : 'agg')
                      }
                    />
                    <div className='w-9 h-5 bg-gray-300 rounded-full peer-checked:bg-green-500 transition-colors dark:bg-gray-600'></div>
                    <div className='absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-4'></div>
                  </div>
                </label>
              </div>

              {/* 如果有分组结果且有成人内容，显示分组标签 */}
              {groupedResults && groupedResults.adult.length > 0 && (
                <div className='mb-6'>
                  <div className='flex items-center justify-center mb-4'>
                    <div className='inline-flex p-1 bg-gray-100 dark:bg-gray-800 rounded-lg'>
                      <button
                        onClick={() => setActiveTab('regular')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                          activeTab === 'regular'
                            ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                      >
                        常规结果 ({groupedResults.regular.length})
                      </button>
                      <button
                        onClick={() => setActiveTab('adult')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                          activeTab === 'adult'
                            ? 'bg-white dark:bg-gray-700 text-red-600 dark:text-red-400 shadow-sm'
                            : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                        }`}
                      >
                        成人内容 ({groupedResults.adult.length})
                      </button>
                    </div>
                  </div>
                  {activeTab === 'adult' && (
                    <div className='mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md'>
                      <p className='text-sm text-red-600 dark:text-red-400 text-center'>
                        ⚠️ 以下内容可能包含成人资源，请确保您已年满18周岁
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* 源筛选标签 - 重新设计的美观UI */}
              {availableSources.length > 0 && (
                <div className='mb-8'>
                  {/* 标题区域 */}
                  <div className='flex items-center justify-between mb-4'>
                    <div className='flex items-center gap-2'>
                      <div className='w-1 h-5 bg-gradient-to-b from-blue-500 to-purple-600 rounded-full'></div>
                      <h3 className='text-base font-semibold text-gray-800 dark:text-gray-200'>
                        视频源
                      </h3>
                    </div>
                    <div className='flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400'>
                      <div className='w-2 h-2 bg-green-500 rounded-full animate-pulse'></div>
                      <span>
                        {sourceFilter === 'all'
                          ? `${searchResults.length} 个结果`
                          : `${
                              searchResults.filter(
                                (r) => r.source === sourceFilter
                              ).length
                            } / ${searchResults.length} 个结果`}
                      </span>
                    </div>
                  </div>

                  {/* 源筛选卡片网格 */}
                  <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3'>
                    {/* 全部源卡片 */}
                    <button
                      onClick={() => setSourceFilter('all')}
                      className={`group relative overflow-hidden rounded-xl p-3 transition-all duration-200 transform hover:scale-105 ${
                        sourceFilter === 'all'
                          ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-lg shadow-blue-500/25'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-500 hover:shadow-md'
                      }`}
                    >
                      <div className='flex flex-col items-center text-center'>
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${
                            sourceFilter === 'all'
                              ? 'bg-white/20'
                              : 'bg-gray-100 dark:bg-gray-700'
                          }`}
                        >
                          <svg
                            className='w-4 h-4'
                            fill='currentColor'
                            viewBox='0 0 20 20'
                          >
                            <path
                              fillRule='evenodd'
                              d='M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z'
                              clipRule='evenodd'
                            />
                          </svg>
                        </div>
                        <span className='text-xs font-medium leading-tight'>
                          全部源
                        </span>
                        <span
                          className={`text-xs mt-1 ${
                            sourceFilter === 'all'
                              ? 'text-white/80'
                              : 'text-gray-500 dark:text-gray-400'
                          }`}
                        >
                          {searchResults.length}
                        </span>
                      </div>
                      {sourceFilter === 'all' && (
                        <div className='absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 animate-pulse'></div>
                      )}
                    </button>

                    {/* 各个源的卡片 */}
                    {(showAllSources
                      ? availableSources
                      : availableSources.slice(0, 11)
                    ).map((source) => (
                      <button
                        key={source.key}
                        onClick={() => setSourceFilter(source.key)}
                        className={`group relative overflow-hidden rounded-xl p-3 transition-all duration-200 transform hover:scale-105 ${
                          sourceFilter === source.key
                            ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/25'
                            : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:border-green-300 dark:hover:border-green-500 hover:shadow-md'
                        }`}
                        title={`${source.name} - ${source.count} 个结果`}
                      >
                        <div className='flex flex-col items-center text-center'>
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${
                              sourceFilter === source.key
                                ? 'bg-white/20'
                                : 'bg-gray-100 dark:bg-gray-700'
                            }`}
                          >
                            <svg
                              className='w-4 h-4'
                              fill='currentColor'
                              viewBox='0 0 20 20'
                            >
                              <path d='M2 6a2 2 0 012-2h6l2 2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z' />
                            </svg>
                          </div>
                          <span className='text-xs font-medium leading-tight line-clamp-1'>
                            {source.name.length > 8
                              ? source.name.substring(0, 8) + '...'
                              : source.name}
                          </span>
                          <span
                            className={`text-xs mt-1 ${
                              sourceFilter === source.key
                                ? 'text-white/80'
                                : 'text-gray-500 dark:text-gray-400'
                            }`}
                          >
                            {source.count}
                          </span>
                        </div>
                        {sourceFilter === source.key && (
                          <div className='absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 animate-pulse'></div>
                        )}
                      </button>
                    ))}

                    {/* 更多源的展开/收起按钮 */}
                    {availableSources.length > 11 && (
                      <button
                        onClick={() => setShowAllSources(!showAllSources)}
                        className='group relative overflow-hidden rounded-xl p-3 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-700/50 border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500 hover:from-gray-100 hover:to-gray-200 dark:hover:from-gray-700/50 dark:hover:to-gray-600/50 transition-all duration-200 transform hover:scale-105'
                      >
                        <div className='flex flex-col items-center text-center'>
                          <div className='w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-700 flex items-center justify-center mb-2 transition-transform group-hover:rotate-180'>
                            <svg
                              className='w-4 h-4'
                              fill='currentColor'
                              viewBox='0 0 20 20'
                            >
                              {showAllSources ? (
                                <path
                                  fillRule='evenodd'
                                  d='M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z'
                                  clipRule='evenodd'
                                />
                              ) : (
                                <path
                                  fillRule='evenodd'
                                  d='M3 10a1 1 0 011-1h4V6a1 1 0 112 0v3h4a1 1 0 110 2h-4v3a1 1 0 11-2 0v-3H4a1 1 0 01-1-1z'
                                  clipRule='evenodd'
                                />
                              )}
                            </svg>
                          </div>
                          <span className='text-xs font-medium'>
                            {showAllSources ? '收起' : '更多'}
                          </span>
                          <span className='text-xs mt-1'>
                            {showAllSources
                              ? '显示少量'
                              : `+${availableSources.length - 11}`}
                          </span>
                        </div>
                      </button>
                    )}
                  </div>
                </div>
              )}
              <div
                key={`search-results-${viewMode}-${activeTab}-${sourceFilter}`}
                className='justify-start grid grid-cols-3 gap-x-2 gap-y-14 sm:gap-y-20 px-0 sm:px-2 sm:grid-cols-[repeat(auto-fill,_minmax(11rem,_1fr))] sm:gap-x-8'
              >
                {(() => {
                  // 确定要显示的结果
                  let displayResults = searchResults;
                  if (groupedResults && groupedResults.adult.length > 0) {
                    displayResults =
                      activeTab === 'adult'
                        ? groupedResults.adult
                        : groupedResults.regular;
                  }

                  // 根据源筛选过滤结果
                  if (sourceFilter !== 'all') {
                    displayResults = displayResults.filter(
                      (result) => result.source === sourceFilter
                    );
                  }

                  // 聚合显示模式
                  if (viewMode === 'agg') {
                    const aggregated = aggregateResults(displayResults);
                    return aggregated.map(
                      ([mapKey, group]: [string, SearchResult[]]) => (
                        <div key={`agg-${mapKey}`} className='w-full'>
                          <VideoCard
                            from='search'
                            items={group}
                            query={
                              searchQuery.trim() !== group[0].title
                                ? searchQuery.trim()
                                : ''
                            }
                          />
                        </div>
                      )
                    );
                  }

                  // 列表显示模式
                  return displayResults.map((item) => (
                    <div
                      key={`all-${item.source}-${item.id}`}
                      className='w-full'
                    >
                      <VideoCard
                        id={item.id}
                        title={item.title}
                        poster={item.poster}
                        episodes={item.episodes.length}
                        source={item.source}
                        source_name={item.source_name}
                        douban_id={item.douban_id?.toString()}
                        query={
                          searchQuery.trim() !== item.title
                            ? searchQuery.trim()
                            : ''
                        }
                        year={item.year}
                        from='search'
                        type={item.episodes.length > 1 ? 'tv' : 'movie'}
                      />
                    </div>
                  ));
                })()}
                {searchResults.length === 0 && (
                  <div className='col-span-full text-center text-gray-500 py-8 dark:text-gray-400'>
                    未找到相关结果
                  </div>
                )}
              </div>
            </section>
          ) : searchHistory.length > 0 ? (
            // 搜索历史
            <section className='mb-12'>
              <h2 className='mb-4 text-xl font-bold text-gray-800 text-left dark:text-gray-200'>
                搜索历史
                {searchHistory.length > 0 && (
                  <button
                    onClick={() => {
                      clearSearchHistory(); // 事件监听会自动更新界面
                    }}
                    className='ml-3 text-sm text-gray-500 hover:text-red-500 transition-colors dark:text-gray-400 dark:hover:text-red-500'
                  >
                    清空
                  </button>
                )}
              </h2>
              <div className='flex flex-wrap gap-2'>
                {searchHistory.map((item) => (
                  <div key={item} className='relative group'>
                    <button
                      onClick={() => {
                        setSearchQuery(item);
                        router.push(
                          `/search?q=${encodeURIComponent(item.trim())}`
                        );
                      }}
                      className='px-4 py-2 bg-gray-500/10 hover:bg-gray-300 rounded-full text-sm text-gray-700 transition-colors duration-200 dark:bg-gray-700/50 dark:hover:bg-gray-600 dark:text-gray-300'
                    >
                      {item}
                    </button>
                    {/* 删除按钮 */}
                    <button
                      aria-label='删除搜索历史'
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        deleteSearchHistory(item); // 事件监听会自动更新界面
                      }}
                      className='absolute -top-1 -right-1 w-4 h-4 opacity-0 group-hover:opacity-100 bg-gray-400 hover:bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] transition-colors'
                    >
                      <X className='w-3 h-3' />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>

      {/* 返回顶部悬浮按钮 */}
      <button
        onClick={scrollToTop}
        className={`fixed bottom-20 md:bottom-6 right-6 z-[500] w-12 h-12 bg-green-500/90 hover:bg-green-500 text-white rounded-full shadow-lg backdrop-blur-sm transition-all duration-300 ease-in-out flex items-center justify-center group ${
          showBackToTop
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
        aria-label='返回顶部'
      >
        <ChevronUp className='w-6 h-6 transition-transform group-hover:scale-110' />
      </button>
    </PageLayout>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchPageClient />
    </Suspense>
  );
}
