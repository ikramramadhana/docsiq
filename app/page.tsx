'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  chunks?: { source: string; text: string; score: number }[]
  error?: boolean
}

interface DocStats {
  totalChunks: number
  sources: string[]
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [stats, setStats] = useState<DocStats>({ totalChunks: 0, sources: [] })
  const [dragOver, setDragOver] = useState(false)
  const [showSources, setShowSources] = useState<number | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const mobileFileRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const fetchStats = useCallback(async () => {
    const r = await fetch('/api/stats')
    setStats(await r.json())
  }, [])

  useEffect(() => { fetchStats() }, [fetchStats])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    const fd = new FormData()
    Array.from(files).forEach(f => fd.append('files', f))
    try {
      const r = await fetch('/api/upload', { method: 'POST', body: fd })
      const data = await r.json()
      await fetchStats()
      const ok = data.results?.filter((x: { status: string }) => x.status === 'ok') ?? []
      const fail = data.results?.filter((x: { status: string }) => x.status === 'error') ?? []
      let msg = ''
      if (ok.length > 0) msg += `Berhasil upload ${ok.length} dokumen:\n${ok.map((x: { name: string; chunks: number }) => `• **${x.name}** — ${x.chunks} chunks`).join('\n')}\n\nSekarang kamu bisa mulai bertanya!`
      if (fail.length > 0) { if (msg) msg += '\n\n'; msg += `Gagal:\n${fail.map((x: { name: string; message: string }) => `• **${x.name}**: ${x.message}`).join('\n')}` }
      if (!msg) msg = 'Tidak ada file yang berhasil diproses.'
      setMessages(prev => [...prev, { role: 'assistant', content: msg }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Upload error.', error: true }])
    }
    setUploading(false)
  }

  async function sendMessage() {
    const q = input.trim()
    if (!q || loading) return
    setInput('')
    const history = messages.map(m => ({ role: m.role, content: m.content }))
    setMessages(prev => [...prev, { role: 'user', content: q }])
    setLoading(true)
    try {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: q, history }),
      })
      const data = await r.json()
      if (data.error) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.error, error: true }])
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: data.answer, chunks: data.chunks }])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Terjadi error.', error: true }])
    }
    setLoading(false)
    inputRef.current?.focus()
  }

  function formatContent(text: string) {
    return text.split('\n').map((line, i) => {
      const html = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      return <p key={i} dangerouslySetInnerHTML={{ __html: html }} className="mb-1 last:mb-0" />
    })
  }

  const suggestions = ['Apa isi dokumen ini?', 'Ringkas poin utama', 'Jelaskan konsep penting']

  return (
    <div className="h-screen bg-[#07070d] text-white flex flex-col overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* Ambient blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-48 -left-48 w-[500px] h-[500px] rounded-full opacity-[0.15]" style={{ background: 'radial-gradient(circle, #6d28d9, transparent 65%)' }} />
        <div className="absolute top-1/2 -right-48 w-96 h-96 rounded-full opacity-[0.08]" style={{ background: 'radial-gradient(circle, #4338ca, transparent 65%)' }} />
        <div className="absolute -bottom-32 left-1/2 w-80 h-80 rounded-full opacity-[0.08]" style={{ background: 'radial-gradient(circle, #7c3aed, transparent 65%)' }} />
      </div>

      {/* Navbar */}
      <header className="relative z-10 flex items-center justify-between px-5 py-3 border-b" style={{ background: 'rgba(7,7,13,0.85)', backdropFilter: 'blur(24px)', borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => setSidebarOpen(v => !v)} className="p-1.5 rounded-lg transition-colors text-zinc-500 hover:text-white hover:bg-white/5">
            <svg width="17" height="17" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>

          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6d28d9 0%, #4338ca 100%)', boxShadow: '0 0 16px rgba(109,40,217,0.4)' }}>
              <svg width="15" height="15" fill="none" stroke="white" strokeWidth="2.2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            </div>
            <div className="leading-tight">
              <p className="font-bold text-sm tracking-tight">DocsIQ</p>
              <p className="text-[10px] text-zinc-600">Powered by Groq · LLaMA 3.1</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {stats.totalChunks > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full" style={{ background: 'rgba(109,40,217,0.12)', border: '0.5px solid rgba(109,40,217,0.35)', color: '#c4b5fd' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse inline-block" />
              {stats.totalChunks} chunks · {stats.sources.length} dok
            </div>
          )}
          <a href="https://github.com/ikramramadhana" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-300 transition-colors">
            <svg width="14" height="14" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
            @ikramramadhana
          </a>
        </div>
      </header>

      <div className="relative z-10 flex flex-1 overflow-hidden">

        {/* Sidebar */}
        <aside className={`flex-col border-r transition-all duration-300 overflow-hidden ${sidebarOpen ? 'w-72 flex' : 'w-0'}`}
          style={{ background: 'rgba(255,255,255,0.015)', borderColor: 'rgba(255,255,255,0.05)' }}>
          <div className="p-5 flex flex-col gap-6 h-full overflow-y-auto">

            {/* Upload zone */}
            <div>
              <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.1em] mb-3">Upload Dokumen</p>
              <div
                className="relative rounded-2xl p-5 text-center cursor-pointer transition-all duration-200"
                style={{
                  border: `1.5px dashed ${dragOver ? 'rgba(109,40,217,0.8)' : 'rgba(255,255,255,0.08)'}`,
                  background: dragOver ? 'rgba(109,40,217,0.08)' : 'rgba(255,255,255,0.02)',
                }}
                onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files) }}
              >
                {uploading ? (
                  <div className="flex flex-col items-center gap-3 py-2">
                    <div className="w-8 h-8 rounded-full border-2 border-violet-500/30 border-t-violet-500 animate-spin" />
                    <p className="text-xs text-violet-400">Memproses dokumen...</p>
                  </div>
                ) : (
                  <>
                    <div className="w-11 h-11 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: 'rgba(109,40,217,0.12)', border: '0.5px solid rgba(109,40,217,0.2)' }}>
                      <svg width="19" height="19" fill="none" stroke="#a78bfa" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    </div>
                    <p className="text-sm font-medium text-zinc-300">Drop file di sini</p>
                    <p className="text-xs text-zinc-600 mt-1">atau klik untuk memilih</p>
                    <div className="flex gap-1.5 justify-center mt-3">
                      {['PDF', 'TXT', 'MD'].map(t => (
                        <span key={t} className="text-[10px] px-2.5 py-1 rounded-lg font-semibold" style={{ background: 'rgba(255,255,255,0.05)', color: '#52525b', border: '0.5px solid rgba(255,255,255,0.07)' }}>{t}</span>
                      ))}
                    </div>
                  </>
                )}
              </div>
              <input ref={fileRef} type="file" multiple accept=".pdf,.txt,.md" className="hidden" onChange={e => handleUpload(e.target.files)} />
            </div>

            {/* Active docs */}
            {stats.sources.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.1em]">Dokumen Aktif</p>
                  {confirmClear ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-red-400">Yakin?</span>
                      <button onClick={async () => { setDeleting('__all__'); setConfirmClear(false); await fetch('/api/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'clear' }) }); await fetchStats(); setMessages(prev => [...prev, { role: 'assistant', content: 'Semua dokumen telah dihapus.' }]); setDeleting(null) }} className="text-[10px] text-red-400 hover:text-red-300 font-semibold">Ya</button>
                      <button onClick={() => setConfirmClear(false)} className="text-[10px] text-zinc-600 hover:text-zinc-400">Batal</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmClear(true)} className="text-[10px] text-zinc-700 hover:text-red-400 transition-colors flex items-center gap-1">
                      <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                      Clear all
                    </button>
                  )}
                </div>
                <div className="space-y-1.5">
                  {stats.sources.map(s => (
                    <div key={s} className="group flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs transition-all" style={{ background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.06)' }}>
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
                      <span className="text-zinc-400 truncate flex-1">{s}</span>
                      <button
                        onClick={async () => {
                          setDeleting(s)
                          await fetch('/api/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', source: s }) })
                          await fetchStats()
                          setMessages(prev => [...prev, { role: 'assistant', content: `Dokumen **${s}** telah dihapus.` }])
                          setDeleting(null)
                        }}
                        disabled={deleting !== null}
                        className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all disabled:opacity-30"
                        title="Hapus dokumen"
                      >
                        {deleting === s
                          ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                          : <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                        }
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* API key info */}
            <div className="rounded-2xl p-4" style={{ background: 'rgba(109,40,217,0.07)', border: '0.5px solid rgba(109,40,217,0.18)' }}>
              <div className="flex items-center gap-2 mb-2.5">
                <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: 'rgba(109,40,217,0.2)' }}>
                  <svg width="10" height="10" fill="none" stroke="#a78bfa" strokeWidth="2.2" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </div>
                <p className="text-xs font-semibold text-violet-300">Groq API Key</p>
              </div>
              <p className="text-[11px] text-zinc-600 mb-2">Tambahkan ke <code className="text-violet-400 bg-violet-950/40 px-1 py-0.5 rounded-md">.env.local</code></p>
              <code className="text-[11px] text-emerald-400 block rounded-xl px-3 py-2 break-all" style={{ background: 'rgba(0,0,0,0.3)', border: '0.5px solid rgba(255,255,255,0.05)' }}>GROQ_API_KEY=gsk_...</code>
              <a href="https://console.groq.com" target="_blank" className="mt-2.5 text-[11px] text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors w-fit">
                Daftar gratis
                <svg width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              </a>
            </div>

            {/* Credit */}
            <div className="mt-auto pt-2 text-center">
              <p className="text-[10px] text-zinc-700 mb-0.5">Made with ♥ by</p>
              <a href="https://github.com/ikramramadhana" target="_blank" className="text-xs font-semibold text-zinc-500 hover:text-violet-400 transition-colors">@ikramramadhana</a>
            </div>
          </div>
        </aside>

        {/* Chat */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-8 space-y-6">

            {/* Empty state */}
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-6 text-center select-none">
                <div>
                  <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(109,40,217,0.2), rgba(67,56,202,0.2))', border: '1px solid rgba(109,40,217,0.25)', boxShadow: '0 0 40px rgba(109,40,217,0.1)' }}>
                    <svg width="28" height="28" fill="none" stroke="#a78bfa" strokeWidth="1.6" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                  </div>
                  <h2 className="text-2xl font-bold tracking-tight mb-2" style={{ background: 'linear-gradient(135deg, #fff 40%, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                    DocsIQ
                  </h2>
                  <p className="text-sm text-zinc-500 max-w-xs mx-auto leading-relaxed">Upload dokumen kamu, lalu tanya apa saja tentang isinya.</p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center max-w-sm">
                  {suggestions.map(s => (
                    <button key={s} onClick={() => { setInput(s); inputRef.current?.focus() }}
                      className="text-xs px-4 py-2 rounded-full transition-all hover:scale-105 active:scale-95"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.08)', color: '#71717a' }}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Messages */}
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>

                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-xl shrink-0 flex items-center justify-center mt-0.5" style={{ background: 'linear-gradient(135deg, #6d28d9, #4338ca)', boxShadow: '0 0 12px rgba(109,40,217,0.3)' }}>
                    <svg width="13" height="13" fill="none" stroke="white" strokeWidth="2.2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>
                  </div>
                )}

                <div className={`flex flex-col gap-1.5 ${msg.role === 'user' ? 'items-end max-w-[58%]' : 'items-start max-w-[76%]'}`}>
                  <span className="text-[10px] text-zinc-700 px-0.5">
                    {msg.role === 'assistant' ? 'DocsIQ' : 'Kamu'}
                  </span>
                  <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${msg.role === 'user' ? 'rounded-tr-sm' : msg.error ? 'rounded-tl-sm' : 'rounded-tl-sm'}`}
                    style={
                      msg.role === 'user'
                        ? { background: 'linear-gradient(135deg, #6d28d9, #4338ca)', color: 'white' }
                        : msg.error
                        ? { background: 'rgba(239,68,68,0.07)', border: '0.5px solid rgba(239,68,68,0.18)', color: '#fca5a5' }
                        : { background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.07)', color: '#e4e4e7' }
                    }>
                    {formatContent(msg.content)}
                  </div>

                  {/* Sources */}
                  {msg.chunks && msg.chunks.length > 0 && (
                    <div className="w-full">
                      <button onClick={() => setShowSources(showSources === i ? null : i)}
                        className="flex items-center gap-1.5 text-[11px] px-0.5 transition-colors"
                        style={{ color: showSources === i ? '#a78bfa' : '#3f3f46' }}>
                        <svg width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        {msg.chunks.length} sumber · {showSources === i ? 'sembunyikan' : 'lihat referensi'}
                        <svg width="9" height="9" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" style={{ transform: showSources === i ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><polyline points="6 9 12 15 18 9"/></svg>
                      </button>
                      {showSources === i && (
                        <div className="mt-2 space-y-2">
                          {msg.chunks.map((c, j) => (
                            <div key={j} className="rounded-xl p-3" style={{ background: 'rgba(109,40,217,0.06)', border: '0.5px solid rgba(109,40,217,0.18)' }}>
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[11px] font-semibold text-violet-400 truncate max-w-[70%]">{c.source}</span>
                                <span className="text-[10px] text-zinc-600 shrink-0 ml-2">{c.score}% relevan</span>
                              </div>
                              <p className="text-[11px] text-zinc-500 leading-relaxed">{c.text}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-xl shrink-0 flex items-center justify-center mt-0.5 text-[11px] font-bold text-zinc-400" style={{ background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.08)' }}>
                    U
                  </div>
                )}
              </div>
            ))}

            {/* Loading */}
            {loading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-xl shrink-0 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #6d28d9, #4338ca)' }}>
                  <svg width="13" height="13" fill="none" stroke="white" strokeWidth="2.2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>
                </div>
                <div className="rounded-2xl rounded-tl-sm px-4 py-3.5 flex items-center gap-1.5" style={{ background: 'rgba(255,255,255,0.04)', border: '0.5px solid rgba(255,255,255,0.07)' }}>
                  {[0, 1, 2].map(d => (
                    <div key={d} className="w-1.5 h-1.5 rounded-full bg-violet-500" style={{ animation: `dmBounce 1.2s ease-in-out ${d * 0.18}s infinite` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-6 pb-5 pt-2">
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl transition-all" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              {/* Mobile upload */}
              <button className="md:hidden shrink-0 text-zinc-600 hover:text-violet-400 transition-colors" onClick={() => mobileFileRef.current?.click()}>
                <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              </button>
              <input ref={mobileFileRef} type="file" multiple accept=".pdf,.txt,.md" className="hidden" onChange={e => handleUpload(e.target.files)} />

              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder={stats.totalChunks > 0 ? 'Tanya sesuatu tentang dokumen...' : 'Upload dokumen dulu di sidebar...'}
                disabled={loading}
                className="flex-1 bg-transparent text-sm text-white placeholder:text-zinc-600 focus:outline-none disabled:opacity-40"
              />

              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 disabled:opacity-25 disabled:scale-100"
                style={{ background: input.trim() ? 'linear-gradient(135deg, #6d28d9, #4338ca)' : 'rgba(255,255,255,0.05)', boxShadow: input.trim() ? '0 0 12px rgba(109,40,217,0.3)' : 'none' }}
              >
                <svg width="13" height="13" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </button>
            </div>

            <p className="text-center text-[10px] text-zinc-800 mt-2.5">
              DocsIQ · built by{' '}
              <a href="https://github.com/ikramramadhana" target="_blank" className="text-zinc-700 hover:text-violet-500 transition-colors">@ikramramadhana</a>
            </p>
          </div>
        </main>
      </div>

      <style jsx global>{`
        @keyframes dmBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.6; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.07); border-radius: 2px; }
      `}</style>
    </div>
  )
}
