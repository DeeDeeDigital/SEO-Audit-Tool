import { useRef, useState } from 'react'
import { Upload, FileText, X, CheckCircle, AlertCircle } from 'lucide-react'
import { parseSFCrawl } from '../lib/parseSFCrawl'

// Metric chip: green if value is 0, red if > 0, gray if null
function MetricChip({ label, value, warnIfNonZero = true, infoOnly = false }) {
  if (value === null || value === undefined) return null
  let cls = 'bg-gray-100 text-gray-600 border-gray-200'
  if (!infoOnly) {
    cls = warnIfNonZero
      ? (value === 0 ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-600 border-red-200')
      : 'bg-gray-100 text-gray-600 border-gray-200'
  }
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${cls}`}>
      {!infoOnly && warnIfNonZero && (value === 0
        ? <span className="text-green-600">✓</span>
        : <span className="text-red-500">✗</span>
      )}
      {label}: {value.toLocaleString()}
    </span>
  )
}

export default function SFUpload({ sfData, onUpload, onClear }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [error, setError] = useState('')

  function handleFile(file) {
    if (!file) return
    if (!file.name.endsWith('.csv')) {
      setError('Please upload a CSV file exported from Screaming Frog.')
      return
    }
    setError('')
    setParsing(true)

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const result = parseSFCrawl(e.target.result, file.name)
        onUpload(result)
      } catch (err) {
        setError(err.message)
      } finally {
        setParsing(false)
      }
    }
    reader.onerror = () => {
      setError('Failed to read file.')
      setParsing(false)
    }
    reader.readAsText(file, 'utf-8')
  }

  function onInputChange(e) {
    handleFile(e.target.files?.[0])
    e.target.value = '' // reset so same file can be re-uploaded
  }

  function onDrop(e) {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files?.[0])
  }

  const uploadedAt = sfData?.uploadedAt
    ? new Date(sfData.uploadedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : null

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-800">Screaming Frog Crawl</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Upload the Internal tab CSV export to auto-populate on-page checklist items
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {sfData && (
            <button
              onClick={onClear}
              className="btn-ghost flex items-center gap-1 text-xs text-gray-400 hover:text-red-500"
              title="Clear crawl data"
            >
              <X size={12} /> Clear
            </button>
          )}
          <button
            onClick={() => inputRef.current?.click()}
            disabled={parsing}
            className="btn-secondary flex items-center gap-1.5 text-xs flex-shrink-0"
          >
            <Upload size={12} />
            {parsing ? 'Parsing...' : sfData ? 'Re-upload' : 'Upload CSV'}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={onInputChange}
          />
        </div>
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {!sfData && !parsing && (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`
            mt-4 border-2 border-dashed rounded-xl px-6 py-8 text-center cursor-pointer transition-colors
            ${dragging ? 'border-forest bg-green-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}
          `}
        >
          <FileText size={24} className="text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">
            Drag &amp; drop your Screaming Frog CSV here, or click to browse
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Bulk Export &rarr; All Internal URLs from the Internal tab
          </p>
        </div>
      )}

      {parsing && (
        <div className="mt-4 text-center py-6 text-sm text-gray-400">
          Parsing crawl data...
        </div>
      )}

      {sfData && !parsing && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <CheckCircle size={13} className="text-green-500" />
            <span className="font-medium truncate">{sfData.filename}</span>
            {uploadedAt && <span className="text-gray-400">— uploaded {uploadedAt}</span>}
          </div>

          {/* Page counts */}
          <div className="bg-gray-50 rounded-xl px-3.5 py-3">
            <p className="text-xs font-semibold text-gray-500 mb-2">Crawl Summary</p>
            <div className="flex flex-wrap gap-1.5">
              <MetricChip label="Total pages" value={sfData.totalPages} infoOnly />
              <MetricChip label="HTML pages" value={sfData.htmlPages} infoOnly />
              {sfData.noindexPages > 0 && (
                <MetricChip label="Non-indexable" value={sfData.noindexPages} infoOnly />
              )}
              {sfData.maxCrawlDepth > 0 && (
                <MetricChip label="Max depth" value={sfData.maxCrawlDepth} infoOnly />
              )}
            </div>
          </div>

          {/* Issues */}
          <div className="bg-gray-50 rounded-xl px-3.5 py-3">
            <p className="text-xs font-semibold text-gray-500 mb-2">Issues Found</p>
            <div className="flex flex-wrap gap-1.5">
              <MetricChip label="Broken (4xx)" value={sfData.broken4xx} />
              <MetricChip label="Missing title" value={sfData.missingTitle} />
              <MetricChip label="Duplicate titles" value={sfData.duplicateTitles} />
              <MetricChip label="Title too long" value={sfData.titleTooLong} />
              <MetricChip label="Missing meta" value={sfData.missingMeta} />
              <MetricChip label="Meta too long" value={sfData.metaTooLong} />
              <MetricChip label="Missing H1" value={sfData.missingH1} />
              <MetricChip label="Multiple H1s" value={sfData.multipleH1} />
              <MetricChip label="Thin pages (<300 words)" value={sfData.thinPages} />
              <MetricChip label="Depth > 3 clicks" value={sfData.pagesDeepThan3} />
              <MetricChip label="Missing canonical" value={sfData.missingCanonical} />
              <MetricChip label="URL structure issues" value={sfData.urlStructureIssues} />
            </div>
          </div>

          <p className="text-xs text-gray-400">
            Auto-populated: broken links, title tags, meta descriptions, H1s, crawl depth, canonicals, URL structure
          </p>
        </div>
      )}
    </div>
  )
}
