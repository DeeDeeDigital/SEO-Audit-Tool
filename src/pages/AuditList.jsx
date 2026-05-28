import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, LogOut, ClipboardList, ChevronRight, Trash2, AlertCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

async function fetchAudits(userId) {
  const { data, error } = await supabase
    .from('site_audits')
    .select('id, domain, name, created_at, updated_at, sections')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return data
}

function passPercent(sections) {
  if (!sections) return null
  const vals = Object.values(sections).flatMap(s => Object.values(s))
  const evaluated = vals.filter(v => v !== null)
  if (!evaluated.length) return null
  const pass = evaluated.filter(v => v === 'pass').length
  return Math.round((pass / evaluated.length) * 100)
}

function PercentBar({ pct }) {
  if (pct === null) return <span className="text-xs text-gray-300">no data</span>
  const color = pct >= 80 ? 'bg-forest' : pct >= 60 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-semibold w-8 text-right ${pct >= 80 ? 'text-forest' : pct >= 60 ? 'text-amber-600' : 'text-red-500'}`}>
        {pct}%
      </span>
    </div>
  )
}

export default function AuditList() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [newDomain, setNewDomain] = useState('')
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const { data: audits, isLoading, error } = useQuery({
    queryKey: ['audits', user.id],
    queryFn: () => fetchAudits(user.id),
  })

  async function createAudit() {
    const raw = newDomain.trim()
    if (!raw) return
    setCreating(true)
    setCreateError('')
    const domain = raw.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase()
    const name = newName.trim() || domain
    const { data, error } = await supabase
      .from('site_audits')
      .insert({ user_id: user.id, domain, name, sections: {} })
      .select('id')
      .single()
    setCreating(false)
    if (error) { setCreateError(error.message); return }
    qc.invalidateQueries({ queryKey: ['audits', user.id] })
    closeModal()
    navigate(`/audit/${data.id}`)
  }

  async function deleteAudit(e, id) {
    e.stopPropagation()
    if (!confirm('Delete this audit? This cannot be undone.')) return
    await supabase.from('site_audits').delete().eq('id', id).eq('user_id', user.id)
    qc.invalidateQueries({ queryKey: ['audits', user.id] })
  }

  function closeModal() {
    setShowModal(false)
    setNewDomain('')
    setNewName('')
    setCreateError('')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-2">
          <ClipboardList size={18} className="text-forest" />
          <span className="font-bold text-forest-dark text-sm">SEO Audit Tool</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">{user.email}</span>
          <button onClick={signOut} className="btn-ghost flex items-center gap-1.5 text-xs">
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="page-title">Site Audits</h1>
            <p className="page-subtitle">
              {isLoading ? 'Loading...' : `${audits?.length ?? 0} audit${audits?.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
            <Plus size={15} /> New Audit
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
            <AlertCircle size={16} /> Failed to load audits.
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-16 text-sm text-gray-400">Loading audits...</div>
        ) : audits?.length === 0 ? (
          <div className="card text-center py-16">
            <ClipboardList size={36} className="text-gray-200 mx-auto mb-3" />
            <p className="font-semibold text-gray-600">No audits yet</p>
            <p className="text-sm text-gray-400 mt-1">Click "New Audit" to get started.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {audits.map(audit => {
              const pct = passPercent(audit.sections)
              return (
                <div
                  key={audit.id}
                  onClick={() => navigate(`/audit/${audit.id}`)}
                  className="card flex items-center gap-4 cursor-pointer hover:border-forest/30 hover:shadow-md transition-all group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{audit.name || audit.domain}</p>
                    {audit.name && audit.name !== audit.domain && (
                      <p className="text-xs text-gray-400 truncate mt-0.5">{audit.domain}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      Updated {new Date(audit.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  <PercentBar pct={pct} />
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={e => deleteAudit(e, audit.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                    <ChevronRight size={15} className="text-gray-300" />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="card w-full max-w-sm shadow-xl">
            <h2 className="font-bold text-gray-900 mb-4">New Audit</h2>
            <div className="space-y-3">
              <div>
                <label className="label">
                  Domain <span className="text-red-400">*</span>
                </label>
                <input
                  className="input"
                  placeholder="example.com"
                  value={newDomain}
                  onChange={e => setNewDomain(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && createAudit()}
                  autoFocus
                />
                <p className="text-xs text-gray-400 mt-1">https:// will be stripped automatically</p>
              </div>
              <div>
                <label className="label">
                  Audit name <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  className="input"
                  placeholder="e.g. Q3 2026 Full Audit"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && createAudit()}
                />
              </div>
              {createError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {createError}
                </p>
              )}
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={closeModal} className="btn-secondary flex-1">Cancel</button>
              <button
                onClick={createAudit}
                disabled={creating || !newDomain.trim()}
                className="btn-primary flex-1"
              >
                {creating ? 'Creating...' : 'Create Audit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
