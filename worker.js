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

    // ── API routes ─────────────────────────────────────────────────────────────
    if (url.pathname === '/api/scan' && request.method === 'POST') {
      return handleScan(request, env)
    }
    if (url.pathname === '/api/crawl' && request.method === 'POST') {
      return handleCrawl(request, env)
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

// ─── /api/crawl ───────────────────────────────────────────────────────────────

async function handleCrawl(request, env) {
  try {
    const body = await request.json()
    const { urls, domain } = body

    if (!Array.isArray(urls) || !urls.length || !domain) {
      return Response.json({ error: 'urls[] and domain are required' }, { status: 400 })
    }

    const domainBase = domain.startsWith('http') ? domain : `https://${domain}`
    let domainHostname
    try {
      domainHostname = new URL(domainBase).hostname
    } catch {
      return Response.json({ error: 'Invalid domain' }, { status: 400 })
    }

    // Cap at 12 URLs per batch to stay well within Worker CPU limits
    const batch = urls.slice(0, 12)

    const settled = await Promise.allSettled(
      batch.map(url => crawlPage(url, domainHostname))
    )

    const results = []
    const discoveredSet = new Set()

    for (const r of settled) {
      if (r.status === 'fulfilled') {
        const page = r.value
        results.push(page)
        for (const link of page.links ?? []) {
          discoveredSet.add(link)
        }
      } else {
        results.push({ url: 'unknown', statusCode: 0, error: r.reason?.message ?? 'failed', links: [] })
      }
    }

    return Response.json({ results, discovered: [...discoveredSet] })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

async function crawlPage(url, domainHostname) {
  const t0 = Date.now()
  let res

  try {
    res = await fetch(url, {
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SEOAuditBot/1.0)',
        'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: AbortSignal.timeout(10000),
    })

    const responseTime = Date.now() - t0
    const statusCode = res.status
    const contentType = (res.headers.get('content-type') ?? '').toLowerCase()
    const isHtml = contentType.includes('text/html')

    // Redirect — drain body and collect the target link if it's internal
    if (statusCode >= 300 && statusCode < 400) {
      const location = res.headers.get('location') ?? ''
      let resolvedLocation = ''
      try {
        const resolved = new URL(location, url)
        resolved.hash = ''
        resolvedLocation = resolved.href
      } catch { /* invalid location */ }
      try { await res.body?.cancel() } catch {}
      const links = []
      try {
        if (resolvedLocation && new URL(resolvedLocation).hostname === domainHostname) {
          links.push(resolvedLocation)
        }
      } catch {}
      return { url, statusCode, redirectUrl: resolvedLocation, isHtml: false, responseTime, links }
    }

    // Non-HTML or error — drain and return
    if (!isHtml || statusCode >= 400) {
      try { await res.body?.cancel() } catch {}
      return { url, statusCode, contentType, isHtml: false, responseTime, links: [] }
    }

    // Parse HTML ──────────────────────────────────────────────────────────────
    const state = {
      title: '',
      metaDesc: '',
      canonical: '',
      robotsMeta: '',
      noindex: false,
      h1s: [],
      h2Count: 0,
      wordCount: 0,
      imagesTotal: 0,
      imagesMissingAlt: 0,
      internalLinkCount: 0,
      externalLinkCount: 0,
      _internalLinks: new Set(),
      _h1Text: null,
    }

    const rewriter = new HTMLRewriter()
      .on('title', {
        text(chunk) { state.title += chunk.text },
      })
      .on('meta[name="description"]', {
        element(el) {
          const c = el.getAttribute('content')
          if (c !== null) state.metaDesc = c
        },
      })
      .on('meta[name="robots"]', {
        element(el) {
          const c = (el.getAttribute('content') ?? '').toLowerCase()
          if (c) { state.robotsMeta = c; state.noindex = c.includes('noindex') }
        },
      })
      .on('link[rel="canonical"]', {
        element(el) {
          const h = el.getAttribute('href')
          if (h) state.canonical = h
        },
      })
      .on('h1', {
        element(el) {
          state._h1Text = ''
          el.onEndTag(() => {
            state.h1s.push((state._h1Text ?? '').trim())
            state._h1Text = null
          })
        },
        text(chunk) {
          if (state._h1Text !== null) state._h1Text += chunk.text
        },
      })
      .on('h2', { element() { state.h2Count++ } })
      .on('img', {
        element(el) {
          state.imagesTotal++
          if (el.getAttribute('alt') === null) state.imagesMissingAlt++
        },
      })
      .on('a[href]', {
        element(el) {
          const href = (el.getAttribute('href') ?? '').trim()
          if (!href || href.startsWith('#') || href.startsWith('mailto:') ||
              href.startsWith('tel:') || href.startsWith('javascript:')) return
          try {
            const resolved = new URL(href, url)
            resolved.hash = ''
            const clean = resolved.origin + resolved.pathname + (resolved.search || '')
            if (resolved.hostname === domainHostname) {
              state._internalLinks.add(clean)
              state.internalLinkCount++
            } else {
              state.externalLinkCount++
            }
          } catch { /* invalid URL */ }
        },
      })
      .on('p, li', {
        text(chunk) {
          if (chunk.text.trim()) {
            state.wordCount += chunk.text.trim().split(/\s+/).filter(Boolean).length
          }
        },
      })

    await rewriter.transform(res).arrayBuffer()

    const titleTrimmed = state.title.trim()
    const metaTrimmed = state.metaDesc.trim()

    return {
      url,
      statusCode,
      isHtml: true,
      responseTime,
      title: titleTrimmed,
      titleLength: titleTrimmed.length,
      metaDesc: metaTrimmed,
      metaDescLength: metaTrimmed.length,
      canonical: state.canonical,
      robotsMeta: state.robotsMeta,
      noindex: state.noindex,
      h1Count: state.h1s.length,
      h2Count: state.h2Count,
      wordCount: state.wordCount,
      imagesTotal: state.imagesTotal,
      imagesMissingAlt: state.imagesMissingAlt,
      internalLinkCount: state.internalLinkCount,
      externalLinkCount: state.externalLinkCount,
      links: [...state._internalLinks],
    }
  } catch (err) {
    try { await res?.body?.cancel() } catch {}
    return {
      url,
      statusCode: 0,
      error: err.message,
      isHtml: false,
      responseTime: Date.now() - t0,
      links: [],
    }
  }
}
