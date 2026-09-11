import Editor from '@monaco-editor/react'

export function CodeViewer({ path, content, onClose, isMaximized, onToggleMaximize }: { path: string, content: string, onClose?: ()=>void, isMaximized?: boolean, onToggleMaximize?: ()=>void }) {
  const ext = path.split('.').pop() || ''
  const lang = ext==='py' ? 'python' : ext==='ts' || ext==='tsx' ? 'typescript' : ext==='js' || ext==='jsx' ? 'javascript' : ext==='json' ? 'json' : ext==='css' ? 'css' : 'plaintext'
  // Single shared style for all window controls so maximize/restore/close have
  // identical button dimensions, clickable area, padding, radius and hover.
  // Icons are fixed-size SVGs inside the identical container.
  const headerBtn = 'w-7 h-7 shrink-0 flex items-center justify-center rounded-md text-zinc-400 hover:text-white hover:bg-white/10 transition-colors leading-none'
  return (
    <div className="h-full flex flex-col bg-[#111119] overflow-hidden min-h-0">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#23232f] bg-[#0e0e14] shrink-0">
        <div className="text-sm text-zinc-300 font-mono truncate">{path || 'No file selected'}</div>
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] px-2 py-1 rounded bg-white/5 border border-white/10 text-zinc-400">{lang}</span>
          {onToggleMaximize && (
            <button
              onClick={onToggleMaximize}
              title={isMaximized ? 'Restore panel size' : 'Maximize panel'}
              aria-label={isMaximized ? 'Restore panel size' : 'Maximize panel'}
              className={headerBtn}
            >
              {isMaximized ? <RestoreIcon /> : <MaximizeIcon />}
            </button>
          )}
          {onClose && <button onClick={onClose} title="Close panel" aria-label="Close panel" className={headerBtn}><CloseIcon /></button>}
        </div>
      </div>
      <div className="flex-1 min-h-0">
        {path ? (
          <Editor
            height="100%"
            language={lang}
            value={content}
            theme="vs-dark"
            options={{ readOnly: true, minimap: { enabled: false }, fontSize: 13, scrollBeyondLastLine: false, wordWrap: 'on' }}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-zinc-600 text-sm">Select a file or graph node to view source</div>
        )}
      </div>
    </div>
  )
}

// Fixed-size (12px) stroked icons so every window control renders the same
// glyph size inside the identical 28px button container.
function MaximizeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="1.5" y="1.5" width="9" height="9" rx="1" />
    </svg>
  )
}

function RestoreIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="3.5" y="1.5" width="7" height="7" rx="1" />
      <path d="M8.5 10.5h-6v-6" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M2.5 2.5l7 7M9.5 2.5l-7 7" />
    </svg>
  )
}
