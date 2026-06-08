import { useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft, ChevronDown, ChevronUp, RefreshCw, Download,
  Check, X, Minus, LogOut, AlertTriangle, Loader2,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import {
  AUDIT_SECTIONS, ALL_ITEMS, severityClasses, computeAutoStatus,
} from '../lib/auditSections'
import SFUpload from '../components/SFUpload'
import CrawlManager from '../components/CrawlManager'

// null → pass → fail → na → null
const STATUS_CYCLE = [null, 'pass', 'fail', 'na']
function nextStatus(current) {
  const i = STATUS_CYCLE.indexOf(current ?? null)
  return STATUS_CYCLE[(i + 1) % STATUS_CYCLE.length]
}

function StatusIcon({ status, isAuto }) {
  if (status === 'pass') return <Check size={13} className="text-green-600" />
  if (status === 'fail') return <X size={13} className="text-red-500" />
  if (status === 'na') return <Minus size={13} className="text-gray-400" />
  return (
    <span className={`inline-block w-3 h-3 rounded-full border-2 ${isAuto ? 'border-blue-300' : 'border-gray-300'}`} />
  )
}

function SeverityPill({ severity }) {
  const map = {
    critical: 'bg-red-100 text-red-700 border-red-200',
    high: 'bg-orange-100 text-orange-700 border-orange-200',
    medium: 'bg-amber-100 text-amber-700 border-amber-200',
    low: 'bg-gray-100 text-gray-500 border-gray-200',
  }
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${map[severity] ?? map.low}`}>
      {severity}
    </span>
  )
}

function computeStats(sections, technicalData, sfData) {
  let pass = 0, fail = 0, na = 0, todo = 0
  let critFail = 0, highFail = 0

  ALL_ITEMS.forEach(item => {
    const sec = AUDIT_SECTIONS.find(s => s.items.some(i => i.id === item.id))
    if (!sec) return
    const autoStatus = computeAutoStatus(item, technicalData, sfData)
    const rawStatus = sections[sec.id]?.[item.id] ?? null
    const status = rawStatus ?? autoStatus

    if (status === 'pass') {
      pass++
    } else if (status === 'fail') {
      fail++
      if (item.severity === 'critical') critFail++
      if (item.severity === 'high') highFail++
    } else if (status === 'na') {
      na++
    } else {
      todo++
    }
  })

  const evaluated = pass + fail
  const pct = evaluated > 0 ? Math.round((pass / evaluated) * 100) : null
  return { pass, fail, na, todo, pct, critFail, highFail, total: ALL_ITEMS.length }
}

export default function AuditDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, signOut } = useAuth()

  const [sections, setSections] = useState({})
  const [technicalData, setTechnicalData] = useState(null)
  const [sfData, setSfData] = useState(null)
  const [notes, setNotes] = useState('')
  const [auditMeta, setAuditMeta] = useState(null)
  const [saving, setSaving] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState('')
  const [openSections, setOpenSections] = useState(() =>
    Object.fromEntries(AUDIT_SECTIONS.map((s, i) => [s.id, i === 0]))
  )

  const saveTimer = useRef(null)

  const { isLoading, error: loadError } = useQuery({
    queryKey: ['audit', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('site_audits')
        .select('*')
        .eq('id', id)
        .eq('user_id', user.id)
        .single()
      if (error) throw error
      setSections(data.sections ?? {})
      setTechnicalData(data.technical_data ?? null)
      setSfData(data.sf_data ?? null)
      setNotes(data.notes ?? '')
      setAuditMeta({
        id: data.id,
        domain: data.domain,
        name: data.name,
        created_at: data.created_at,
      })
      return data
    },
  })

  const scheduleSave = useCallback((nextSections, nextNotes) => {
    clearTimeout(saveTimer.current)
    setSaving(true)
    saveTimer.current = setTimeout(async () => {
      await supabase
        .from('site_audits')
        .update({ sections: nextSections, notes: nextNotes, updated_at: new Date().toISOString() })
        .eq('id', id)
      setSaving(false)
    }, 600)
  }, [id])

  function toggleItem(sectionId, itemId, autoStatus) {
    setSections(prev => {
      const sectionData = prev[sectionId] ?? {}
      const current = sectionData[itemId] ?? null
      const resolvedCurrent = current ?? autoStatus ?? null
      const next = nextStatus(resolvedCurrent)
      const updated = { ...prev, [sectionId]: { ...sectionData, [itemId]: next } }
      scheduleSave(updated, notes)
      return updated
    })
  }

  function toggleSection(secId) {
    setOpenSections(prev => ({ ...prev, [secId]: !prev[secId] }))
  }

  function expandAll() {
    setOpenSections(Object.fromEntries(AUDIT_SECTIONS.map(s => [s.id, true])))
  }
  function collapseAll() {
    setOpenSections(Object.fromEntries(AUDIT_SECTIONS.map(s => [s.id, false])))
  }

  async function handleSFUpload(data, type) {
    setSfData(prev => {
      let next
      if (type === 'internal') {
        // Internal data lives at the root (for sfAutoKey compatibility); preserve gsc/ga4
        next = { ...(prev?.gsc ? { gsc: prev.gsc } : {}), ...(prev?.ga4 ? { ga4: prev.ga4 } : {}), ...data }
      } else {
        // GSC and GA4 live under their own key
        next = { ...(prev ?? {}), [type]: data }
      }
      supabase.from('site_audits')
        .update({ sf_data: next, updated_at: new Date().toISOString() })
        .eq('id', id)
      return next
    })
  }

  async function handleSFClear(type) {
    setSfData(prev => {
      if (!prev) return null
      let next
      if (type === 'internal') {
        // Remove root-level internal fields, keep gsc/ga4
        next = {}
        if (prev.gsc) next.gsc = prev.gsc
        if (prev.ga4) next.ga4 = prev.ga4
      } else {
        next = { ...prev }
        delete next[type]
      }
      const val = Object.keys(next).length ? next : null
      supabase.from('site_audits')
        .update({ sf_data: val, updated_at: new Date().toISOString() })
        .eq('id', id)
      return val
    })
  }

  function handleCrawlComplete(summary) {
    handleSFUpload(summary, 'internal')
  }

  function handleClearCrawl() {
    handleSFClear('internal')
  }

  async function runScan() {
    if (!auditMeta?.domain) return
    setScanning(true)
    setScanError('')
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: auditMeta.domain }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Scan failed')
      setTechnicalData(data)
      await supabase
        .from('site_audits')
        .update({ technical_data: data, updated_at: new Date().toISOString() })
        .eq('id', id)
    } catch (err) {
      setScanError(err.message)
    } finally {
      setScanning(false)
    }
  }

  function exportCSV() {
    const rows = [['Section', 'Item', 'Severity', 'Status', 'Auto-Checked']]
    AUDIT_SECTIONS.forEach(section => {
      section.items.forEach(item => {
        const autoStatus = item.automated ? computeAutoStatus(item, technicalData) : null
        const rawStatus = sections[section.id]?.[item.id] ?? null
        const status = rawStatus ?? autoStatus ?? ''
        rows.push([section.title, item.label, item.severity, status, (item.automated || item.sfAutoKey) ? 'yes' : 'no'])
      })
    })
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `seo-audit-${auditMeta?.domain ?? id}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen gap-2 text-gray-400 text-sm">
        <Loader2 size={16} className="animate-spin" /> Loading audit...
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-3">
        <AlertTriangle size={24} className="text-red-400" />
        <p className="text-sm text-gray-600">Failed to load audit.</p>
        <button onClick={() => navigate('/')} className="btn-secondary text-xs">Back to audits</button>
      </div>
    )
  }

  const stats = computeStats(sections, technicalData, sfData)
  // Crawl data is stored in sfData when source is the built-in crawler
  const crawlData = sfData?.source === 'internal-crawler' ? sfData : null

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky header */}
      <header className="bg-white border-b border-gray-100 px-4 sm:px-6 py-3 flex items-center gap-3 sticky top-0 z-10 shadow-sm">
        <button
          onClick={() => navigate('/')}
          className="btn-ghost flex items-center gap-1.5 text-xs -ml-1 flex-shrink-0"
        >
          <ArrowLeft size={13} /> Audits
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-forest-dark text-sm truncate">
            {auditMeta?.name || auditMeta?.domain}
          </h1>
          {auditMeta?.name && auditMeta.name !== auditMeta.domain && (
            <p className="text-xs text-gray-400 truncate">{auditMeta.domain}</p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {saving && <span className="text-xs text-gray-400 hidden sm:inline">Saving...</span>}
          <button onClick={exportCSV} className="btn-secondary flex items-center gap-1.5 text-xs">
            <Download size={13} /> Export
          </button>
          <button onClick={signOut} className="btn-ghost p-2" title="Sign out">
            <LogOut size={14} />
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-4">

        {/* Summary card */}
        <div className="card">
          <div className="flex flex-wrap items-center gap-5">
            {/* Donut */}
            <div className="flex items-center gap-3">
              <div className="relative w-14 h-14 flex-shrink-0">
                <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#F3F4F6" strokeWidth="3.5" />
                  {stats.pct !== null && (
                    <circle
                      cx="18" cy="18" r="15.9" fill="none"
                      stroke={stats.pct >= 80 ? '#2E7D4F' : stats.pct >= 60 ? '#D97706' : '#EF4444'}
                      strokeWidth="3.5"
                      strokeDasharray={`${stats.pct} ${100 - stats.pct}`}
                      strokeLinecap="round"
                    />
                  )}
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-700">
                  {stats.pct !== null ? `${stats.pct}%` : '--'}
                </span>
              </div>
              <div>
                <p className="text-xs text-gray-400 leading-tight">Pass rate</p>
                <p className="text-sm font-semibold text-gray-800 mt-0.5">
                  {stats.pass}/{stats.pass + stats.fail} evaluated
                </p>
              </div>
            </div>

            {/* Counts */}
            <div className="flex gap-4 text-sm flex-wrap">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <span className="text-gray-600 font-medium">{stats.pass}</span>
                <span className="text-gray-400">pass</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-400" />
                <span className="text-gray-600 font-medium">{stats.fail}</span>
                <span className="text-gray-400">fail</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-gray-300" />
                <span className="text-gray-600 font-medium">{stats.na}</span>
                <span className="text-gray-400">N/A</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full border-2 border-gray-300" />
                <span className="text-gray-400 font-medium">{stats.todo}</span>
                <span className="text-gray-300">to-do</span>
              </span>
            </div>

            {/* Critical/High badges */}
            <div className="flex gap-2 ml-auto flex-wrap">
              {stats.critFail > 0 && (
                <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full whitespace-nowrap">
                  {stats.critFail} critical
                </span>
              )}
              {stats.highFail > 0 && (
                <span className="text-xs font-semibold text-orange-600 bg-orange-50 border border-orange-200 px-2.5 py-1 rounded-full whitespace-nowrap">
                  {stats.highFail} high
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Technical scan card */}
        <div className="card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Technical Scan</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Robots.txt, sitemap, HTTPS redirects, and PageSpeed Insights
              </p>
            </div>
            <button
              onClick={runScan}
              disabled={scanning}
              className="btn-secondary flex items-center gap-1.5 text-xs flex-shrink-0"
            >
              {scanning
                ? <><Loader2 size={12} className="animate-spin" /> Scanning...</>
                : <><RefreshCw size={12} /> {technicalData ? 'Re-scan' : 'Run Scan'}</>
              }
            </button>
          </div>
          {scanError && (
            <p className="text-sm text-red-600 mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {scanError}
            </p>
          )}
          {technicalData && <TechnicalResults data={technicalData} />}
        </div>

        {/* Site Crawl */}
        <CrawlManager
          domain={auditMeta?.domain}
          crawlData={crawlData}
          onCrawlComplete={handleCrawlComplete}
          onClearCrawl={handleClearCrawl}
        />

        {/* Screaming Frog upload (GSC + GA4 enrichment) */}
        <SFUpload sfData={sfData} onUpload={handleSFUpload} onClear={handleSFClear} />

        {/* Notes */}
        <div className="card">
          <label className="label">Audit Notes</label>
          <textarea
            className="input resize-none text-sm"
            rows={3}
            placeholder="Add context, findings, or recommendations..."
            value={notes}
            onChange={e => {
              setNotes(e.target.value)
              scheduleSave(sections, e.target.value)
            }}
          />
        </div>

        {/* Section controls */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">Click any item to cycle: unchecked &rarr; pass &rarr; fail &rarr; N/A</p>
          <div className="flex gap-2">
            <button onClick={expandAll} className="btn-ghost text-xs py-1">Expand all</button>
            <button onClick={collapseAll} className="btn-ghost text-xs py-1">Collapse all</button>
          </div>
        </div>

        {/* Checklist */}
        <div className="space-y-2">
          {AUDIT_SECTIONS.map(section => (
            <SectionAccordion
              key={section.id}
              section={section}
              sectionData={sections[section.id] ?? {}}
              technicalData={technicalData}
              sfData={sfData}
              isOpen={openSections[section.id] ?? false}
              onToggle={() => toggleSection(section.id)}
              onToggleItem={(itemId, autoStatus) => toggleItem(section.id, itemId, autoStatus)}
            />
          ))}
        </div>

        <p className="text-xs text-center text-gray-300 pb-8">
          Created {auditMeta?.created_at ? new Date(auditMeta.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : ''}
        </p>
      </main>
    </div>
  )
}

function SectionAccordion({ section, sectionData, technicalData, sfData, isOpen, onToggle, onToggleItem }) {
  const sectionStats = section.items.reduce((acc, item) => {
    const autoStatus = computeAutoStatus(item, technicalData, sfData)
    const status = sectionData[item.id] ?? autoStatus
    if (status === 'pass') acc.pass++
    else if (status === 'fail') acc.fail++
    return acc
  }, { pass: 0, fail: 0 })

  return (
    <div className="card !p-0 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-sm text-gray-900">{section.title}</span>
          <span className="text-xs text-gray-400 ml-2">{section.items.length} items</span>
        </div>
        <div className="flex items-center gap-3 text-xs flex-shrink-0">
          {sectionStats.fail > 0 && (
            <span className="text-red-500 font-semibold">{sectionStats.fail} fail</span>
          )}
          {sectionStats.pass > 0 && (
            <span className="text-green-600 font-semibold">{sectionStats.pass} pass</span>
          )}
          {isOpen
            ? <ChevronUp size={14} className="text-gray-400" />
            : <ChevronDown size={14} className="text-gray-400" />
          }
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-gray-100">
          {section.items.map((item, idx) => {
            const autoStatus = computeAutoStatus(item, technicalData, sfData)
            const rawStatus = sectionData[item.id] ?? null
            const effectiveStatus = rawStatus ?? autoStatus
            const isAutoSourced = (item.automated || item.sfAutoKey) && rawStatus === null && autoStatus !== null
            const isOverridden = (item.automated || item.sfAutoKey) && rawStatus !== null
            const autoLabel = item.sfAutoKey && !item.automated ? 'sf' : 'auto'

            return (
              <div
                key={item.id}
                onClick={() => onToggleItem(item.id, autoStatus)}
                className={`
                  flex items-center gap-3 px-5 py-2.5 cursor-pointer
                  hover:bg-gray-50 transition-colors select-none
                  ${idx > 0 ? 'border-t border-gray-50' : ''}
                  ${effectiveStatus === 'fail' ? 'bg-red-50/30 hover:bg-red-50/50' : ''}
                `}
              >
                <div className="w-5 h-5 flex items-center justify-center flex-shrink-0">
                  <StatusIcon
                    status={effectiveStatus}
                    isAuto={isAutoSourced}
                  />
                </div>

                <span className={`flex-1 text-sm leading-snug ${
                  effectiveStatus === 'na'
                    ? 'text-gray-300 line-through'
                    : effectiveStatus === 'pass'
                    ? 'text-gray-500'
                    : 'text-gray-800'
                }`}>
                  {item.label}
                </span>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {isAutoSourced && (
                    <span className="text-xs text-blue-400 font-medium">{autoLabel}</span>
                  )}
                  {isOverridden && (
                    <span className="text-xs text-amber-500 font-medium">override</span>
                  )}
                  <SeverityPill severity={item.severity} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* Technical results display */

function TechnicalResults({ data }) {
  const scannedAt = data.scannedAt
    ? new Date(data.scannedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : null

  return (
    <div className="mt-4 space-y-3">
      {scannedAt && (
        <p className="text-xs text-gray-400">Last scanned: {scannedAt}</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {data.robots && (
          <ResultBlock title="Robots.txt" items={[
            result('File exists', data.robots.exists),
            result('Sitemap directive', data.robots.hasSitemap),
            result('Site not fully blocked', !data.robots.siteBlocked),
            data.robots.crawlDelay ? info(`Crawl-delay: ${data.robots.crawlDelay}s`) : null,
          ]} />
        )}

        {data.sitemap && (
          <ResultBlock title="Sitemap" items={[
            result('Sitemap found', data.sitemap.exists),
            data.sitemap.exists && data.sitemap.isIndex ? info('Sitemap index') : null,
            data.sitemap.exists && !data.sitemap.isIndex && data.sitemap.urlCount != null
              ? info(`${data.sitemap.urlCount} URLs indexed`) : null,
          ]} />
        )}

        {data.https && (
          <ResultBlock title="HTTPS / Redirects" items={[
            result('HTTP redirects to HTTPS', data.https.httpRedirects),
            result('Canonical domain consistent', data.https.wwwConsistent),
            data.https.hsts ? info('HSTS enabled') : null,
          ]} />
        )}

        {data.pagespeed && (
          <ResultBlock title="PageSpeed" items={[
            data.pagespeed.mobile ? scoreResult('Mobile', data.pagespeed.mobile.score) : null,
            data.pagespeed.desktop ? scoreResult('Desktop', data.pagespeed.desktop.score) : null,
            data.pagespeed.mobile?.lcp ? lcpResult(data.pagespeed.mobile.lcp) : null,
            data.pagespeed.mobile?.cls ? clsResult(data.pagespeed.mobile.cls) : null,
            data.pagespeed.mobile?.fcp ? info(`FCP: ${data.pagespeed.mobile.fcp}`) : null,
            data.pagespeed.mobile?.tbt ? info(`TBT: ${data.pagespeed.mobile.tbt}`) : null,
          ]} />
        )}
      </div>
    </div>
  )
}

function result(label, pass) {
  return { label, status: pass ? 'pass' : 'fail' }
}
function info(label) {
  return { label, status: 'info' }
}
function scoreResult(label, score) {
  if (score == null) return info(`${label}: N/A`)
  const status = score >= 90 ? 'pass' : score >= 50 ? 'warn' : 'fail'
  return { label: `${label}: ${score}/100`, status }
}
function lcpResult(lcp) {
  const ms = parseFloat(lcp)
  const status = isNaN(ms) ? 'info' : ms <= 2500 ? 'pass' : ms <= 4000 ? 'warn' : 'fail'
  return { label: `LCP: ${lcp}`, status }
}
function clsResult(cls) {
  const n = parseFloat(cls)
  const status = isNaN(n) ? 'info' : n <= 0.1 ? 'pass' : n <= 0.25 ? 'warn' : 'fail'
  return { label: `CLS: ${cls}`, status }
}

function ResultBlock({ title, items }) {
  const filtered = items.filter(Boolean)
  const cls = {
    pass: 'bg-green-50 text-green-700 border-green-200',
    fail: 'bg-red-50 text-red-600 border-red-200',
    warn: 'bg-amber-50 text-amber-700 border-amber-200',
    info: 'bg-gray-100 text-gray-600 border-gray-200',
  }
  return (
    <div className="bg-gray-50 rounded-xl px-3.5 py-3">
      <p className="text-xs font-semibold text-gray-500 mb-2">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {filtered.map((item, i) => (
          <span key={i} className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cls[item.status] ?? cls.info}`}>
            {item.status === 'pass' ? '✓ ' : item.status === 'fail' ? '✗ ' : ''}{item.label}
          </span>
        ))}
      </div>
    </div>
  )
}
