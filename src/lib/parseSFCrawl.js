/**
 * Screaming Frog "Internal" tab CSV parser.
 *
 * Input:  raw text of the SF internal export (UTF-8 or UTF-8 BOM)
 * Output: sfData summary object stored in Supabase sf_data column
 *
 * Handles:
 *   - UTF-8 BOM
 *   - CRLF + LF line endings (Windows SF exports use CRLF)
 *   - Quoted fields with commas inside (RFC 4180)
 *   - Missing columns gracefully (older SF versions may omit some)
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
