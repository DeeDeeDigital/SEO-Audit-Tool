import { useState, useRef } from 'react'
import { Globe, Loader2, X, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react'
import { analyzeCrawl } from '../lib/analyzeCrawl'

// ── Chips ────────────────────────────────────────────────────────────────────

function IssueChip({ label, value, hasExamples, onClick }) {
  if (value === null || value === undefined) return null
  const ok = value === 0
  const clickable = !ok && hasExamples

  return (
    <button
      onClick={clickable ? onClick : undefined}
      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium transition-colors
        ${ok
          ? 'bg-green-50 text-green-700 border-green-200 cursor-default'
          : clickable
            ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100 cursor-pointer'
            : 'bg-red-50 text-red-600 border-red-200 cursor-default'
        }`}
    >
      {ok ? '✓' : '✗'} {label}: {value.toLocaleString()}
    </button>
  )
}

function InfoChip({ label, value }) {
  if (value === null || value === undefined) return null
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium bg-gray-100 text-gray-600 border-gray-200">
      {label}: {typeof value === 'number' ? value.toLocaleString() : value}
    </span>
  )
}

// ── Example URL flyout ────────────────────────────────────────────────────────

function ExampleURLs({ label, urls, onClose }) {
  return (
    <div className="mt-2 bg-white border border-red-200 rounded-xl px-3.5 py-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-gray-700">{label}</p>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
          <X size={12} />
        </button>
      </div>
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {urls.map((url, i) => (
          <a
            key={i}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-xs text-blue-600 hover:text-blue-800 truncate"
          >
            {url}
          </a>
        ))}
      </div>
    </div>
  )
}

// ── Results display ───────────────────────────────────────────────────────────

function CrawlResults({ data }) {
  const [openExample, setOpenExample] = useState(null)

  function toggle(key) {
    setOpenExample(prev => prev === key ? null : key)
  }

  const crawledAt = data.crawledAt
    ? new Date(data.crawledAt).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
      })
    : null

  const ISSUES = [
    { key: 'broken4xx',          label: 'Broken (4xx)',      value: data.broken4xx },
    { key: 'missingTitle',       label: 'Missing title',     value: data.missingTitle },
    { key: 'duplicateTitles',    label: 'Duplicate titles',  value: data.duplicateTitles },
    { key: 'titleTooLong',       label: 'Title too long',    value: data.titleTooLong },
    { key: 'missingMeta',        label: 'Missing meta',      value: data.missingMeta },
    { key: 'missingH1',          label: 'Missing H1',        value: data.missingH1 },
    { key: 'multipleH1',         label: 'Multiple H1s',      value: data.multipleH1 },
    { key: 'thinPages',          label: 'Thin pages',        value: data.thinPages },
    { key: 'pagesDeepThan3',     label: 'Depth > 3 clicks',  value: data.pagesDeepThan3 },
    { key: 'missingCanonical',   label: 'Missing canonical', value: data.missingCanonical },
    { key: 'urlStructureIssues', label: 'URL issues',        value: data.urlStructureIssues },
  ]

  if ((data.imagesMissingAlt ?? 0) > 0) {
    ISSUES.push({ key: null, label: 'Images missing alt', value: data.imagesMissingAlt })
  }

  return (
    <div className="space-y-2 mt-3">
      <div className="bg-gray-50 rounded-xl px-3.5 py-3">
        <p className="text-xs font-semibold text-gray-500 mb-2">Pages crawled</p>
        <div className="flex flex-wrap gap-1.5">
          <InfoChip label="Total"          value={data.totalPages} />
          <InfoChip label="HTML"           value={data.htmlPages} />
          {(data.noindexPages ?? 0) > 0 && <InfoChip label="Non-indexable" value={data.noindexPages} />}
          {(data.redirects3xx  ?? 0) > 0 && <InfoChip label="Redirects"    value={data.redirects3xx} />}
          {data.maxCrawlDepth > 0 &&         <InfoChip label="Max depth"    value={data.maxCrawlDepth} />}
        </div>
        {crawledAt && <p className="text-xs text-gray-400 mt-2">Crawled {crawledAt}</p>}
      </div>

      <div className="bg-gray-50 rounded-xl px-3.5 py-3">
        <p className="text-xs font-semibold text-gray-500 mb-2">Issues (auto-populates checklist)</p>
        <div className="flex flex-wrap gap-1.5">
          {ISSUES.map(({ key, label, value }) => (
            <IssueChip
              key={label}
              label={label}
              value={value}
              hasExamples={!!(key && data.examples?.[key]?.length)}
              onClick={key ? () => toggle(key) : undefined}
            />
          ))}
        </div>

        {openExample && data.examples?.[openExample]?.length > 0 && (
          <ExampleURLs
            label={ISSUES.find(i => i.key === openExample)?.label ?? openExample}
            urls={data.examples[openExample]}
            onClose={() => setOpenExample(null)}
          />
        )}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CrawlManager({ domain, crawlData, onCrawlComplete, onClearCrawl }) {
  const [crawlState, setCrawlState]   = useState('idle') // idle | running | error
  const [progress, setProgress]       = useState({ crawled: 0, discovered: 0 })
  const [crawlError, setCrawlError]   = useState('')
  const [pageLimit, setPageLimit]     = useState(500)
  const cancelRef                      = useRef(false)

  const hasCrawlData = !!(crawlData?.source === 'internal-crawler' && crawlData?.totalPages)

  async function runCrawl() {
    if (!domain) return
    cancelRef.current = false
    setCrawlState('running')
    setCrawlError('')
    setProgress({ crawled: 0, discovered: 0 })

    // Normalize start URL
    const rawBase = domain.startsWith('http') ? domain : `https://${domain}`
    let startUrl
    try {
      const u = new URL(rawBase)
      u.hash = ''
      startUrl = u.origin + u.pathname + (u.search || '')
    } catch {
      setCrawlError('Invalid domain URL.')
      setCrawlState('error')
      return
    }

    // Local crawl state (not React state — avoids stale closure issues)
    const seen  = new Set([startUrl])
    const queue = [{ url: startUrl, depth: 0 }]
    const allResults = []
    const BATCH_SIZE  = 10

    while (queue.length > 0 && allResults.length < pageLimit) {
      if (cancelRef.current) break

      // Fill batch
      const batch = []
      while (batch.length < BATCH_SIZE && queue.length > 0) {
        const item = queue.shift()
        if (item) batch.push(item)
      }
      if (batch.length === 0) continue

      const batchMaxDepth = Math.max(...batch.map(b => b.depth))

      try {
        const res = await fetch('/api/crawl', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urls: batch.map(b => b.url), domain }),
        })

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}))
          throw new Error(errBody.error ?? `API error ${res.status}`)
        }

        const data = await res.json()
        const results = data.results ?? []

        // Annotate each result with its crawl depth
        results.forEach((r, i) => { r.depth = batch[i]?.depth ?? 0 })
        allResults.push(...results)

        // Enqueue newly discovered internal links
        for (const link of data.discovered ?? []) {
          if (!seen.has(link) && allResults.length + queue.length < pageLimit) {
            seen.add(link)
            queue.push({ url: link, depth: batchMaxDepth + 1 })
          }
        }

        setProgress({ crawled: allResults.length, discovered: seen.size })
      } catch (err) {
        // Log batch failure but keep going — one bad batch shouldn't abort everything
        console.warn('CrawlManager batch failed:', err.message)
      }
    }

    if (cancelRef.current) {
      setCrawlState('idle')
      return
    }

    const summary = analyzeCrawl(allResults, domain)
    setCrawlState('idle')
    onCrawlComplete(summary)
  }

  function cancelCrawl() {
    cancelRef.current = true
  }

  // Progress % — capped at 99 until complete
  const estimated = Math.max(progress.crawled, progress.discovered, 1)
  const pct = crawlState === 'running'
    ? Math.min(99, Math.round((progress.crawled / Math.min(estimated, pageLimit)) * 100)) || 5
    : 0

  return (
    <div className="card">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">Site Crawl</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Crawls all pages and auto-populates checklist items
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {crawlState === 'idle' && hasCrawlData && (
            <button
              onClick={onClearCrawl}
              className="btn-ghost p-1.5 text-gray-400 hover:text-red-500 transition-colors"
              title="Clear crawl data"
            >
              <X size={13} />
            </button>
          )}
          {crawlState === 'running' ? (
            <button
              onClick={cancelCrawl}
              className="btn-secondary flex items-center gap-1.5 text-xs text-red-600 border-red-200 hover:bg-red-50"
            >
              <X size={12} /> Cancel
            </button>
          ) : (
            <button
              onClick={runCrawl}
              disabled={!domain}
              className="btn-secondary flex items-center gap-1.5 text-xs flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {hasCrawlData
                ? <><RefreshCw size={12} /> Re-crawl</>
                : <><Globe size={12} /> Run Crawl</>
              }
            </button>
          )}
        </div>
      </div>

      {/* Page limit selector — only when idle */}
      {crawlState === 'idle' && (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-gray-400">Page limit:</span>
          <div className="flex gap-1">
            {[100, 250, 500].map(n => (
              <button
                key={n}
                onClick={() => setPageLimit(n)}
                className={`text-xs px-2 py-0.5 rounded border font-medium transition-colors
                  ${pageLimit === n
                    ? 'bg-forest text-white border-forest'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'
                  }`}
              >
                {n}
              </button>
            ))}
          </div>
          {!domain && (
            <span className="text-xs text-amber-500">Domain required to crawl</span>
          )}
        </div>
      )}

      {/* Progress bar */}
      {crawlState === 'running' && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-gray-500 flex items-center gap-1.5">
              <Loader2 size={11} className="animate-spin text-forest" />
              Crawling... {progress.crawled.toLocaleString()} pages
              {progress.discovered > progress.crawled && (
                <span className="text-gray-400">
                  ({progress.discovered.toLocaleString()} discovered)
                </span>
              )}
            </span>
            <span className="text-xs font-medium text-gray-600">{pct}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-forest rounded-full transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            Larger sites take a few minutes. You can keep working in the checklist below.
          </p>
        </div>
      )}

      {/* Error */}
      {crawlState === 'error' && crawlError && (
        <div className="mt-3 flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
          {crawlError}
        </div>
      )}

      {/* Results */}
      {hasCrawlData && crawlState !== 'running' && (
        <>
          <div className="mt-3 flex items-center gap-1.5">
            <CheckCircle size={13} className="text-green-500" />
            <span className="text-xs font-semibold text-green-700">Crawl complete</span>
          </div>
          <CrawlResults data={crawlData} />
        </>
      )}

      {/* Empty state */}
      {!hasCrawlData && crawlState === 'idle' && (
        <div className="mt-4 border-2 border-dashed border-gray-200 rounded-xl px-6 py-8 text-center">
          <Globe size={24} className="text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No crawl data yet</p>
          <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
            Detects broken links, missing tags, thin content, duplicate titles, crawl depth, and more
          </p>
        </div>
      )}
    </div>
  )
}
