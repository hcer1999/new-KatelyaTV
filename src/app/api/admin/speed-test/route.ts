import { NextRequest, NextResponse } from 'next/server';
import { getAuthInfoFromBrowserCookie } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // 验证用户权限
    const authInfo = getAuthInfoFromBrowserCookie(
      request.headers.get('cookie') || ''
    );
    if (!authInfo || (authInfo.role !== 'admin' && authInfo.role !== 'owner')) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: '缺少URL参数' }, { status: 400 });
    }

    const startTime = Date.now();

    try {
      // 使用 AbortController 设置超时
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8秒超时

      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'application/json, text/plain, */*',
          'Cache-Control': 'no-cache',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        },
      });

      clearTimeout(timeoutId);
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      if (response.ok) {
        return NextResponse.json({
          success: true,
          speed: responseTime,
          status: response.status,
          statusText: response.statusText,
        });
      } else {
        return NextResponse.json({
          success: false,
          speed: responseTime,
          error: `HTTP ${response.status}: ${response.statusText}`,
        });
      }
    } catch (error) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      let errorMessage = '测试失败';
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = '请求超时';
        } else if (error.message.includes('fetch')) {
          errorMessage = '网络连接失败';
        } else {
          errorMessage = error.message;
        }
      }

      return NextResponse.json({
        success: false,
        speed: responseTime,
        error: errorMessage,
      });
    }
  } catch (error) {
    console.error('Speed test API error:', error);
    return NextResponse.json({ error: '服务器内部错误' }, { status: 500 });
  }
}
