import { FileNode } from '../types'

function TreeNode({ node, onSelect, selected, depth=0 }: { node: FileNode, onSelect: (p:string)=>void, selected?: string, depth?: number }) {
  const isDir = node.type === 'directory'
  const expandedDefault = depth < 2
  const [open, setOpen] = useState(expandedDefault)
  if (isDir) {
    return (
      <div>
        <div
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 px-2 py-1 hover:bg-white/5 cursor-pointer text-sm text-zinc-300"
          style={{ paddingLeft: 12 + depth*12 }}
        >
          <span className="text-xs w-3">{open ? '▾' : '▸'}</span>
          <span className="text-[11px]">📁</span>
          <span className="truncate">{node.name}</span>
          {node.children && <span className="ml-auto text-[10px] text-zinc-500">{node.children.length}</span>}
        </div>
        {open && node.children?.map(ch => (
          <TreeNode key={ch.path} node={ch} onSelect={onSelect} selected={selected} depth={depth+1} />
        ))}
      </div>
    )
  }
  const isSelected = selected === node.path
  const icon = getIcon(node.name)
  return (
    <div
      onClick={() => onSelect(node.path)}
      className={`flex items-center gap-1.5 px-2 py-1 cursor-pointer text-sm truncate border-l-2 ${isSelected ? 'bg-[#7c5cff]/15 border-[#7c5cff] text-white' : 'border-transparent hover:bg-white/5 text-zinc-400'}`}
      style={{ paddingLeft: 24 + depth*12 }}
      title={node.path}
    >
      <span className="text-[11px]">{icon}</span>
      <span className="truncate text-[13px]">{node.name}</span>
      {node.lines != null && <span className="ml-auto text-[10px] text-zinc-600">{node.lines} L</span>}
    </div>
  )
}

function getIcon(name: string) {
  if (name.endsWith('.py')) return '🐍'
  if (name.endsWith('.ts') || name.endsWith('.tsx')) return 'TS'
  if (name.endsWith('.js') || name.endsWith('.jsx')) return 'JS'
  if (name.endsWith('.json')) return '{}'
  if (name.endsWith('.css')) return '#'
  return '•'
}

import { useState } from 'react'

export function FileTree({ root, onSelect, selected }: { root: FileNode, onSelect: (p:string)=>void, selected?: string }) {
  // If root is wrapper with single child, show children
  const display = root
  return (
    <div className="py-1">
      <div className="px-3 py-2 text-[11px] tracking-widest text-zinc-500 font-semibold">EXPLORER</div>
      {display.children?.map(ch => (
        <TreeNode key={ch.path} node={ch} onSelect={onSelect} selected={selected} depth={0} />
      ))}
      {(!display.children || display.children.length===0) && (
        <div className="px-3 py-2 text-sm text-zinc-500">No files</div>
      )}
    </div>
  )
}
