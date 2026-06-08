import { useRef, useState } from 'react'
import { Upload, FileText, X, CheckCircle, AlertCircle, Search, BarChart2 } from 'lucide-react'
import { parseSFCrawl, parseSFSearchConsole, parseSFAnalytics, detectSFExportType } from '../lib/parseSFCrawl'

const EXPORT_TYPES = {
  internal: {
    label: 'Internal Crawl',
    hint:  'Bulk Export → All Internal URLs',
    icon:  FileText,
    color: 'text-forest',
    bg:    'bg-green-50',
    border:'border-green-200',
  },
  gsc: {
    label: 'Search Console',
    hint:  'Bulk Export → Search Console → All',
    icon:  Search,
    color: 'text-blue-600',
    bg:    'bg-blue-50',
    border:'border-blue-200',
  },
  ga4: {
    label: 'Analytics (GA4)',
    hint:  'Bulk Export → Analytics (Google Analytics 4) → All',
    icon:  BarChart2,
    color: 'text-purple-600',
    bg:    'bg-purple-50',
    border:'border-purple-200',
  },
}

// Issue chip — green if 0, red if > 0
function IssueChip({ label, value }) {
  if (value === null || value === undefined) return null
  const ok = value === 0
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium
      ${ok ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
      {ok ? '✓' : '✗'} {label}: {value.toLocaleString()}
    </span>
  )
}

// Info chip — always gray
function InfoChip({ label, value }) {
  if (value === null || value === undefined) return null
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium bg-gray-100 text-gray-600 border-gray-200">
      {label}: {typeof value === 'number' ? value.toLocaleString() : value}
    </span>
  )
}

function InternalSummary({ data }) {
  return (
    <div className="space-y-2 mt-3">
      <div className="bg-gray-50 rounded-xl px-3.5 py-3">
        <p className="text-xs font-semibold text-gray-500 mb-2">Pages</p>
        <div className="flex flex-wrap gap-1.5">
          <InfoChip label="Total" value={data.totalPages} />
          <InfoChip label="HTML" value={data.htmlPages} />
          {data.noindexPages > 0 && <InfoChip label="Non-indexable" value={data.noindexPages} />}
          {data.maxCrawlDepth > 0 && <InfoChip label="Max depth" value={data.maxCrawlDepth} />}
        </div>
      </div>
      <div className="bg-gray-50 rounded-xl px-3.5 py-3">
        <p className="text-xs font-semibold text-gray-500 mb-2">Issues (auto-populates checklist)</p>
        <div className="flex flex-wrap gap-1.5">
          <IssueChip label="Broken (4xx)"        value={data.broken4xx} />
          <IssueChip label="Missing title"       value={data.missingTitle} />
          <IssueChip label="Duplicate titles"    value={data.duplicateTitles} />
          <IssueChip label="Title too long"      value={data.titleTooLong} />
          <IssueChip label="Missing meta"        value={data.missingMeta} />
          <IssueChip label="Missing H1"          value={data.missingH1} />
          <IssueChip label="Multiple H1s"        value={data.multipleH1} />
          <IssueChip label="Thin pages"          value={data.thinPages} />
          <IssueChip label="Depth > 3 clicks"   value={data.pagesDeepThan3} />
          <IssueChip label="Missing canonical"   value={data.missingCanonical} />
          <IssueChip label="URL issues"          value={data.urlStructureIssues} />
        </div>
      </div>
    </div>
  )
}

function GSCSummary({ data }) {
  return (
    <div className="space-y-2 mt-3">
      <div className="bg-gray-50 rounded-xl px-3.5 py-3">
        <p className="text-xs font-semibold text-gray-500 mb-2">Performance Summary</p>
        <div className="flex flex-wrap gap-1.5">
          <InfoChip label="URLs with GSC data"  value={data.totalUrls} />
          <InfoChip label="Total clicks"        value={data.totalClicks} />
          <InfoChip label="Total impressions"   value={data.totalImpressions} />
          {data.avgCTR    != null && <InfoChip label="Avg CTR"      value={`${data.avgCTR}%`} />}
          {data.avgPosition != null && <InfoChip label="Avg position" value={data.avgPosition} />}
          <InfoChip label="URLs with clicks"    value={data.urlsWithClicks} />
        </div>
      </div>
      {data.topPages?.length > 0 && (
        <div className="bg-gray-50 rounded-xl px-3.5 py-3">
          <p className="text-xs font-semibold text-gray-500 mb-2">Top pages by clicks</p>
          <div className="space-y-1">
            {data.topPages.slice(0, 5).map((p, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="text-gray-400 w-4 text-right">{i + 1}.</span>
                <span className="flex-1 text-gray-700 truncate">{p.url.replace(/^https?:\/\/[^/]+/, '')}</span>
                <span className="text-gray-500 font-medium tabular-nums">{p.clicks.toLocaleString()} clicks</span>
                <span className="text-gray-400 tabular-nums">pos {p.position}</span>
              </div>
            ))}
            {data.topPages.length > 5 && (
              <p className="text-xs text-gray-400 mt-1">+{data.topPages.length - 5} more in audit view</p>
            )}
          </div>
        </div>
      )}
      {data.lowCTR?.length > 0 && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {data.lowCTR.length} page{data.lowCTR.length !== 1 ? 's' : ''} ranking in top 20 with CTR under 2% — title/meta optimization opportunity.
        </p>
      )}
    </div>
  )
}

function GA4Summary({ data }) {
  return (
    <div className="space-y-2 mt-3">
      <div className="bg-gray-50 rounded-xl px-3.5 py-3">
        <p className="text-xs font-semibold text-gray-500 mb-2">Traffic Summary</p>
        <div className="flex flex-wrap gap-1.5">
          <InfoChip label="URLs tracked"    value={data.totalUrls} />
          <InfoChip label="Total sessions"  value={data.totalSessions} />
          {data.totalUsers > 0   && <InfoChip label="Active users"   value={data.totalUsers} />}
          {data.engagementRate != null && <InfoChip label="Engagement rate" value={`${data.engagementRate}%`} />}
          {data.zeroTraffic > 0 && <InfoChip label="Zero-traffic pages" value={data.zeroTraffic} />}
        </div>
      </div>
      {data.topPages?.length > 0 && (
        <div className="bg-gray-50 rounded-xl px-3.5 py-3">
          <p className="text-xs font-semibold text-gray-500 mb-2">Top pages by sessions</p>
          <div className="space-y-1">
            {data.topPages.slice(0, 5).map((p, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="text-gray-400 w-4 text-right">{i + 1}.</span>
                <span className="flex-1 text-gray-700 truncate">{p.url.replace(/^https?:\/\/[^/]+/, '')}</span>
                <span className="text-gray-500 font-medium tabular-nums">{p.sessions.toLocaleString()} sessions</span>
              </div>
            ))}
            {data.topPages.length > 5 && (
              <p className="text-xs text-gray-400 mt-1">+{data.topPages.length - 5} more in audit view</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function DataSourceBadge({ type, data, onClear }) {
  const cfg = EXPORT_TYPES[type]
  const Icon = cfg.icon
  const uploadedAt = data.uploadedAt
    ? new Date(data.uploadedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : null

  return (
    <div className={`rounded-xl border px-3.5 py-3 ${cfg.bg} ${cfg.border}`}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-1.5">
          <CheckCircle size={13} className="text-green-500" />
          <Icon size={13} className={cfg.color} />
          <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
        </div>
        <button
          onClick={() => onClear(type)}
          className="text-gray-400 hover:text-red-500 transition-colors"
          title={`Clear ${cfg.label} data`}
        >
          <X size={12} />
        </button>
      </div>
      <p className="text-xs text-gray-500 truncate">{data.filename}</p>
      {uploadedAt && <p className="text-xs text-gray-400">{uploadedAt}</p>}
    </div>
  )
}

export default function SFUpload({ sfData, onUpload, onClear }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [parsing, setParsing]   = useState(false)
  const [error, setError]       = useState('')
  const [detected, setDetected] = useState(null) // last detected type

  // Which data sources are loaded
  // Exclude internal crawl data — that's shown by CrawlManager, not here
  const hasInternal = !!(sfData?.totalPages) && sfData?.source !== 'internal-crawler'
  const hasGSC      = !!(sfData?.gsc)
  const hasGA4      = !!(sfData?.ga4)
  const anyLoaded   = hasInternal || hasGSC || hasGA4

  function handleFile(file) {
    if (!file) return
    if (!file.name.endsWith('.csv')) {
      setError('Please upload a .csv file exported from Screaming Frog.')
      return
    }
    setError('')
    setParsing(true)
    setDetected(null)

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target.result
      try {
        const type = detectSFExportType(text)
        setDetected(type)

        if (type === 'internal') {
          const result = parseSFCrawl(text, file.name)
          onUpload(result, 'internal')
        } else if (type === 'gsc') {
          const result = parseSFSearchConsole(text, file.name)
          onUpload(result, 'gsc')
        } else if (type === 'ga4') {
          const result = parseSFAnalytics(text, file.name)
          onUpload(result, 'ga4')
        } else {
          throw new Error(
            'Could not identify this export type. Expected an SF Internal, Search Console, or Analytics (GA4) CSV. ' +
            'Check you\'re exporting from the correct tab in Screaming Frog.'
          )
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setParsing(false)
      }
    }
    reader.onerror = () => { setError('Failed to read file.'); setParsing(false) }
    reader.readAsText(file, 'utf-8')
  }

  function onInputChange(e) { handleFile(e.target.files?.[0]); e.target.value = '' }
  function onDrop(e) { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files?.[0]) }

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">Screaming Frog Data</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Upload GSC and GA4 exports for performance data — auto-detected from columns
          </p>
        </div>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={parsing}
          className="btn-secondary flex items-center gap-1.5 text-xs flex-shrink-0"
        >
          <Upload size={12} />
          {parsing ? 'Parsing...' : 'Upload CSV'}
        </button>
        <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={onInputChange} />
      </div>

      {/* Loaded data sources */}
      {anyLoaded && (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
          {hasInternal && <DataSourceBadge type="internal" data={sfData}     onClear={onClear} />}
          {hasGSC      && <DataSourceBadge type="gsc"      data={sfData.gsc} onClear={onClear} />}
          {hasGA4      && <DataSourceBadge type="ga4"      data={sfData.ga4} onClear={onClear} />}
        </div>
      )}

      {/* What's still missing */}
      {!parsing && (
        <div className="mt-3 flex flex-wrap gap-2">
          {!hasInternal && (
            <span className="text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-1">
              {EXPORT_TYPES.internal.hint}
            </span>
          )}
          {!hasGSC && (
            <span className="text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-1">
              {EXPORT_TYPES.gsc.hint}
            </span>
          )}
          {!hasGA4 && (
            <span className="text-xs text-gray-400 bg-gray-50 border border-gray-200 rounded-full px-2.5 py-1">
              {EXPORT_TYPES.ga4.hint}
            </span>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-3 flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Drop zone — only show when nothing is loaded yet */}
      {!anyLoaded && !parsing && (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`mt-4 border-2 border-dashed rounded-xl px-6 py-8 text-center cursor-pointer transition-colors
            ${dragging ? 'border-forest bg-green-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
        >
          <FileText size={24} className="text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Drag &amp; drop a Screaming Frog CSV here, or click to browse</p>
          <p className="text-xs text-gray-400 mt-1">Search Console, GA4, or Internal export — auto-detected</p>
        </div>
      )}

      {parsing && (
        <div className="mt-4 text-center py-6 text-sm text-gray-400">Parsing export...</div>
      )}

      {/* Detail summaries */}
      {hasInternal && <InternalSummary data={sfData} />}
      {hasGSC      && <GSCSummary      data={sfData.gsc} />}
      {hasGA4      && <GA4Summary      data={sfData.ga4} />}
    </div>
  )
}
