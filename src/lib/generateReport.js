/**
 * Self-contained HTML SEO audit report generator.
 * Returns an HTML string — no external dependencies, print-ready.
 */

function esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function badge(severity) {
  const map = {
    critical: 'badge-critical',
    high:     'badge-high',
    medium:   'badge-medium',
    low:      'badge-low',
  }
  return `<span class="badge ${map[severity] ?? 'badge-low'}">${esc(severity)}</span>`
}

function statusIcon(pass) {
  return pass
    ? `<span class="icon-pass">✓</span>`
    : `<span class="icon-fail">✗</span>`
}

// ── Section renderers ─────────────────────────────────────────────────────────

function renderHeader(title, domain, dateStr) {
  return `
<header class="report-header">
  <div class="header-inner">
    <div>
      <h1 class="report-title">${esc(title)} — SEO Audit Report</h1>
      <p class="report-meta">${esc(domain)} &nbsp;·&nbsp; ${esc(dateStr)}</p>
    </div>
    <div class="header-logo">SEO Audit</div>
  </div>
</header>`
}

function renderHealth(stats) {
  const pctColor = stats.pct >= 75 ? '#16a34a' : stats.pct >= 50 ? '#d97706' : '#dc2626'
  return `
<section class="health-section">
  <div class="health-grid">
    <div class="metric-box ${stats.pct >= 75 ? 'metric-ok' : stats.pct >= 50 ? 'metric-warn' : 'metric-bad'}">
      <span class="metric-value" style="color:${pctColor}">${stats.pct !== null ? stats.pct + '%' : '--'}</span>
      <span class="metric-label">Pass rate<br><small>${stats.pass} of ${stats.pass + stats.fail} evaluated</small></span>
    </div>
    <div class="metric-box ${stats.critFail > 0 ? 'metric-bad' : 'metric-ok'}">
      <span class="metric-value" style="color:${stats.critFail > 0 ? '#dc2626' : '#16a34a'}">${stats.critFail}</span>
      <span class="metric-label">Critical issues</span>
    </div>
    <div class="metric-box ${stats.highFail > 0 ? 'metric-warn' : 'metric-ok'}">
      <span class="metric-value" style="color:${stats.highFail > 0 ? '#ea580c' : '#16a34a'}">${stats.highFail}</span>
      <span class="metric-label">High priority issues</span>
    </div>
    <div class="metric-box">
      <span class="metric-value" style="color:#6b7280">${stats.todo}</span>
      <span class="metric-label">Not yet evaluated</span>
    </div>
  </div>
</section>`
}

function renderTechnical(td) {
  if (!td) return ''

  const blocks = []

  if (td.robots) {
    const r = td.robots
    blocks.push(`
<div class="scan-block">
  <h3>Robots.txt</h3>
  <div class="result-row">${statusIcon(r.exists)} <span>File exists at /robots.txt</span></div>
  <div class="result-row">${statusIcon(r.hasSitemap)} <span>Sitemap: directive present${r.hasSitemap && r.sitemapUrl ? ` <span class="code">${esc(r.sitemapUrl)}</span>` : ''}</span></div>
  <div class="result-row">${statusIcon(!r.siteBlocked)} <span>Site not fully blocked by Disallow: /</span></div>
  ${r.crawlDelay ? `<div class="result-row icon-warn">⚠ Crawl-delay: ${esc(r.crawlDelay)}s set (Bingbot will be throttled)</div>` : `<div class="result-row"><span class="icon-pass">✓</span> <span>No crawl-delay directive</span></div>`}
</div>`)
  }

  if (td.sitemap) {
    const s = td.sitemap
    blocks.push(`
<div class="scan-block">
  <h3>Sitemap</h3>
  <div class="result-row">${statusIcon(s.exists)} <span>${s.exists ? `Found at <span class="code">${esc(s.url)}</span>` : 'No sitemap found at common paths'}</span></div>
  ${s.exists && s.urlCount != null ? `<div class="result-row"><span class="icon-info">→</span> <span>${s.urlCount.toLocaleString()} URLs indexed${s.isIndex ? ' (sitemap index)' : ''}</span></div>` : ''}
</div>`)
  }

  if (td.https) {
    const h = td.https
    blocks.push(`
<div class="scan-block">
  <h3>HTTPS &amp; Redirects</h3>
  <div class="result-row">${statusIcon(h.httpRedirects)} <span>HTTP → HTTPS via 301</span></div>
  <div class="result-row">${statusIcon(h.wwwConsistent)} <span>Canonical domain consistent (www vs non-www)</span></div>
  ${h.hsts ? `<div class="result-row"><span class="icon-pass">✓</span> <span>HSTS enabled</span></div>` : `<div class="result-row icon-warn">⚠ No HSTS header detected</div>`}
</div>`)
  }

  if (td.pagespeed) {
    const m = td.pagespeed.mobile
    const d = td.pagespeed.desktop
    const mScore = m?.score
    const dScore = d?.score
    const scoreColor = (s) => s >= 90 ? '#16a34a' : s >= 50 ? '#d97706' : '#dc2626'
    blocks.push(`
<div class="scan-block">
  <h3>PageSpeed Insights</h3>
  ${mScore != null ? `<div class="result-row">${statusIcon(mScore >= 75)} <span>Mobile: <strong style="color:${scoreColor(mScore)}">${mScore}/100</strong></span></div>` : ''}
  ${dScore != null ? `<div class="result-row">${statusIcon(dScore >= 75)} <span>Desktop: <strong style="color:${scoreColor(dScore)}">${dScore}/100</strong></span></div>` : ''}
  ${m?.lcp ? `<div class="result-row"><span class="icon-info">→</span> <span>LCP: ${esc(m.lcp)}</span></div>` : ''}
  ${m?.cls ? `<div class="result-row"><span class="icon-info">→</span> <span>CLS: ${esc(m.cls)}</span></div>` : ''}
  ${m?.tbt ? `<div class="result-row"><span class="icon-info">→</span> <span>TBT: ${esc(m.tbt)}</span></div>` : ''}
  ${m?.fcp ? `<div class="result-row"><span class="icon-info">→</span> <span>FCP: ${esc(m.fcp)}</span></div>` : ''}
</div>`)
  }

  if (blocks.length === 0) return ''

  return `
<section>
  <h2>Technical Scan</h2>
  <div class="scan-grid">${blocks.join('')}</div>
</section>`
}

function renderCrawl(sfData) {
  if (!sfData) return ''
  const isCrawl = sfData.source === 'internal-crawler'
  const label = isCrawl ? 'Built-in crawl' : 'Screaming Frog'

  const crawledAt = sfData.crawledAt
    ? new Date(sfData.crawledAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : null

  const issueRows = [
    { label: 'Broken links (4xx)',       value: sfData.broken4xx,          critical: true },
    { label: 'Missing title tags',        value: sfData.missingTitle,        critical: true },
    { label: 'Duplicate titles',          value: sfData.duplicateTitles,     critical: false },
    { label: 'Title too long (60+ chars)',value: sfData.titleTooLong,        critical: false },
    { label: 'Missing meta descriptions', value: sfData.missingMeta,         critical: false },
    { label: 'Missing H1',                value: sfData.missingH1,           critical: true },
    { label: 'Multiple H1s',              value: sfData.multipleH1,          critical: false },
    { label: 'Thin pages (<300 words)',   value: sfData.thinPages,           critical: false },
    { label: 'Pages deeper than 3 clicks',value: sfData.pagesDeepThan3,     critical: false },
    { label: 'Missing canonical tags',    value: sfData.missingCanonical,    critical: false },
    { label: 'URL structure issues',      value: sfData.urlStructureIssues,  critical: false },
    { label: 'Images missing alt text',   value: sfData.imagesMissingAlt,    critical: false },
  ].filter(r => r.value !== undefined && r.value !== null)

  if (issueRows.length === 0 && !sfData.totalPages) return ''

  return `
<section>
  <h2>${esc(label)} Results ${crawledAt ? `<span class="section-meta">${esc(crawledAt)}</span>` : ''}</h2>
  <div class="scan-grid" style="margin-bottom:16px">
    <div class="scan-block">
      <h3>Pages</h3>
      ${sfData.totalPages != null ? `<div class="result-row"><span class="icon-info">→</span> <span>${sfData.totalPages.toLocaleString()} total pages crawled</span></div>` : ''}
      ${sfData.htmlPages   != null ? `<div class="result-row"><span class="icon-info">→</span> <span>${sfData.htmlPages.toLocaleString()} HTML pages</span></div>` : ''}
      ${sfData.noindexPages > 0    ? `<div class="result-row"><span class="icon-info">→</span> <span>${sfData.noindexPages.toLocaleString()} non-indexable (noindex)</span></div>` : ''}
      ${sfData.redirects3xx > 0    ? `<div class="result-row"><span class="icon-warn">⚠</span> <span>${sfData.redirects3xx.toLocaleString()} redirect chains (3xx)</span></div>` : ''}
      ${sfData.maxCrawlDepth > 0   ? `<div class="result-row"><span class="icon-info">→</span> <span>Max crawl depth: ${sfData.maxCrawlDepth} clicks</span></div>` : ''}
    </div>
  </div>
  <table>
    <thead>
      <tr><th>Issue</th><th style="width:80px;text-align:center">Count</th><th style="width:80px;text-align:center">Status</th></tr>
    </thead>
    <tbody>
      ${issueRows.map(r => `
      <tr>
        <td>${esc(r.label)}</td>
        <td style="text-align:center;font-weight:700;color:${r.value === 0 ? '#16a34a' : r.critical ? '#dc2626' : '#ea580c'}">${r.value.toLocaleString()}</td>
        <td style="text-align:center">${r.value === 0 ? '<span class="icon-pass">✓</span>' : '<span class="icon-fail">✗</span>'}</td>
      </tr>`).join('')}
    </tbody>
  </table>
</section>`
}

function renderGSC(sfData) {
  const gsc = sfData?.gsc
  if (!gsc) return ''
  return `
<section>
  <h2>Search Console Data</h2>
  <div class="scan-grid">
    <div class="scan-block">
      <h3>Performance</h3>
      ${gsc.totalClicks     != null ? `<div class="result-row"><span class="icon-info">→</span> <span>${gsc.totalClicks.toLocaleString()} total clicks</span></div>` : ''}
      ${gsc.totalImpressions!= null ? `<div class="result-row"><span class="icon-info">→</span> <span>${gsc.totalImpressions.toLocaleString()} impressions</span></div>` : ''}
      ${gsc.avgCTR          != null ? `<div class="result-row"><span class="icon-info">→</span> <span>Avg CTR: ${gsc.avgCTR}%</span></div>` : ''}
      ${gsc.avgPosition     != null ? `<div class="result-row"><span class="icon-info">→</span> <span>Avg position: ${gsc.avgPosition}</span></div>` : ''}
      ${gsc.urlsWithClicks  != null ? `<div class="result-row"><span class="icon-info">→</span> <span>${gsc.urlsWithClicks.toLocaleString()} URLs driving clicks</span></div>` : ''}
    </div>
    ${gsc.topPages?.length ? `
    <div class="scan-block">
      <h3>Top pages by clicks</h3>
      ${gsc.topPages.slice(0, 8).map((p, i) => `
      <div class="result-row">
        <span class="icon-info" style="min-width:18px;color:#9ca3af">${i + 1}.</span>
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px">${esc(p.url.replace(/^https?:\/\/[^/]+/, ''))}</span>
        <span style="color:#374151;font-weight:600;font-size:12px;margin-left:8px">${p.clicks.toLocaleString()} clicks</span>
      </div>`).join('')}
    </div>` : ''}
  </div>
  ${gsc.lowCTR?.length ? `<p class="callout callout-warn">⚠ ${gsc.lowCTR.length} page${gsc.lowCTR.length !== 1 ? 's' : ''} ranking in the top 20 with CTR under 2% — title and meta description optimization opportunity.</p>` : ''}
</section>`
}

function renderGA4(sfData) {
  const ga4 = sfData?.ga4
  if (!ga4) return ''
  return `
<section>
  <h2>GA4 Traffic Data</h2>
  <div class="scan-grid">
    <div class="scan-block">
      <h3>Overview</h3>
      ${ga4.totalSessions   != null ? `<div class="result-row"><span class="icon-info">→</span> <span>${ga4.totalSessions.toLocaleString()} total sessions</span></div>` : ''}
      ${ga4.totalUsers      != null ? `<div class="result-row"><span class="icon-info">→</span> <span>${ga4.totalUsers.toLocaleString()} active users</span></div>` : ''}
      ${ga4.engagementRate  != null ? `<div class="result-row"><span class="icon-info">→</span> <span>Engagement rate: ${ga4.engagementRate}%</span></div>` : ''}
      ${ga4.zeroTraffic     > 0     ? `<div class="result-row"><span class="icon-warn">⚠</span> <span>${ga4.zeroTraffic.toLocaleString()} pages with zero traffic</span></div>` : ''}
    </div>
    ${ga4.topPages?.length ? `
    <div class="scan-block">
      <h3>Top pages by sessions</h3>
      ${ga4.topPages.slice(0, 8).map((p, i) => `
      <div class="result-row">
        <span class="icon-info" style="min-width:18px;color:#9ca3af">${i + 1}.</span>
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px">${esc(p.url.replace(/^https?:\/\/[^/]+/, ''))}</span>
        <span style="color:#374151;font-weight:600;font-size:12px;margin-left:8px">${p.sessions.toLocaleString()} sessions</span>
      </div>`).join('')}
    </div>` : ''}
  </div>
</section>`
}

function renderFindings(findings) {
  if (findings.length === 0) {
    return `
<section>
  <h2>Priority Issues</h2>
  <p class="empty-state">No failed items — all evaluated items passed.</p>
</section>`
  }

  const SEV_ORDER = ['critical', 'high', 'medium', 'low']
  const groups = {}
  for (const f of findings) {
    if (!groups[f.severity]) groups[f.severity] = []
    groups[f.severity].push(f)
  }

  const GROUP_LABELS = {
    critical: '🔴 Critical Issues',
    high:     '🟠 High Priority',
    medium:   '🟡 Needs Attention',
    low:      '⚪ Low Priority',
  }

  const parts = SEV_ORDER
    .filter(s => groups[s]?.length)
    .map(s => `
<div class="issue-group">
  <div class="issue-group-header issue-${s}">${GROUP_LABELS[s]} (${groups[s].length})</div>
  <table>
    <thead>
      <tr><th style="width:160px">Section</th><th>Issue</th><th>Finding</th></tr>
    </thead>
    <tbody>
      ${groups[s].map(f => `
      <tr>
        <td style="color:#6b7280;font-size:12px">${esc(f.section)}</td>
        <td>${esc(f.label)}</td>
        <td class="finding-cell">${esc(f.finding)}</td>
      </tr>`).join('')}
    </tbody>
  </table>
</div>`)

  return `
<section class="page-break-before">
  <h2>Priority Issues — ${findings.length} item${findings.length !== 1 ? 's' : ''} need attention</h2>
  ${parts.join('')}
</section>`
}

function renderPassed(passes) {
  if (passes.length === 0) return ''
  return `
<section class="page-break-before">
  <h2>Passed Items (${passes.length})</h2>
  <table>
    <thead>
      <tr><th style="width:160px">Section</th><th>Item</th><th style="width:80px">Severity</th><th>Finding</th></tr>
    </thead>
    <tbody>
      ${passes.map(p => `
      <tr>
        <td style="color:#6b7280;font-size:12px">${esc(p.section)}</td>
        <td style="color:#374151">${esc(p.label)}</td>
        <td>${badge(p.severity)}</td>
        <td class="finding-cell">${esc(p.finding)}</td>
      </tr>`).join('')}
    </tbody>
  </table>
</section>`
}

function renderUnchecked(unchecked) {
  if (unchecked.length === 0) return ''
  const bySev = { critical: 0, high: 0, medium: 0, low: 0 }
  unchecked.forEach(u => { bySev[u.severity] = (bySev[u.severity] || 0) + 1 })
  const counts = Object.entries(bySev).filter(([, n]) => n > 0).map(([s, n]) => `${n} ${s}`).join(', ')
  return `
<section>
  <h2>Not Yet Evaluated (${unchecked.length} items)</h2>
  <p style="color:#6b7280;font-size:13px;margin-bottom:12px">${counts}. These items require manual review and haven't been marked yet.</p>
  <table>
    <thead>
      <tr><th style="width:160px">Section</th><th>Item</th><th style="width:80px">Severity</th></tr>
    </thead>
    <tbody>
      ${unchecked.map(u => `
      <tr>
        <td style="color:#6b7280;font-size:12px">${esc(u.section)}</td>
        <td style="color:#9ca3af">${esc(u.label)}</td>
        <td>${badge(u.severity)}</td>
      </tr>`).join('')}
    </tbody>
  </table>
</section>`
}

// ── CSS ───────────────────────────────────────────────────────────────────────

const CSS = `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 13px; color: #111827; background: #fff; line-height: 1.5; }
.report { max-width: 960px; margin: 0 auto; padding: 48px 32px; }

/* Header */
.report-header { border-left: 4px solid #2E7D4F; padding: 16px 24px; margin-bottom: 32px; background: #f9fafb; border-radius: 0 8px 8px 0; }
.header-inner { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
.report-title { font-size: 22px; font-weight: 800; color: #1A3A2A; line-height: 1.2; }
.report-meta { color: #6b7280; font-size: 13px; margin-top: 4px; }
.header-logo { font-size: 11px; font-weight: 700; color: #2E7D4F; letter-spacing: 0.1em; text-transform: uppercase; opacity: 0.7; flex-shrink: 0; }

/* Health summary */
.health-section { margin-bottom: 40px; }
.health-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.metric-box { padding: 20px 16px; border-radius: 10px; border: 1px solid #e5e7eb; text-align: center; }
.metric-box.metric-ok   { background: #f0fdf4; border-color: #bbf7d0; }
.metric-box.metric-warn { background: #fff7ed; border-color: #fed7aa; }
.metric-box.metric-bad  { background: #fef2f2; border-color: #fecaca; }
.metric-value { display: block; font-size: 36px; font-weight: 800; line-height: 1; }
.metric-label { display: block; font-size: 12px; color: #6b7280; margin-top: 6px; }
.metric-label small { font-size: 11px; }

/* Sections */
section { margin-bottom: 40px; }
h2 { font-size: 16px; font-weight: 700; color: #111827; padding-bottom: 8px; border-bottom: 2px solid #e5e7eb; margin-bottom: 16px; display: flex; align-items: center; gap: 12px; }
.section-meta { font-size: 11px; font-weight: 400; color: #9ca3af; margin-left: auto; }
h3 { font-size: 12px; font-weight: 700; color: #374151; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.05em; }

/* Scan grid */
.scan-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.scan-block { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; }
.result-row { display: flex; align-items: flex-start; gap: 8px; margin-bottom: 5px; font-size: 12px; color: #374151; min-height: 18px; }
.result-row:last-child { margin-bottom: 0; }

/* Icons */
.icon-pass { color: #16a34a; font-weight: 700; flex-shrink: 0; }
.icon-fail { color: #dc2626; font-weight: 700; flex-shrink: 0; }
.icon-info { color: #9ca3af; flex-shrink: 0; }
.icon-warn { color: #d97706; }
.code { font-family: 'SF Mono', Consolas, monospace; font-size: 11px; background: #f3f4f6; padding: 1px 4px; border-radius: 3px; word-break: break-all; }

/* Tables */
table { width: 100%; border-collapse: collapse; font-size: 12px; }
th { background: #f9fafb; padding: 8px 10px; text-align: left; font-weight: 600; color: #374151; border-bottom: 2px solid #e5e7eb; white-space: nowrap; }
td { padding: 7px 10px; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
tr:last-child td { border-bottom: none; }
tr:hover td { background: #fafafa; }
.finding-cell { color: #4b5563; font-size: 11px; }

/* Badges */
.badge { display: inline-block; padding: 2px 7px; border-radius: 999px; font-size: 11px; font-weight: 600; }
.badge-critical { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
.badge-high     { background: #fff7ed; color: #ea580c; border: 1px solid #fed7aa; }
.badge-medium   { background: #fefce8; color: #b45309; border: 1px solid #fde68a; }
.badge-low      { background: #f9fafb; color: #6b7280; border: 1px solid #e5e7eb; }

/* Issue groups */
.issue-group { margin-bottom: 20px; }
.issue-group-header { font-size: 13px; font-weight: 700; padding: 8px 12px; border-radius: 6px; margin-bottom: 8px; }
.issue-critical { background: #fef2f2; color: #dc2626; border-left: 3px solid #dc2626; }
.issue-high     { background: #fff7ed; color: #c2410c; border-left: 3px solid #ea580c; }
.issue-medium   { background: #fefce8; color: #92400e; border-left: 3px solid #d97706; }
.issue-low      { background: #f9fafb; color: #4b5563; border-left: 3px solid #9ca3af; }

/* Callouts */
.callout { border-radius: 8px; padding: 10px 14px; font-size: 12px; margin-top: 12px; }
.callout-warn { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; }

/* States */
.empty-state { color: #9ca3af; font-style: italic; padding: 16px 0; font-size: 13px; }

/* Page breaks */
.page-break-before { page-break-before: always; }

/* Print */
@media print {
  body { font-size: 11px; }
  .report { max-width: none; padding: 0; }
  section { page-break-inside: avoid; }
  .issue-group { page-break-inside: avoid; }
  .health-grid { grid-template-columns: repeat(4, 1fr); }
  .scan-grid   { grid-template-columns: 1fr 1fr; }
}

@media (max-width: 600px) {
  .health-grid { grid-template-columns: 1fr 1fr; }
  .scan-grid   { grid-template-columns: 1fr; }
  .header-inner { flex-direction: column; }
}
`

// ── Main export ───────────────────────────────────────────────────────────────

export function generateReportHTML({ domain, auditName, dateStr, stats, technicalData, sfData, findings, passes, unchecked }) {
  const title = auditName || domain

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SEO Audit Report — ${esc(title)}</title>
<style>${CSS}</style>
</head>
<body>
<div class="report">
  ${renderHeader(title, domain, dateStr)}
  ${renderHealth(stats)}
  ${technicalData ? renderTechnical(technicalData) : ''}
  ${sfData ? renderCrawl(sfData) : ''}
  ${sfData ? renderGSC(sfData) : ''}
  ${sfData ? renderGA4(sfData) : ''}
  ${renderFindings(findings)}
  ${renderPassed(passes)}
  ${renderUnchecked(unchecked)}
</div>
</body>
</html>`
}
