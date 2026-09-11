import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { askRepoChat, getLlmStatus, ChatMessage } from '../services/api'

export function AskAI({ repoId, selectedPath, onClose, onMinimize }: { repoId: string, selectedPath: string | null, onClose: () => void, onMinimize: () => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [model, setModel] = useState<string>('')
  const [includeFile, setIncludeFile] = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getLlmStatus()
      .then(s => { setConfigured(s.configured); setModel(s.default_model) })
      .catch(() => setConfigured(false))
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    setError(null)
    const next: ChatMessage[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setInput('')
    setLoading(true)
    try {
      const res = await askRepoChat(repoId, next, {
        file_path: includeFile && selectedPath ? selectedPath : undefined,
      })
      setModel(res.model)
      setMessages([...next, { role: 'assistant', content: res.content }])
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Chat request failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-full flex flex-col bg-[#0e0e14] min-h-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#23232f] shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm">✨</span>
          <span className="text-sm font-semibold text-zinc-200">Ask AI</span>
          {model && <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-zinc-500 truncate max-w-[140px]" title={model}>{model.split('/').pop()}</span>}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onMinimize} title="Minimize chat" aria-label="Minimize chat" className="w-7 h-7 shrink-0 flex items-center justify-center rounded-md text-zinc-500 hover:text-white hover:bg-white/10 transition-colors">−</button>
          <button onClick={onClose} title="Close chat" aria-label="Close chat" className="w-7 h-7 shrink-0 flex items-center justify-center rounded-md text-zinc-500 hover:text-white hover:bg-white/10 transition-colors">✕</button>
        </div>
      </div>

      <div className="px-3 py-2 border-b border-[#23232f] shrink-0 space-y-1.5">
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>Repo structure included</span>
        </div>
        {selectedPath && (
          <label className="flex items-center gap-1.5 text-[11px] text-zinc-400 cursor-pointer">
            <input type="checkbox" checked={includeFile} onChange={e => setIncludeFile(e.target.checked)} className="accent-[#7c5cff]" />
            <span className="font-mono truncate" title={selectedPath}>+ {selectedPath}</span>
          </label>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2.5">
        {configured === false && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300">
            LLM not configured — set <code>GROQ_API_KEY</code> on the backend and reload.
          </div>
        )}
        {messages.length === 0 && (
          <div className="text-xs text-zinc-500 space-y-1.5">
            <p>Ask about this codebase — structure, APIs, and{selectedPath ? ' the selected file' : ''} are sent as context.</p>
            <p className="text-zinc-600">Try: “Where is authentication handled?” or “How do the frontend and backend connect?”</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div className={`max-w-[90%] min-w-0 px-3 py-2 rounded-xl text-[13px] leading-relaxed break-words ${
              m.role === 'user'
                ? 'bg-[#7c5cff]/20 border border-[#7c5cff]/40 text-zinc-100 whitespace-pre-wrap'
                : 'bg-white/[0.04] border border-white/10 text-zinc-300 overflow-hidden'
            }`}>
              {m.role === 'user' ? m.content : (
                <div className="ai-markdown min-w-0 max-w-full">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{m.content}</ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && <div className="text-xs text-zinc-500 animate-pulse">Thinking…</div>}
        {error && <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-400">{error}</div>}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t border-[#23232f] shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
            placeholder="Ask about this codebase…"
            rows={2}
            className="flex-1 min-h-0 resize-none rounded-xl bg-white/[0.04] border border-white/10 px-3 py-2 text-[13px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-[#7c5cff]/60"
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            title="Send message"
            className="shrink-0 px-3.5 py-2 rounded-xl bg-white text-black text-[13px] font-medium hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}

// Dark-theme Markdown mapping for assistant messages. Raw HTML is not enabled
// (react-markdown default), so AI content stays safely constrained inside the
// chat bubble; wide pre/tables scroll internally instead of overflowing the page.
const mdComponents = {
  h1: ({ ...props }: any) => <h1 className="text-[15px] font-semibold text-zinc-100 mt-2 mb-1" {...props} />,
  h2: ({ ...props }: any) => <h2 className="text-sm font-semibold text-zinc-100 mt-2 mb-1" {...props} />,
  h3: ({ ...props }: any) => <h3 className="text-[13px] font-semibold text-zinc-100 mt-2 mb-1" {...props} />,
  h4: ({ ...props }: any) => <h4 className="text-[13px] font-semibold text-zinc-200 mt-1.5 mb-1" {...props} />,
  p: ({ ...props }: any) => <p className="my-1 text-zinc-300 break-words" {...props} />,
  strong: ({ ...props }: any) => <strong className="font-semibold text-zinc-100" {...props} />,
  em: ({ ...props }: any) => <em className="italic text-zinc-300" {...props} />,
  ul: ({ ...props }: any) => <ul className="list-disc pl-4 my-1 space-y-0.5" {...props} />,
  ol: ({ ...props }: any) => <ol className="list-decimal pl-4 my-1 space-y-0.5" {...props} />,
  li: ({ ...props }: any) => <li className="text-zinc-300 break-words" {...props} />,
  a: ({ ...props }: any) => <a className="text-[#22d3ee] underline break-words" target="_blank" rel="noreferrer" {...props} />,
  blockquote: ({ ...props }: any) => <blockquote className="border-l-2 border-[#7c5cff]/50 pl-2 my-1 text-zinc-400" {...props} />,
  hr: ({ ...props }: any) => <hr className="border-white/10 my-2" {...props} />,
  code: ({ inline, className, ...props }: any) =>
    inline
      ? <code className="font-mono text-[12px] px-1 py-px rounded bg-white/[0.07] border border-white/10 text-[#c9bfff] break-words" {...props} />
      : <code className={`font-mono text-[12px] text-zinc-200 ${className || ''}`} {...props} />,
  pre: ({ ...props }: any) => <pre className="my-1.5 max-w-full overflow-x-auto rounded-lg bg-[#0a0a0f] border border-white/10 p-2.5 text-[12px] leading-relaxed" {...props} />,
  table: ({ ...props }: any) => (
    <div className="my-1.5 max-w-full overflow-x-auto rounded-lg border border-white/10">
      <table className="w-full border-collapse text-[12px]" {...props} />
    </div>
  ),
  thead: ({ ...props }: any) => <thead className="bg-white/[0.05]" {...props} />,
  th: ({ ...props }: any) => <th className="text-left px-2 py-1 border-b border-white/10 text-zinc-200 font-medium whitespace-nowrap" {...props} />,
  td: ({ ...props }: any) => <td className="px-2 py-1 border-b border-white/[0.06] text-zinc-300 align-top" {...props} />,
}
