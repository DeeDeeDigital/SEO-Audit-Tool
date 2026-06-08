import { useRef, useState } from 'react'
import {
  Upload, FileText, Search, BarChart2,
  CheckCircle, X, AlertCircle, RefreshCw,
} from 'lucide-react'
import {
  parseSFCrawl, parseSFSearchConsole, parseSFAnalytics, detectSFExportType,
} from '../lib/parseSFCrawl'

// ── Issue / info chips (reused across summaries) ──────────────────────────────

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

function InfoChip({ label, value }) {
  if (value === null || value === undefined) return null
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium bg-gray-100 text-gray-600 border-gray-200">
      {label}: {typeof value === 'number' ? value.toLocaleString() : value}
    </span>
  )
}

// ── Per-type summary panels ───────────────────────────────────────────────────

function InternalSummary({ data }) {
  return (
    <div className="space-y-2 mt-3">
      <div className="flex flex-wrap gap-1.5">
        <InfoChip label="Pages"    value={data.totalPages} />
        <InfoChip label="HTML"     value={data.htmlPages} />
        {(data.noindexPages ?? 0) > 0 && <InfoChip label="Noindex" value={data.noindexPages} />}
        {data.maxCrawlDepth > 0          && <InfoChip label="Max depth" value={data.maxCrawlDepth} />}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <IssueChip label="Broken (4xx)"     value={data.broken4xx} />
        <IssueChip label="Missing title"    value={data.missingTitle} />
        <IssueChip label="Dup titles"       value={data.duplicateTitles} />
        <IssueChip label="Missing meta"     value={data.missingMeta} />
        <IssueChip label="Missing H1"       value={data.missingH1} />
        <IssueChip label="Multiple H1s"     value={data.multipleH1} />
        <IssueChip label="Thin pages"       value={data.thinPages} />
        <IssueChip label="Depth &gt; 3"    value={data.pagesDeepThan3} />
        <IssueChip label="No canonical"     value={data.missingCanonical} />
        <IssueChip label="URL issues"       value={data.urlStructureIssues} />
      </div>
    </div>
  )
}

function GSCSummary({ data }) {
  return (
    <div className="space-y-2 mt-3">
      <div className="flex flex-wrap gap-1.5">
        <InfoChip label="Clicks"       value={data.totalClicks} />
        <InfoChip label="Impressions"  value={data.totalImpressions} />
        {data.avgCTR      != null && <InfoChip label="Avg CTR"  value={`${data.avgCTR}%`} />}
        {data.avgPosition != null && <InfoChip label="Avg pos"  value={data.avgPosition} />}
        <InfoChip label="URLs w/ clicks" value={data.urlsWithClicks} />
      </div>
      {data.lowCTR?.length > 0 && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
          {data.lowCTR.length} page{data.lowCTR.length !== 1 ? 's' : ''} in top 20 with CTR &lt; 2% — title/meta opportunity
        </p>
      )}
    </div>
  )
}

function GA4Summary({ data }) {
  return (
    <div className="space-y-2 mt-3">
      <div className="flex flex-wrap gap-1.5">
        <InfoChip label="Sessions"    value={data.totalSessions} />
        {data.totalUsers > 0         && <InfoChip label="Users"       value={data.totalUsers} />}
        {data.engagementRate != null && <InfoChip label="Engagement"  value={`${data.engagementRate}%`} />}
        {data.zeroTraffic > 0        && <InfoChip label="Zero-traffic" value={data.zeroTraffic} />}
      </div>
    </div>
  )
}

// ── Single upload panel ───────────────────────────────────────────────────────

const PANEL_CONFIG = {
  internal: {
    label:       'Screaming Frog',
    sublabel:    'Internal Crawl',
    Icon:        FileText,
    accent:      'text-forest',
    accentBg:    'bg-green-50',
    accentBorder:'border-green-200',
    steps: [
      'Crawl the site in Screaming Frog',
      'Bulk Export → All Internal URLs',
    ],
  },
  gsc: {
    label:       'Search Console',
    sublabel:    'GSC Performance',
    Icon:        Search,
    accent:      'text-blue-600',
    accentBg:    'bg-blue-50',
    accentBorder:'border-blue-200',
    steps: [
      'Connect GSC in SF (Config → API Access)',
      'Bulk Export → Search Console → All',
    ],
  },
  ga4: {
    label:       'Google Analytics',
    sublabel:    'GA4 Traffic',
    Icon:        BarChart2,
    accent:      'text-purple-600',
    accentBg:    'bg-purple-50',
    accentBorder:'border-purple-200',
    steps: [
      'Connect GA4 in SF (Config → API Access)',
      'Bulk Export → Analytics (GA4) → All',
    ],
  },
}

function UploadPanel({ type, isLoaded, isLoading, error, data, gscData, ga4Data, onFile, onClear }) {
  const cfg     = PANEL_CONFIG[type]
  const { Icon } = cfg
  const inputRef = useRef(null)
  const [drag, setDrag] = useState(false)

  const uploadedAt = (
    (type === 'internal' ? data?.uploadedAt : null) ||
    (type === 'gsc'      ? gscData?.uploadedAt : null) ||
    (type === 'ga4'      ? ga4Data?.uploadedAt : null)
  )
  const timeLabel = uploadedAt
    ? new Date(uploadedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : null

  const filename = (
    (type === 'internal' ? data?.filename : null) ||
    (type === 'gsc'      ? gscData?.filename : null) ||
    (type === 'ga4'      ? ga4Data?.filename : null)
  )

  function handle(file) {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.csv')) {
      onFile(null, 'not-csv')
      return
    }
    onFile(file)
  }

  return (
    <div className={`rounded-xl border flex flex-col transition-colors
      ${isLoaded ? `${cfg.accentBg} ${cfg.accentBorder}` : 'bg-white border-gray-200'}`}>

      {/* Panel header */}
      <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <Icon size={15} className={isLoaded ? cfg.accent : 'text-gray-400'} />
          <div>
            <p className={`text-xs font-semibold leading-tight ${isLoaded ? cfg.accent : 'text-gray-700'}`}>
              {cfg.label}
            </p>
            <p className="text-xs text-gray-400">{cfg.sublabel}</p>
          </div>
        </div>
        {isLoaded && (
          <button
            onClick={() => onClear(type)}
            className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
            title="Clear data"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* Loaded state */}
      {isLoaded && (
        <div className="px-4 pb-3">
          {timeLabel && <p className="text-xs text-gray-400 mb-2">Loaded {timeLabel}</p>}
          {filename  && <p className="text-xs text-gray-400 truncate mb-2" title={filename}>{filename}</p>}

          {type === 'internal' && data     && <InternalSummary data={data} />}
          {type === 'gsc'      && gscData  && <GSCSummary      data={gscData} />}
          {type === 'ga4'      && ga4Data  && <GA4Summary      data={ga4Data} />}

          <button
            onClick={() => inputRef.current?.click()}
            disabled={isLoading}
            className="mt-3 flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            <RefreshCw size={11} /> Re-upload
          </button>
        </div>
      )}

      {/* Not-loaded state */}
      {!isLoaded && (
        <div className="flex flex-col flex-1 px-4 pb-4">
          {/* Instructions */}
          <div className="flex-1 mb-3">
            <p className="text-xs font-medium text-gray-500 mb-1.5">How to export:</p>
            {cfg.steps.map((step, i) => (
              <div key={i} className="flex items-start gap-2 mb-1">
                <span className="text-xs text-gray-300 font-mono mt-0.5">{i + 1}.</span>
                <span className="text-xs text-gray-500">{step}</span>
              </div>
            ))}
          </div>

          {/* Drop zone + upload button */}
          <div
            onDragOver={e => { e.preventDefault(); setDrag(true) }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files?.[0]) }}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg px-3 py-4 text-center cursor-pointer transition-colors
              ${drag
                ? 'border-forest bg-green-50'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
          >
            {isLoading
              ? <p className="text-xs text-gray-400">Parsing...</p>
              : <>
                  <Upload size={16} className="text-gray-300 mx-auto mb-1.5" />
                  <p className="text-xs text-gray-400">Drop CSV or click to browse</p>
                </>
            }
          </div>

          {error && (
            <div className="mt-2 flex items-start gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2.5 py-2">
              <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={e => { handle(e.target.files?.[0]); e.target.value = '' }}
      />
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SFUpload({ sfData, onUpload, onClear }) {
  const [parsing, setParsing] = useState(null)   // 'internal' | 'gsc' | 'ga4' | null
  const [errors,  setErrors]  = useState({})     // { internal, gsc, ga4 }

  // sfData shape:
  //   root level = internal crawl/SF data (totalPages, broken4xx, etc.)
  //   sfData.gsc = GSC data
  //   sfData.ga4 = GA4 data
  //   sfData.source = 'screaming-frog' | 'internal-crawler'
  const hasInternal = !!(sfData?.totalPages)
  const hasGSC      = !!(sfData?.gsc?.totalUrls ?? sfData?.gsc?.totalClicks != null ? sfData?.gsc : null)
  const hasGA4      = !!(sfData?.ga4)

  // Simpler presence check
  const internalLoaded = !!(sfData?.totalPages)
  const gscLoaded      = !!(sfData?.gsc)
  const ga4Loaded      = !!(sfData?.ga4)

  function handleFile(file, errorOverride) {
    if (errorOverride === 'not-csv') {
      setErrors(prev => ({ ...prev, _: 'Please upload a .csv file.' }))
      return
    }
    if (!file) return

    setErrors({})

    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target.result
      try {
        const type = detectSFExportType(text)

        if (type === 'internal') {
          const result = parseSFCrawl(text, file.name)
          onUpload(result, 'internal')
          setParsing(null)
        } else if (type === 'gsc') {
          const result = parseSFSearchConsole(text, file.name)
          onUpload(result, 'gsc')
          setParsing(null)
        } else if (type === 'ga4') {
          const result = parseSFAnalytics(text, file.name)
          onUpload(result, 'ga4')
          setParsing(null)
        } else {
          throw new Error(
            "Couldn't identify this export. Check you're uploading an SF Internal, " +
            "Search Console, or Analytics (GA4) CSV."
          )
        }
      } catch (err) {
        setErrors({ _: err.message })
        setParsing(null)
      }
    }
    reader.onerror = () => { setErrors({ _: 'Failed to read file.' }); setParsing(null) }

    // Guess type from filename to show the right panel as loading
    const lower = file.name.toLowerCase()
    if (lower.includes('gsc') || lower.includes('search_console') || lower.includes('search-console')) {
      setParsing('gsc')
    } else if (lower.includes('ga4') || lower.includes('analytics')) {
      setParsing('ga4')
    } else {
      setParsing('internal')
    }

    reader.readAsText(file, 'utf-8')
  }

  return (
    <div className="card">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-gray-800">Data Uploads</h2>
        <p className="text-xs text-gray-400 mt-0.5">
          Upload your exports — auto-detected by column headers. Use any panel to upload any type.
        </p>
      </div>

      {/* Global error (wrong file type, parse failure) */}
      {errors._ && (
        <div className="mb-3 flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
          {errors._}
        </div>
      )}

      {/* Three panels */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <UploadPanel
          type="internal"
          isLoaded={internalLoaded}
          isLoading={parsing === 'internal'}
          error={errors.internal}
          data={internalLoaded ? sfData : null}
          gscData={null}
          ga4Data={null}
          onFile={handleFile}
          onClear={onClear}
        />
        <UploadPanel
          type="gsc"
          isLoaded={gscLoaded}
          isLoading={parsing === 'gsc'}
          error={errors.gsc}
          data={null}
          gscData={gscLoaded ? sfData.gsc : null}
          ga4Data={null}
          onFile={handleFile}
          onClear={onClear}
        />
        <UploadPanel
          type="ga4"
          isLoaded={ga4Loaded}
          isLoading={parsing === 'ga4'}
          error={errors.ga4}
          data={null}
          gscData={null}
          ga4Data={ga4Loaded ? sfData.ga4 : null}
          onFile={handleFile}
          onClear={onClear}
        />
      </div>

      {/* All loaded confirmation */}
      {internalLoaded && gscLoaded && ga4Loaded && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
          <CheckCircle size={13} />
          All three data sources loaded — checklist auto-population is fully active.
        </div>
      )}
    </div>
  )
}
