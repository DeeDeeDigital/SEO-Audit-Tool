/**
 * Compute SEO summary stats from raw crawl results returned by /api/crawl batches.
 *
 * Output keys match the sfAutoKey values in auditSections.js so the checklist
 * auto-populates the same way Screaming Frog CSV uploads do.
 */
export function analyzeCrawl(results, domain) {
  const htmlAll = results.filter(r => r.isHtml && r.statusCode >= 200 && r.statusCode < 300)
  const htmlOk  = htmlAll.filter(r => !r.noindex)

  // ── Status counts ────────────────────────────────────────────────────────────
  let broken4xx   = 0
  let redirects3xx = 0
  let noindexPages = 0
  let errorPages   = 0

  for (const r of results) {
    if (r.statusCode >= 400 && r.statusCode < 500) broken4xx++
    else if (r.statusCode >= 300 && r.statusCode < 400) redirects3xx++
    else if (r.statusCode === 0) errorPages++
  }
  for (const r of htmlAll) {
    if (r.noindex) noindexPages++
  }

  // ── Title ────────────────────────────────────────────────────────────────────
  const titleCounts = {}
  let missingTitle   = 0
  let titleTooLong   = 0

  for (const r of htmlOk) {
    const title = (r.title ?? '').trim()
    if (!title) { missingTitle++; continue }
    if (title.length > 60) titleTooLong++
    titleCounts[title] = (titleCounts[title] || 0) + 1
  }

  const duplicateTitles = Object.values(titleCounts)
    .filter(n => n > 1)
    .reduce((sum, n) => sum + n, 0)

  // ── Meta description ─────────────────────────────────────────────────────────
  let missingMeta = 0
  let metaTooLong  = 0

  for (const r of htmlOk) {
    const meta = (r.metaDesc ?? '').trim()
    if (!meta) missingMeta++
    else if (meta.length > 155) metaTooLong++
  }

  // ── H1 ───────────────────────────────────────────────────────────────────────
  let missingH1  = 0
  let multipleH1 = 0

  for (const r of htmlOk) {
    const count = r.h1Count ?? 0
    if (count === 0) missingH1++
    else if (count > 1) multipleH1++
  }

  // ── Thin pages ───────────────────────────────────────────────────────────────
  let thinPages = 0
  for (const r of htmlOk) {
    if ((r.wordCount ?? 0) < 300) thinPages++
  }

  // ── Canonical ────────────────────────────────────────────────────────────────
  let missingCanonical = 0
  for (const r of htmlOk) {
    if (!r.canonical) missingCanonical++
  }

  // ── URL structure ────────────────────────────────────────────────────────────
  let urlStructureIssues = 0
  for (const r of results) {
    try {
      const pathname = new URL(r.url).pathname
      if (pathname.includes('_') || pathname !== pathname.toLowerCase()) urlStructureIssues++
    } catch { /* skip invalid URLs */ }
  }

  // ── Crawl depth ──────────────────────────────────────────────────────────────
  let pagesDeepThan3 = 0
  let maxCrawlDepth  = 0
  for (const r of results) {
    const depth = r.depth ?? 0
    if (depth > maxCrawlDepth) maxCrawlDepth = depth
    if (depth > 3) pagesDeepThan3++
  }

  // ── Images ───────────────────────────────────────────────────────────────────
  let imagesMissingAlt = 0
  for (const r of htmlAll) {
    imagesMissingAlt += r.imagesMissingAlt ?? 0
  }

  // ── Combined keys (sfAutoKey-compatible) ─────────────────────────────────────
  const titleIssues = missingTitle + duplicateTitles
  const h1Issues    = missingH1 + multipleH1

  // ── Example URLs for each issue type (first 10) ──────────────────────────────
  function top(list, n = 10) { return list.slice(0, n).map(r => r.url) }

  const examples = {
    broken4xx:          top(results.filter(r => r.statusCode >= 400 && r.statusCode < 500)),
    missingTitle:       top(htmlOk.filter(r => !(r.title ?? '').trim())),
    missingMeta:        top(htmlOk.filter(r => !(r.metaDesc ?? '').trim())),
    missingH1:          top(htmlOk.filter(r => (r.h1Count ?? 0) === 0)),
    multipleH1:         top(htmlOk.filter(r => (r.h1Count ?? 0) > 1)),
    thinPages:          top(htmlOk.filter(r => (r.wordCount ?? 0) < 300)),
    missingCanonical:   top(htmlOk.filter(r => !r.canonical)),
    urlStructureIssues: top(results.filter(r => {
      try {
        const p = new URL(r.url).pathname
        return p.includes('_') || p !== p.toLowerCase()
      } catch { return false }
    })),
    pagesDeepThan3:     top(results.filter(r => (r.depth ?? 0) > 3)),
  }

  return {
    // Metadata
    crawledAt:  new Date().toISOString(),
    uploadedAt: new Date().toISOString(),
    source:     'internal-crawler',
    filename:   `${domain} — built-in crawl`,

    // Page counts
    totalPages:   results.length,
    htmlPages:    htmlAll.length,
    noindexPages,
    errorPages,

    // Status
    broken4xx,
    redirects3xx,

    // On-page issues
    missingTitle,
    duplicateTitles,
    titleTooLong,
    missingMeta,
    metaTooLong,
    missingH1,
    multipleH1,
    thinPages,
    missingCanonical,
    urlStructureIssues,
    pagesDeepThan3,
    maxCrawlDepth,
    imagesMissingAlt,

    // sfAutoKey-compatible combined keys
    titleIssues,
    h1Issues,

    // Per-issue example URLs for the UI
    examples,
  }
}
