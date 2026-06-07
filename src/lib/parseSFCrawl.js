/**
 * Screaming Frog CSV parsers.
 *
 * Handles three SF export types — auto-detected from column headers:
 *   - Internal tab  (Bulk Export → All Internal URLs)
 *   - Search Console tab  (Bulk Export → Search Console → All)
 *   - Analytics (GA4) tab  (Bulk Export → Analytics → All)
 *
 * All parsers handle:
 *   - UTF-8 BOM
 *   - CRLF + LF line endings (Windows SF exports)
 *   - Quoted fields with commas (RFC 4180)
 *   - Missing / renamed columns gracefully
 */

// ─── CSV Parser ───────────────────────────────────────────────────────────────

function parseCSVRows(text) {
  // Strip UTF-8 BOM
  const src = text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text
  const rows = []
  let i = 0
  const n = src.length

  while (i < n) {
    const row = []
    while (i < n) {
      let field = ''
      if (src[i] === '"') {
        i++ // skip opening quote
        while (i < n) {
          if (src[i] === '"') {
            if (src[i + 1] === '"') { field += '"'; i += 2 }
            else { i++; break } // closing quote
          } else {
            field += src[i++]
          }
        }
      } else {
        while (i < n && src[i] !== ',' && src[i] !== '\r' && src[i] !== '\n') {
          field += src[i++]
        }
      }
      row.push(field)
      if (i < n && src[i] === ',') { i++; continue }
      break
    }
    if (i < n && src[i] === '\r') i++
    if (i < n && src[i] === '\n') i++
    if (row.length > 1 || (row.length === 1 && row[0] !== '')) rows.push(row)
  }
  return rows
}

// ─── Column finder ────────────────────────────────────────────────────────────

function makeColFinder(headers) {
  const normalized = headers.map(h => h.trim().toLowerCase())
  return (name) => normalized.indexOf(name.toLowerCase())
}

// ─── Main parser ──────────────────────────────────────────────────────────────

export function parseSFCrawl(csvText, filename) {
  const rows = parseCSVRows(csvText)
  if (rows.length < 2) throw new Error('File appears empty or not a valid CSV.')

  const headers = rows[0]
  const col = makeColFinder(headers)

  // Verify this looks like a Screaming Frog export
  const addrCol = col('Address')
  if (addrCol === -1) {
    throw new Error(
      'Not a Screaming Frog Internal export — "Address" column not found. ' +
      'Export the Internal tab from Screaming Frog (Bulk Export → All Internal URLs).'
    )
  }

  // Column indices — -1 means column not present in this export
  const contentTypeCol  = col('Content Type')
  const statusCodeCol   = col('Status Code')
  const indexabilityCol = col('Indexability')
  const title1Col       = col('Title 1')
  const title1LenCol    = col('Title 1 Length')
  const title2Col       = col('Title 2')
  const meta1Col        = col('Meta Description 1')
  const meta1LenCol     = col('Meta Description 1 Length')
  const h1Col           = col('H1-1')
  const h12Col          = col('H1-2')
  const wordCountCol    = col('Word Count')
  const crawlDepthCol   = col('Crawl Depth')
  const canonicalCol    = col('Canonical Link Element 1')

  // All data rows (skip header)
  const dataRows = rows.slice(1).filter(r => r[addrCol]?.trim())

  // Restrict on-page analysis to HTML pages only
  const htmlRows = contentTypeCol !== -1
    ? dataRows.filter(r => (r[contentTypeCol] ?? '').toLowerCase().includes('text/html'))
    : dataRows

  // ── Counters ────────────────────────────────────────────────────────────────
  let broken4xx       = 0
  let noindexPages    = 0
  let missingTitle    = 0
  let duplicateTitles = 0
  let titleTooLong    = 0
  let missingMeta     = 0
  let metaTooLong     = 0
  let missingH1       = 0
  let multipleH1      = 0
  let thinPages       = 0
  let pagesDeepThan3  = 0
  let maxCrawlDepth   = 0
  let missingCanonical = 0
  let urlStructureIssues = 0

  for (const row of htmlRows) {
    const addr       = row[addrCol] ?? ''
    const statusCode = statusCodeCol !== -1 ? (parseInt(row[statusCodeCol]) || 0) : 0
    const indexable  = indexabilityCol !== -1
      ? (row[indexabilityCol] ?? '').trim() !== 'Non-Indexable'
      : true

    // 4xx broken pages
    if (statusCode >= 400 && statusCode < 500) broken4xx++

    // Non-indexable page count
    if (!indexable) noindexPages++

    // URL structure: underscores or uppercase path segments
    try {
      const pathname = new URL(addr).pathname
      if (pathname.includes('_') || pathname !== pathname.toLowerCase()) urlStructureIssues++
    } catch { /* ignore invalid URLs */ }

    // On-page checks: 200 indexable pages only
    if (statusCode === 200 && indexable) {
      const title1   = title1Col   !== -1 ? (row[title1Col]   ?? '').trim() : null
      const title1Ln = title1LenCol !== -1 ? (parseInt(row[title1LenCol]) || 0) : (title1?.length ?? 0)
      const title2   = title2Col   !== -1 ? (row[title2Col]   ?? '').trim() : ''
      const meta1    = meta1Col    !== -1 ? (row[meta1Col]    ?? '').trim() : null
      const meta1Ln  = meta1LenCol !== -1 ? (parseInt(row[meta1LenCol]) || 0) : (meta1?.length ?? 0)
      const h1       = h1Col       !== -1 ? (row[h1Col]       ?? '').trim() : null
      const h12      = h12Col      !== -1 ? (row[h12Col]      ?? '').trim() : ''
      const wc       = wordCountCol  !== -1 ? (parseInt(row[wordCountCol])  ?? -1) : -1
      const depth    = crawlDepthCol !== -1 ? (parseInt(row[crawlDepthCol]) ?? -1) : -1
      const canon    = canonicalCol  !== -1 ? (row[canonicalCol] ?? '').trim() : null

      // Titles
      if (title1Col !== -1) {
        if (!title1) missingTitle++
        if (title2)  duplicateTitles++
        if (title1Ln > 60) titleTooLong++
      }

      // Meta description
      if (meta1Col !== -1) {
        if (!meta1) missingMeta++
        if (meta1Ln > 155) metaTooLong++
      }

      // H1
      if (h1Col !== -1) {
        if (!h1)  missingH1++
        if (h12)  multipleH1++
      }

      // Thin content
      if (wordCountCol !== -1 && wc >= 0 && wc < 300) thinPages++

      // Crawl depth
      if (crawlDepthCol !== -1 && depth >= 0) {
        if (depth > maxCrawlDepth) maxCrawlDepth = depth
        if (depth > 3) pagesDeepThan3++
      }

      // Canonical
      if (canonicalCol !== -1 && !canon) missingCanonical++
    }
  }

  // Combined keys used by computeAutoStatus in auditSections.js
  const titleIssues = missingTitle + duplicateTitles
  const h1Issues    = missingH1 + multipleH1

  return {
    uploadedAt: new Date().toISOString(),
    filename: filename ?? 'crawl.csv',
    totalPages: dataRows.length,
    htmlPages: htmlRows.length,
    // Raw counts
    broken4xx,
    noindexPages,
    missingTitle,
    duplicateTitles,
    titleTooLong,
    missingMeta,
    metaTooLong,
    missingH1,
    multipleH1,
    thinPages,
    pagesDeepThan3,
    maxCrawlDepth,
    missingCanonical,
    urlStructureIssues,
    // Combined keys for checklist auto-status
    titleIssues,
    h1Issues,
  }
}

// ─── Export type detector ─────────────────────────────────────────────────────

/**
 * Sniff which SF export type a CSV is based on its header row.
 * Returns: 'internal' | 'gsc' | 'ga4' | 'unknown'
 */
export function detectSFExportType(csvText) {
  const src = csvText.charCodeAt(0) === 0xFEFF ? csvText.slice(1) : csvText
  const firstLine = src.split(/\r?\n/)[0].toLowerCase()

  const has = (term) => firstLine.includes(term)

  // GSC: always has clicks + impressions + position, never has title / h1
  if (has('clicks') && has('impressions') && has('position') && !has('title 1')) return 'gsc'

  // GA4: has sessions (or engaged sessions) but not the on-page columns
  if ((has('sessions') || has('engaged sessions') || has('active users')) && !has('title 1')) return 'ga4'

  // Internal: has address + on-page columns
  if (has('address') && (has('title 1') || has('h1-1') || has('status code'))) return 'internal'

  return 'unknown'
}

// ─── GSC parser ───────────────────────────────────────────────────────────────

/**
 * Parse a Screaming Frog "Search Console" tab export.
 * Bulk Export → Search Console → All
 *
 * Returns a GSC summary object for storing in sfData.gsc
 */
export function parseSFSearchConsole(csvText, filename) {
  const rows = parseCSVRows(csvText)
  if (rows.length < 2) throw new Error('Search Console CSV appears empty.')

  const headers = rows[0]
  const col = makeColFinder(headers)

  const addrCol   = col('address')
  // SF uses these column names — try variants
  const clicksCol = col('clicks') !== -1 ? col('clicks') : col('clicks 1')
  const imprCol   = col('impressions') !== -1 ? col('impressions') : col('impressions 1')
  // CTR may be "ctr", "ctr (%)" — stored as decimal (0.054) or percent string (5.4%)
  const ctrCol    = col('ctr') !== -1 ? col('ctr') : col('ctr (%)')
  // Position may be "position" or "average position"
  const posCol    = col('position') !== -1 ? col('position') : col('average position')

  if (addrCol === -1) throw new Error('Not a Screaming Frog Search Console export — "Address" column missing.')
  if (clicksCol === -1 || imprCol === -1) throw new Error('Not a Screaming Frog Search Console export — Clicks/Impressions columns missing.')

  const dataRows = rows.slice(1).filter(r => r[addrCol]?.trim())

  let totalClicks = 0
  let totalImpressions = 0
  let totalPosition = 0
  let posCount = 0
  let urlsWithClicks = 0
  const urlData = []

  for (const row of dataRows) {
    const url    = row[addrCol]?.trim() ?? ''
    const clicks = parseInt(row[clicksCol]) || 0
    const impr   = parseInt(row[imprCol])   || 0
    let   ctr    = ctrCol !== -1 ? parseFloat(row[ctrCol]) || 0 : 0
    const pos    = posCol !== -1 ? parseFloat(row[posCol]) || 0 : 0

    // Normalise CTR: if > 1 it was stored as a percentage (e.g. 5.4), convert to decimal
    if (ctr > 1) ctr = ctr / 100

    totalClicks      += clicks
    totalImpressions += impr
    if (clicks > 0) urlsWithClicks++
    if (pos > 0) { totalPosition += pos; posCount++ }

    urlData.push({ url, clicks, impr, ctr, pos })
  }

  const avgPosition = posCount > 0 ? Math.round((totalPosition / posCount) * 10) / 10 : null
  const avgCTR      = totalImpressions > 0
    ? Math.round((totalClicks / totalImpressions) * 10000) / 100  // as %
    : null

  // Top 25 pages by clicks
  const topPages = urlData
    .filter(r => r.clicks > 0)
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 25)
    .map(r => ({
      url:         r.url,
      clicks:      r.clicks,
      impressions: r.impr,
      ctr:         Math.round(r.ctr * 10000) / 100,  // store as %
      position:    r.pos > 0 ? Math.round(r.pos * 10) / 10 : null,
    }))

  // Low CTR pages: ranking in top 20 but CTR < 2% — opportunity list
  const lowCTR = urlData
    .filter(r => r.pos > 0 && r.pos <= 20 && r.ctr < 0.02 && r.impr >= 50)
    .sort((a, b) => b.impr - a.impr)
    .slice(0, 10)
    .map(r => ({
      url:         r.url,
      impressions: r.impr,
      position:    Math.round(r.pos * 10) / 10,
      ctr:         Math.round(r.ctr * 10000) / 100,
    }))

  return {
    uploadedAt:       new Date().toISOString(),
    filename:         filename ?? 'search-console.csv',
    totalUrls:        dataRows.length,
    totalClicks,
    totalImpressions,
    avgCTR,
    avgPosition,
    urlsWithClicks,
    topPages,
    lowCTR,
  }
}

// ─── GA4 parser ───────────────────────────────────────────────────────────────

/**
 * Parse a Screaming Frog "Analytics (Google Analytics 4)" tab export.
 * Bulk Export → Analytics (Google Analytics 4) → All
 *
 * Returns a GA4 summary object for storing in sfData.ga4
 */
export function parseSFAnalytics(csvText, filename) {
  const rows = parseCSVRows(csvText)
  if (rows.length < 2) throw new Error('Analytics CSV appears empty.')

  const headers = rows[0]
  const col = makeColFinder(headers)

  const addrCol = col('address')
  if (addrCol === -1) throw new Error('Not a Screaming Frog Analytics export — "Address" column missing.')

  // SF GA4 export column name variants across versions
  const sessionsCol  = col('sessions')         !== -1 ? col('sessions')
                     : col('ga4 sessions')     !== -1 ? col('ga4 sessions')
                     : col('total sessions')   !== -1 ? col('total sessions') : -1

  const engagedCol   = col('engaged sessions') !== -1 ? col('engaged sessions')
                     : col('ga4 engaged sessions') !== -1 ? col('ga4 engaged sessions') : -1

  const usersCol     = col('active users')     !== -1 ? col('active users')
                     : col('users')            !== -1 ? col('users')
                     : col('total users')      !== -1 ? col('total users') : -1

  const newUsersCol  = col('new users')        !== -1 ? col('new users')
                     : col('ga4 new users')    !== -1 ? col('ga4 new users') : -1

  const bounceCol    = col('bounce rate')      !== -1 ? col('bounce rate')
                     : col('ga4 bounce rate')  !== -1 ? col('ga4 bounce rate') : -1

  if (sessionsCol === -1) {
    throw new Error(
      'Not a Screaming Frog Analytics export — Sessions column not found. ' +
      'Export using Bulk Export → Analytics (Google Analytics 4) → All.'
    )
  }

  const dataRows = rows.slice(1).filter(r => r[addrCol]?.trim())

  let totalSessions  = 0
  let totalEngaged   = 0
  let totalUsers     = 0
  const urlData = []

  for (const row of dataRows) {
    const url      = row[addrCol]?.trim() ?? ''
    const sessions = parseInt(row[sessionsCol]) || 0
    const engaged  = engagedCol  !== -1 ? (parseInt(row[engagedCol])  || 0) : 0
    const users    = usersCol    !== -1 ? (parseInt(row[usersCol])    || 0) : 0

    totalSessions += sessions
    totalEngaged  += engaged
    totalUsers    += users

    urlData.push({ url, sessions, engaged, users })
  }

  const engagementRate = totalSessions > 0
    ? Math.round((totalEngaged / totalSessions) * 1000) / 10
    : null

  // Top 25 pages by sessions
  const topPages = urlData
    .filter(r => r.sessions > 0)
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 25)
    .map(r => ({
      url:      r.url,
      sessions: r.sessions,
      engaged:  r.engaged || null,
      users:    r.users   || null,
    }))

  // Zero-traffic pages: in the crawl but no GA4 sessions (potential content quality issue)
  const zeroTraffic = urlData.filter(r => r.sessions === 0).length

  return {
    uploadedAt:      new Date().toISOString(),
    filename:        filename ?? 'analytics-ga4.csv',
    totalUrls:       dataRows.length,
    totalSessions,
    totalEngaged,
    totalUsers,
    engagementRate,
    zeroTraffic,
    topPages,
  }
}
