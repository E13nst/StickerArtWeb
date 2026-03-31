import path from 'path';
import { test, expect } from '@playwright/test';
import { setupAuth } from './helpers';
import { getTelegramInitData } from './helpers/common/auth-helpers';

function getViteEnvModuleUrlPath() {
  const absolutePath = path.resolve(process.cwd(), 'node_modules/vite/dist/client/env.mjs');
  return `/miniapp/@fs/${absolutePath.replace(/\\/g, '/')}`;
}

type RequestCategory =
  | 'html'
  | 'vite-fs'
  | 'vite-client'
  | 'app-src'
  | 'api-proxy'
  | 'auth-proxy'
  | 'stickers-proxy'
  | 'images-proxy'
  | 'asset'
  | 'other';

type RequestTrace = {
  url: string;
  method: string;
  resourceType: string;
  category: RequestCategory;
  proxyTarget: string | null;
  startedAtMs: number;
  finishedAtMs?: number;
  durationMs?: number;
  status?: number;
  failureText?: string;
};

const BACKEND_PROXY_TARGET = process.env.VITE_BACKEND_URL || 'http://localhost:8080';
const STICKER_PROXY_TARGET = process.env.VITE_STICKER_PROCESSOR_PROXY_TARGET || 'https://sticker-processor-e13nst.amvera.io';

function classifyRequest(url: string): { category: RequestCategory; proxyTarget: string | null } {
  const parsed = new URL(url);
  const pathname = parsed.pathname;

  if (pathname === '/miniapp/' || pathname === '/miniapp') {
    return { category: 'html', proxyTarget: null };
  }
  if (pathname.startsWith('/miniapp/@fs/')) {
    return { category: 'vite-fs', proxyTarget: null };
  }
  if (pathname.includes('/node_modules/vite/dist/client/')) {
    return { category: 'vite-client', proxyTarget: null };
  }
  if (pathname.startsWith('/api/')) {
    return { category: 'api-proxy', proxyTarget: BACKEND_PROXY_TARGET };
  }
  if (pathname.startsWith('/auth/')) {
    return { category: 'auth-proxy', proxyTarget: BACKEND_PROXY_TARGET };
  }
  if (pathname.startsWith('/stickers/')) {
    return { category: 'stickers-proxy', proxyTarget: STICKER_PROXY_TARGET };
  }
  if (pathname.startsWith('/images/')) {
    return { category: 'images-proxy', proxyTarget: STICKER_PROXY_TARGET };
  }
  if (pathname.startsWith('/miniapp/src/') || pathname.startsWith('/src/')) {
    return { category: 'app-src', proxyTarget: null };
  }
  if (/\.(css|js|mjs|ts|tsx|png|jpe?g|webp|gif|svg|woff2?)$/i.test(pathname)) {
    return { category: 'asset', proxyTarget: null };
  }

  return { category: 'other', proxyTarget: null };
}

function summarizeRequests(requests: RequestTrace[]) {
  const groups = new Map<RequestCategory, {
    count: number;
    failed: number;
    slow: number;
    maxMs: number;
    totalMs: number;
  }>();

  for (const request of requests) {
    const current = groups.get(request.category) || {
      count: 0,
      failed: 0,
      slow: 0,
      maxMs: 0,
      totalMs: 0,
    };

    current.count += 1;
    if (request.failureText || (request.status !== undefined && request.status >= 400)) {
      current.failed += 1;
    }
    if ((request.durationMs || 0) >= 1500) {
      current.slow += 1;
    }
    current.maxMs = Math.max(current.maxMs, request.durationMs || 0);
    current.totalMs += request.durationMs || 0;
    groups.set(request.category, current);
  }

  return Array.from(groups.entries()).map(([category, stats]) => ({
    category,
    count: stats.count,
    failed: stats.failed,
    slow: stats.slow,
    avgMs: stats.count ? Math.round(stats.totalMs / stats.count) : 0,
    maxMs: Math.round(stats.maxMs),
  }));
}

function renderDiagnosticsSummary(input: {
  baseURL?: string;
  authMode: 'authenticated' | 'unauthenticated';
  envProbe: { status: number; durationMs: number; urlPath: string };
  marks: Array<{ label: string; atMs: number }>;
  requestSummary: ReturnType<typeof summarizeRequests>;
  slowRequests: RequestTrace[];
  failedRequests: RequestTrace[];
  consoleErrors: string[];
  pageErrors: string[];
  serviceWorkers: string[];
  navigationEntry: Record<string, unknown> | null;
}) {
  const lines: string[] = [];

  lines.push('=== MINIAPP LOAD DIAGNOSTICS ===');
  lines.push(`baseURL: ${input.baseURL || 'unknown'}`);
  lines.push(`auth mode: ${input.authMode}`);
  lines.push(`env.mjs baseline: ${input.envProbe.status} за ${input.envProbe.durationMs}ms -> ${input.envProbe.urlPath}`);
  lines.push('');
  lines.push('Timeline:');
  for (const mark of input.marks) {
    lines.push(`- +${mark.atMs}ms ${mark.label}`);
  }
  lines.push('');
  lines.push('Request groups:');
  for (const item of input.requestSummary) {
    lines.push(`- ${item.category}: count=${item.count}, failed=${item.failed}, slow=${item.slow}, avg=${item.avgMs}ms, max=${item.maxMs}ms`);
  }
  lines.push('');
  lines.push('Slow requests (>1500ms):');
  for (const request of input.slowRequests.slice(0, 15)) {
    lines.push(`- ${request.category} ${request.status || 'NO_STATUS'} ${request.durationMs || 0}ms ${request.url}${request.proxyTarget ? ` -> ${request.proxyTarget}` : ''}`);
  }
  if (!input.slowRequests.length) {
    lines.push('- none');
  }
  lines.push('');
  lines.push('Failed requests:');
  for (const request of input.failedRequests.slice(0, 15)) {
    lines.push(`- ${request.category} ${request.status || 'FAILED'} ${request.failureText || ''} ${request.url}${request.proxyTarget ? ` -> ${request.proxyTarget}` : ''}`);
  }
  if (!input.failedRequests.length) {
    lines.push('- none');
  }
  lines.push('');
  lines.push('Browser console errors/warnings:');
  for (const entry of input.consoleErrors.slice(0, 20)) {
    lines.push(`- ${entry}`);
  }
  if (!input.consoleErrors.length) {
    lines.push('- none');
  }
  lines.push('');
  lines.push('Unhandled page errors:');
  for (const entry of input.pageErrors.slice(0, 20)) {
    lines.push(`- ${entry}`);
  }
  if (!input.pageErrors.length) {
    lines.push('- none');
  }
  lines.push('');
  lines.push(`Service workers: ${input.serviceWorkers.length ? input.serviceWorkers.join(', ') : 'none'}`);
  lines.push(`Navigation entry: ${input.navigationEntry ? JSON.stringify(input.navigationEntry) : 'none'}`);
  lines.push('');
  lines.push('Blind spots:');
  lines.push('- Браузер видит локальные /api, /auth, /stickers, /images, но не внутренние шаги Vite proxy и TLS-handshake на upstream.');
  lines.push('- Если upstream зависает до ответа, тест покажет конкретный локальный endpoint и длительность, но не причину внутри backend/proxy.');

  return lines.join('\n');
}

test.describe('Miniapp load diagnostics', () => {
  test('полная загрузка miniapp с диагностикой этапов, vite и proxy-запросов', async ({ page, request, baseURL }, testInfo) => {
    test.setTimeout(90000);

    const suiteStartedAt = Date.now();
    const marks: Array<{ label: string; atMs: number }> = [];
    const requestMap = new Map<object, RequestTrace>();
    const finishedRequests: RequestTrace[] = [];
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];

    const mark = (label: string) => {
      const atMs = Date.now() - suiteStartedAt;
      marks.push({ label, atMs });
      console.log(`[LOAD] +${atMs}ms ${label}`);
    };

    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        consoleErrors.push(`${msg.type().toUpperCase()}: ${msg.text()}`);
      }
    });

    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });

    page.on('request', (req) => {
      const { category, proxyTarget } = classifyRequest(req.url());
      requestMap.set(req, {
        url: req.url(),
        method: req.method(),
        resourceType: req.resourceType(),
        category,
        proxyTarget,
        startedAtMs: Date.now() - suiteStartedAt,
      });
    });

    page.on('response', (response) => {
      const trace = requestMap.get(response.request());
      if (trace) {
        trace.status = response.status();
      }
    });

    page.on('requestfinished', (req) => {
      const trace = requestMap.get(req);
      if (!trace) return;

      trace.finishedAtMs = Date.now() - suiteStartedAt;
      trace.durationMs = trace.finishedAtMs - trace.startedAtMs;
      finishedRequests.push(trace);
      requestMap.delete(req);
    });

    page.on('requestfailed', (req) => {
      const trace = requestMap.get(req);
      if (!trace) return;

      trace.finishedAtMs = Date.now() - suiteStartedAt;
      trace.durationMs = trace.finishedAtMs - trace.startedAtMs;
      trace.failureText = req.failure()?.errorText || 'UNKNOWN_REQUEST_FAILURE';
      finishedRequests.push(trace);
      requestMap.delete(req);
    });

    const envUrlPath = getViteEnvModuleUrlPath();
    const envStartedAt = Date.now();
    const envResponse = await request.get(envUrlPath);
    const envBody = await envResponse.text();
    const envDurationMs = Date.now() - envStartedAt;
    const hasAuth = Boolean(getTelegramInitData());

    expect(envResponse.ok()).toBeTruthy();
    expect(envBody).toContain('const context = (() => {');
    mark(`env.mjs baseline ${envResponse.status()} за ${envDurationMs}ms`);

    if (hasAuth) {
      await setupAuth(page);
      mark('auth prepared');
    } else {
      mark('auth skipped: TELEGRAM_INIT_DATA missing');
    }

    const gotoResponse = await page.goto('/miniapp/', { waitUntil: 'domcontentloaded' });
    mark(`goto /miniapp/ -> ${gotoResponse?.status() || 'NO_STATUS'} domcontentloaded`);

    await page.waitForURL('**/miniapp/gallery', { timeout: 15000 }).then(() => {
      mark('router redirected to /miniapp/gallery');
    }).catch(() => {
      mark(`router redirect timeout, current URL: ${page.url()}`);
    });

    await page.waitForLoadState('load', { timeout: 15000 }).then(() => {
      mark('window load');
    }).catch(() => {
      mark('window load timeout');
    });

    const rootVisible = await page.locator('#root').isVisible().catch(() => false);
    mark(rootVisible ? '#root visible' : '#root not visible');

    const galleryVisible = await page.locator('[data-testid="gallery-container"]').waitFor({ state: 'visible', timeout: 25000 }).then(() => true).catch(() => false);
    mark(galleryVisible ? 'gallery container visible' : 'gallery container timeout');

    const packCardsCount = await page.locator('[data-testid="pack-card"]').count().catch(() => 0);
    mark(`pack cards on screen: ${packCardsCount}`);

    await page.waitForLoadState('networkidle', { timeout: 10000 }).then(() => {
      mark('networkidle reached');
    }).catch(() => {
      mark('networkidle timeout');
    });

    await page.waitForTimeout(3000);
    mark('post-load observation window finished');

    const serviceWorkers = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) {
        return [];
      }
      const registrations = await navigator.serviceWorker.getRegistrations();
      return registrations.map((registration) => registration.scope);
    });

    const navigationEntry = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      if (!nav) return null;

      return {
        entryType: nav.entryType,
        type: nav.type,
        domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd),
        loadEventMs: Math.round(nav.loadEventEnd),
        durationMs: Math.round(nav.duration),
        transferSize: nav.transferSize,
      };
    });

    const pendingRequests = Array.from(requestMap.values()).map((trace) => ({
      ...trace,
      durationMs: Date.now() - suiteStartedAt - trace.startedAtMs,
      failureText: trace.failureText || 'PENDING_AT_TEST_END',
    }));

    const allRequests = [...finishedRequests, ...pendingRequests];
    const requestSummary = summarizeRequests(allRequests);
    const slowRequests = [...allRequests]
      .filter((entry) => (entry.durationMs || 0) >= 1500)
      .sort((a, b) => (b.durationMs || 0) - (a.durationMs || 0));
    const failedRequests = [...allRequests]
      .filter((entry) => entry.failureText || (entry.status !== undefined && entry.status >= 400))
      .sort((a, b) => (b.durationMs || 0) - (a.durationMs || 0));

    const summaryText = renderDiagnosticsSummary({
      baseURL,
      authMode: hasAuth ? 'authenticated' : 'unauthenticated',
      envProbe: {
        status: envResponse.status(),
        durationMs: envDurationMs,
        urlPath: envUrlPath,
      },
      marks,
      requestSummary,
      slowRequests,
      failedRequests,
      consoleErrors,
      pageErrors,
      serviceWorkers,
      navigationEntry,
    });

    console.log(summaryText);

    await testInfo.attach('miniapp-load-diagnostics.txt', {
      body: Buffer.from(summaryText, 'utf8'),
      contentType: 'text/plain',
    });

    await testInfo.attach('miniapp-load-diagnostics.json', {
      body: Buffer.from(JSON.stringify({
        envProbe: {
          status: envResponse.status(),
          durationMs: envDurationMs,
          urlPath: envUrlPath,
        },
        authMode: hasAuth ? 'authenticated' : 'unauthenticated',
        marks,
        requestSummary,
        slowRequests,
        failedRequests,
        consoleErrors,
        pageErrors,
        serviceWorkers,
        navigationEntry,
      }, null, 2), 'utf8'),
      contentType: 'application/json',
    });

    expect(rootVisible).toBeTruthy();
    expect(galleryVisible).toBeTruthy();
    expect(envDurationMs, summaryText).toBeLessThan(5000);
  });
});
