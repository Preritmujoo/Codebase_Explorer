import { useCallback, useEffect, useRef, useState } from 'react'
import { AnalysisResult } from '../types'
import { uploadZip, fetchFile } from '../services/api'
import { UploadDropzone } from '../components/UploadDropzone'
import { FileTree } from '../components/FileTree'
import { ArchitectureGraph } from '../components/ArchitectureGraph'
import { InsightsPanel } from '../components/InsightsPanel'
import { CodeViewer } from '../components/CodeViewer'
import { AskAI } from '../components/AskAI'

export function Explorer() {
  const [data, setData] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [code, setCode] = useState<string>('')
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isChatMinimized, setIsChatMinimized] = useState(false)

  // --- AI chat window (resizable / maximizable drawer) state ---
  // Anchored top-right like before; width/height are user-adjustable by dragging
  // the left/bottom edges or the bottom-left corner. `chatHeight === null` means
  // full height (the original bottom-0 behavior) until the user drags an edge.
  const CHAT_MIN_W = 320
  const CHAT_MIN_H = 360
  const HEADER_H = 56 // header is h-14
  const [chatWidth, setChatWidth] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 640 ? window.innerWidth : 400)
  const [chatHeight, setChatHeight] = useState<number | null>(null)
  const [isChatMaximized, setIsChatMaximized] = useState(false)
  const [isChatResizing, setIsChatResizing] = useState(false)
  const prevChatSizeRef = useRef({ w: 400, h: null as number | null })
  const chatDragRef = useRef<{ startX: number, startY: number, w: number, h: number, dir: 'w' | 'h' | 'wh' } | null>(null)

  const clampChatWidth = useCallback((w: number) => {
    const vw = window.innerWidth
    if (vw < 640) return vw // mobile: full-width layout
    return Math.min(Math.max(w, Math.min(CHAT_MIN_W, vw)), vw)
  }, [])

  const clampChatHeight = useCallback((h: number | null) => {
    if (h === null) return null
    const maxH = Math.max(1, window.innerHeight - HEADER_H) // never past the viewport bottom
    const minH = Math.min(CHAT_MIN_H, maxH) // min never exceeds max on tiny windows
    return Math.min(Math.max(h, minH), maxH)
  }, [])

  // Keep the chat within the viewport on mount and on window resize
  useEffect(() => {
    const clamp = () => {
      setChatWidth(w => clampChatWidth(w))
      setChatHeight(h => clampChatHeight(h))
    }
    clamp()
    window.addEventListener('resize', clamp)
    return () => window.removeEventListener('resize', clamp)
  }, [clampChatWidth, clampChatHeight])

  // Pointer drag on the chat edges/corner (window is anchored top-right, so the
  // free edges are left → width and bottom → height; corner → both)
  useEffect(() => {
    if (!isChatResizing) return
    const onMove = (e: PointerEvent) => {
      const s = chatDragRef.current
      if (!s) return
      if (s.dir !== 'h') setChatWidth(clampChatWidth(s.w + (s.startX - e.clientX)))
      if (s.dir !== 'w') setChatHeight(clampChatHeight(s.h + (e.clientY - s.startY)))
    }
    const onUp = () => {
      chatDragRef.current = null
      setIsChatResizing(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [isChatResizing, clampChatWidth, clampChatHeight])

  const startChatResize = useCallback((e: React.PointerEvent, dir: 'w' | 'h' | 'wh') => {
    if (isChatMaximized) return
    e.preventDefault()
    chatDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      w: chatWidth,
      h: chatHeight ?? window.innerHeight - HEADER_H,
      dir,
    }
    setIsChatResizing(true)
    document.body.style.cursor = dir === 'w' ? 'ew-resize' : dir === 'h' ? 'ns-resize' : 'nesw-resize'
    document.body.style.userSelect = 'none'
  }, [isChatMaximized, chatWidth, chatHeight])

  const toggleChatMaximize = useCallback(() => {
    if (!isChatMaximized) {
      // Save the current size so restore brings it back exactly
      prevChatSizeRef.current = { w: chatWidth, h: chatHeight }
      setIsChatMaximized(true)
    } else {
      setChatWidth(clampChatWidth(prevChatSizeRef.current.w))
      setChatHeight(clampChatHeight(prevChatSizeRef.current.h))
      setIsChatMaximized(false)
    }
  }, [isChatMaximized, chatWidth, chatHeight, clampChatWidth, clampChatHeight])

  // --- Codebase bottom-panel (dockable bottom sheet) state ---
  const MIN_HEIGHT = 160
  const DEFAULT_HEIGHT = 360
  const [isCodeOpen, setIsCodeOpen] = useState(true)
  const [isMaximized, setIsMaximized] = useState(false)
  const [panelHeight, setPanelHeight] = useState(DEFAULT_HEIGHT)
  const [isDragging, setIsDragging] = useState(false)
  const prevHeightRef = useRef(DEFAULT_HEIGHT)
  const dragStateRef = useRef<{ startY: number, startHeight: number } | null>(null)

  const clampHeight = useCallback((h: number) => {
    const vh = typeof window !== 'undefined' ? window.innerHeight : 900
    const maxH = Math.max(MIN_HEIGHT, vh - 56 - 120) // leave room for header + part of main UI
    return Math.min(Math.max(h, MIN_HEIGHT), maxH)
  }, [])

  // Keep panel within bounds on window resize
  useEffect(() => {
    const onResize = () => setPanelHeight(h => clampHeight(h))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [clampHeight])

  // Pointer drag: move -> resize, up -> end
  useEffect(() => {
    if (!isDragging) return
    const onMove = (e: PointerEvent) => {
      const s = dragStateRef.current
      if (!s) return
      setPanelHeight(clampHeight(s.startHeight + (s.startY - e.clientY)))
    }
    const onUp = () => {
      dragStateRef.current = null
      setIsDragging(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [isDragging, clampHeight])

  const startResize = useCallback((e: React.PointerEvent) => {
    if (isMaximized) return
    e.preventDefault()
    dragStateRef.current = { startY: e.clientY, startHeight: panelHeight }
    setIsDragging(true)
    document.body.style.cursor = 'ns-resize'
    document.body.style.userSelect = 'none'
  }, [isMaximized, panelHeight])

  const toggleMaximize = useCallback(() => {
    setIsMaximized(prev => {
      if (!prev) prevHeightRef.current = panelHeight
      return !prev
    })
  }, [panelHeight])

  const closePanel = useCallback(() => {
    prevHeightRef.current = panelHeight
    setIsMaximized(false)
    setIsCodeOpen(false)
  }, [panelHeight])

  const openPanel = useCallback(() => {
    setPanelHeight(clampHeight(prevHeightRef.current || DEFAULT_HEIGHT))
    setIsCodeOpen(true)
  }, [clampHeight])

  const handleUpload = async (file: File) => {
    setError(null)
    setLoading(true)
    try {
      const res = await uploadZip(file)
      setData(res)
      // auto-select first file
      const first = findFirstFile(res.file_tree)
      if (first) {
        handleSelect(first)
      }
    } catch (e: any) {
      setError(e.response?.data?.detail || e.message || 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = async (path: string) => {
    setSelectedPath(path)
    // Reopen the panel if it was closed (preserves height); don't disturb maximize state
    setIsCodeOpen(true)
    if (!data) return
    try {
      const content = await fetchFile(data.id, path)
      setCode(content)
    } catch (e: any) {
      setCode(`// Error loading file: ${e.response?.data?.detail || e.message}`)
    }
  }

  const handleGraphClick = (file?: string) => {
    if (file) handleSelect(file)
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0a0a0f]">
        <header className="sticky top-0 z-10 backdrop-blur bg-[#0a0a0f]/80 border-b border-[#23232f]">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#7c5cff] to-[#22d3ee]" />
              <span className="font-semibold tracking-tight">Codebase Explorer</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 border border-white/10 text-zinc-400">MVP</span>
            </div>
            <span className="text-xs text-zinc-500">FastAPI + React Explorer</span>
          </div>
        </header>
        <main className="max-w-3xl mx-auto px-6 py-16">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold tracking-tight">Understand any codebase in seconds</h1>
            <p className="text-zinc-500 mt-3">Upload a .zip — get file tree, architecture graph, APIs & insights</p>
          </div>
          <UploadDropzone onUpload={handleUpload} loading={loading} />
          {error && <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-sm text-red-400">{error}</div>}
          <div className="mt-8 grid grid-cols-3 gap-3 text-center">
            <Feature icon="🌳" title="File Tree" desc="Nested dirs, sizes & lines" />
            <Feature icon="🕸" title="Graph" desc="Import relationships" />
            <Feature icon="⚡" title="APIs" desc="FastAPI/Express routes" />
          </div>
          <div className="mt-8 p-4 rounded-xl bg-[#111119] border border-[#23232f] text-sm text-zinc-500">
            Try the sample repo: <code className="text-zinc-300">/sample-repo</code> · zip it and upload. Ignores <code>.git, node_modules, __pycache__</code>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0f] text-zinc-200">
      <header className="h-14 shrink-0 flex items-center justify-between px-4 border-b border-[#23232f] bg-[#0a0a0f]">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#7c5cff] to-[#22d3ee]" />
          <span className="font-semibold">Codebase Explorer</span>
          <span className="hidden sm:inline text-xs text-zinc-500 truncate max-w-[240px]">Repository · {data.id}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">{data.file_count} files</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (!isChatOpen) { setIsChatOpen(true); setIsChatMinimized(false) }
              else if (isChatMinimized) { setIsChatMinimized(false) }
              else { setIsChatMinimized(true) }
            }}
            title={!isChatOpen ? 'Chat about this codebase' : isChatMinimized ? 'Restore AI chat' : 'Minimize AI chat'}
            className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${isChatOpen ? 'bg-[#7c5cff]/20 border-[#7c5cff]/40 text-[#c9bfff]' : 'bg-white/10 border-white/10 text-zinc-200 hover:bg-white/15'}`}
          >
            ✨ Ask AI
          </button>
          {!isCodeOpen && (
            <button
              onClick={openPanel}
              title="Open Codebase panel"
              className="px-3 py-1.5 rounded-full bg-white/10 border border-white/10 text-sm text-zinc-200 hover:bg-white/15 transition-colors"
            >
              {'</>'} Codebase
            </button>
          )}
          <button onClick={()=>setData(null)} className="px-3 py-1.5 rounded-full bg-white text-black text-sm font-medium hover:bg-zinc-200">New upload</button>
        </div>
      </header>

      {!isMaximized && (
      <div className="flex-1 min-h-0 grid grid-rows-[1fr_320px] lg:grid-rows-1 lg:grid-cols-[300px_1fr_360px] xl:grid-cols-[320px_1fr_380px]">
        {/* File Tree */}
        <div className="border-r border-[#23232f] bg-[#0e0e14] overflow-y-auto order-1">
          <FileTree root={data.file_tree} onSelect={handleSelect} selected={selectedPath || undefined} />
        </div>

        {/* Graph */}
        <div className="flex flex-col min-h-0 bg-[#0a0a0f] p-3 gap-3 order-2 lg:order-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-200">Architecture Graph</h2>
            <span className="text-xs text-zinc-500">{data.graph.nodes.length} nodes · {data.graph.edges.length} edges</span>
          </div>
          <div className="flex-1 min-h-[320px] lg:min-h-0">
            <ArchitectureGraph nodes={data.graph.nodes} edges={data.graph.edges} onNodeClick={handleGraphClick} />
          </div>
        </div>

        {/* Insights */}
        <div className="border-l border-[#23232f] bg-[#0a0a0f] overflow-y-auto order-3">
          <InsightsPanel data={data} />
        </div>
      </div>
      )}

      {/* Code Viewer — dockable resizable bottom sheet */}
      {isCodeOpen ? (
        <div
          className={`shrink-0 relative flex flex-col min-h-0 ${isMaximized ? 'flex-1' : ''} ${isDragging ? '' : 'transition-[height] duration-150 ease-out'}`}
          style={isMaximized ? undefined : { height: panelHeight }}
        >
          {/* Drag-to-resize handle */}
          {!isMaximized && (
            <div
              onPointerDown={startResize}
              title="Drag to resize"
              className="h-2.5 shrink-0 cursor-ns-resize group flex items-center justify-center bg-[#0a0a0f] border-t border-[#23232f] hover:bg-white/[0.04] active:bg-white/[0.06] touch-none select-none"
              style={{ cursor: 'ns-resize' }}
            >
              <div className="w-12 h-1 rounded-full bg-[#2a2a3a] group-hover:bg-[#7c5cff]/60 group-active:bg-[#7c5cff] transition-colors" />
            </div>
          )}
          <div className="flex-1 min-h-0">
            <CodeViewer
              path={selectedPath || ''}
              content={code}
              onClose={closePanel}
              isMaximized={isMaximized}
              onToggleMaximize={toggleMaximize}
            />
          </div>
        </div>
      ) : (
        /* Reopen affordance when closed */
        <button
          onClick={openPanel}
          title="Open Codebase panel"
          className="shrink-0 flex items-center justify-center gap-2 py-1.5 bg-[#0e0e14] border-t border-[#23232f] text-xs text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04] transition-colors"
        >
          <span className="inline-block w-10 h-1 rounded-full bg-[#2a2a3a]" />
          <span>{'</>'} Open Codebase{selectedPath ? ` · ${selectedPath.split('/').pop()}` : ''}</span>
        </button>
      )}

      {/* AI chat drawer — overlays the layout so the grid is untouched.
          Stays mounted while minimized (hidden) so conversation state is preserved;
          X unmounts it (existing close behavior). Sized by chatWidth/chatHeight
          (or full-bleed when maximized); edges/corner are drag-to-resize. */}
      {isChatOpen && (
        <div
          className={`fixed top-14 right-0 z-40 border-l border-[#23232f] bg-[#0e0e14] shadow-2xl overflow-hidden ${
            isChatMaximized ? 'left-0 bottom-0' : chatHeight === null ? 'bottom-0' : ''
          } ${isChatResizing ? '' : 'transition-[width,height] duration-150 ease-out'} ${isChatMinimized ? 'hidden' : ''}`}
          style={isChatMaximized ? undefined : { width: chatWidth, ...(chatHeight !== null ? { height: chatHeight } : {}) }}
        >
          {!isChatMaximized && (
            <>
              {/* Left edge — drag to resize width (desktop only; mobile is full-width) */}
              <div
                onPointerDown={e => startChatResize(e, 'w')}
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize chat width"
                title="Drag to resize width"
                className="hidden sm:block absolute left-0 top-0 bottom-0 w-1.5 z-10 cursor-ew-resize touch-none select-none hover:bg-[#7c5cff]/40 active:bg-[#7c5cff]/60"
              />
              {/* Bottom edge — drag to resize height */}
              <div
                onPointerDown={e => startChatResize(e, 'h')}
                role="separator"
                aria-orientation="horizontal"
                aria-label="Resize chat height"
                title="Drag to resize height"
                className="absolute left-0 right-0 bottom-0 h-1.5 z-10 cursor-ns-resize touch-none select-none hover:bg-[#7c5cff]/40 active:bg-[#7c5cff]/60"
              />
              {/* Bottom-left corner — drag to resize both */}
              <div
                onPointerDown={e => startChatResize(e, 'wh')}
                role="separator"
                aria-label="Resize chat window"
                title="Drag to resize"
                className="hidden sm:block absolute left-0 bottom-0 w-3.5 h-3.5 z-10 cursor-nesw-resize touch-none select-none hover:bg-[#7c5cff]/40 active:bg-[#7c5cff]/60"
              />
            </>
          )}
          <AskAI
            repoId={data.id}
            selectedPath={selectedPath}
            isMaximized={isChatMaximized}
            onToggleMaximize={toggleChatMaximize}
            onMinimize={() => setIsChatMinimized(true)}
            onClose={() => { setIsChatOpen(false); setIsChatMinimized(false); setIsChatMaximized(false) }}
          />
        </div>
      )}
    </div>
  )
}

function Feature({icon, title, desc}:{icon:string,title:string,desc:string}){
  return (
    <div className="rounded-xl bg-[#111119] border border-[#23232f] p-4">
      <div className="text-lg">{icon}</div>
      <div className="text-sm font-medium text-white mt-1">{title}</div>
      <div className="text-xs text-zinc-500">{desc}</div>
    </div>
  )
}
function findFirstFile(node: any): string | null {
  if (node.type==='file') return node.path
  if (node.children) {
    for (const ch of node.children) {
      const r = findFirstFile(ch)
      if (r) return r
    }
  }
  return null
}
