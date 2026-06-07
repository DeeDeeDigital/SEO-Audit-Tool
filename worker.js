/**
 * Cloudflare Worker — SEO Audit Tool
 *
 * Handles:
 *   POST /api/scan  →  technical scan (robots, sitemap, HTTPS, PageSpeed)
 *   *               →  static assets (Vite build), with SPA fallback to index.html
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    // ── API route ──────────────────────────────────────────────────────────────
    if (url.pathname === '/api/scan' && request.method === 'POST') {
      return handleScan(request, env)
    }

    // ── Static assets with SPA fallback ───────────────────────────────────────
    const response = await env.ASSETS.fetch(request)
    if (response.status === 404) {
      // Serve index.html so React Router handles the path client-side
      return env.ASSETS.fetch(new Request(new URL('/', request.url), { method: 'GET' }))
    }
    return response
  },
}

// ─── /api/scan ────────────────────────────────────────────────────────────────

async function handleScan(request, env) {
  try {
    const body = await request.json()
    const domain = body?.domain?.trim()
    if (!domain) {
      return Response.json({ error: 'domain is required' }, { status: 400 })
    }

    const base = domain.startsWith('http')
      ? domain.replace(/\/$/, '')
      : `https://${domain.replace(/\/$/, '')}`

    const robots = await checkRobots(base)

    const [sitemapResult, httpsResult, pagespeedResult] = await Promise.allSettled([
      checkSitemap(base, robots?.sitemapUrl),
      checkHttps(base),
      checkPageSpeed(base, env?.PAGESPEED_API_KEY),
    ])

    return Response.json({
      domain: base,
      scannedAt: new Date().toISOString(),
      robots,
      sitemap: settled(sitemapResult),
      https: settled(httpsResult),
      pagespeed: settled(pagespeedResult),
    })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

function settled(result) {
  return result.status === 'fulfilled'
    ? result.value
    : { error: result.reason?.message ?? 'check failed' }
}

// ─── Robots.txt ───────────────────────────────────────────────────────────────

async function checkRobots(base) {
  try {
    const res = await fetch(`${base}/robots.txt`, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SEOAuditBot/1.0)' },
    })
    if (!res.ok) return { exists: false }

    const text = await res.text()
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

    const sitemapLine = lines.find(l => /^sitemap:/i.test(l))
    const sitemapUrl = sitemapLine ? sitemapLine.replace(/^sitemap:\s*/i, '') : null
    const hasSitemap = !!sitemapUrl

    let inUserAgentAll = false
    let siteBlocked = false
    for (const line of lines) {
      if (/^user-agent:\s*\*/i.test(line)) { inUserAgentAll = true; continue }
      if (/^user-agent:/i.test(line)) { inUserAgentAll = false; continue }
      if (inUserAgentAll && /^disallow:\s*\/\s*$/i.test(line)) { siteBlocked = true }
    }

    const crawlDelayLine = lines.find(l => /^crawl-delay:/i.test(l))
    const crawlDelay = crawlDelayLine ? crawlDelayLine.replace(/^crawl-delay:\s*/i, '') : null

    return { exists: true, hasSitemap, sitemapUrl, siteBlocked, crawlDelay }
  } catch {
    return { exists: false, error: 'fetch failed' }
  }
}

// ─── Sitemap ──────────────────────────────────────────────────────────────────

async function checkSitemap(base, robotsSitemapUrl) {
  const candidates = [
    robotsSitemapUrl,
    `${base}/sitemap.xml`,
    `${base}/sitemap_index.xml`,
    `${base}/sitemap.xml.gz`,
  ].filter(Boolean)

  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(12000),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SEOAuditBot/1.0)' },
      })
      if (!res.ok) continue

      const text = await res.text()
      const isIndex = /<sitemapindex/i.test(text)
      const urlCount = (text.match(/<loc>/gi) ?? []).length

      return { exists: true, url, isIndex, urlCount }
    } catch {
      continue
    }
  }

  return { exists: false }
}

// ─── HTTPS / Redirects ────────────────────────────────────────────────────────

async function checkHttps(base) {
  const httpUrl = base.replace(/^https?:\/\//, 'http://')
  let httpRedirects = false
  let wwwConsistent = true
  let hsts = false

  try {
    const res = await fetch(httpUrl, {
      redirect: 'manual',
      signal: AbortSignal.timeout(8000),
    })
    const location = res.headers.get('location') ?? ''
    httpRedirects = (res.status === 301 || res.status === 302) && location.startsWith('https://')
  } catch { /* treat as unknown */ }

  try {
    const res = await fetch(base, {
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    })
    const finalHostname = new URL(res.url).hostname
    const originalHostname = new URL(base).hostname
    wwwConsistent = originalHostname.startsWith('www.') === finalHostname.startsWith('www.')
    hsts = !!(res.headers.get('strict-transport-security'))
  } catch { /* ignore */ }

  return { httpRedirects, wwwConsistent, hsts }
}

// ─── PageSpeed Insights ───────────────────────────────────────────────────────

async function checkPageSpeed(base, apiKey) {
  const encoded = encodeURIComponent(base)
  const keyParam = apiKey ? `&key=${apiKey}` : ''
  const endpoint = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encoded}${keyParam}`

  async function runStrategy(strategy) {
    try {
      const res = await fetch(`${endpoint}&strategy=${strategy}`, {
        signal: AbortSignal.timeout(35000),
      })
      if (!res.ok) return null

      const json = await res.json()
      const cats = json.lighthouseResult?.categories
      const auditResults = json.lighthouseResult?.audits

      if (!cats) return null

      return {
        score: cats.performance?.score != null ? Math.round(cats.performance.score * 100) : null,
        lcp: auditResults?.['largest-contentful-paint']?.displayValue ?? null,
        cls: auditResults?.['cumulative-layout-shift']?.displayValue ?? null,
        fcp: auditResults?.['first-contentful-paint']?.displayValue ?? null,
        tbt: auditResults?.['total-blocking-time']?.displayValue ?? null,
      }
    } catch {
      return null
    }
  }

  const [mobile, desktop] = await Promise.all([runStrategy('mobile'), runStrategy('desktop')])
  return { mobile, desktop }
}
