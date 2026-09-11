import ReactFlow, { Background, Controls, MiniMap, Node, Edge, Handle, Position, useStore, ReactFlowProvider, useReactFlow, Viewport } from 'reactflow'
import 'reactflow/dist/style.css'
import { GraphNode, GraphEdge } from '../types'
import { useEffect, useMemo, useRef, useState } from 'react'

function layout(nodes: GraphNode[], edges: GraphEdge[]) {
  // Simple layered layout: group by type, then position
  const fileNodes = nodes.filter(n=>n.type==='file')
  const apiNodes = nodes.filter(n=>n.type==='api')
  const all = [...fileNodes, ...apiNodes]
  // Dagre-like: columns
  const cols = 3
  return all.map((n, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    return {
      id: n.id,
      data: { label: n.label, file: n.file, type: n.type },
      position: { x: col*280 + 20, y: row*90 + 20 },
      style: {
        background: n.type==='api' ? 'linear-gradient(135deg,#7c5cff,#22d3ee)' : '#181825',
        color: 'white',
        border: n.type==='api' ? '1px solid #7c5cff' : '1px solid #2a2a3a',
        borderRadius: 10,
        padding: 10,
        fontSize: 12,
        width: 240,
        boxShadow: '0 4px 20px rgba(0,0,0,0.4)'
      },
      type: 'default' as const
    } as Node
  })
}

export function ArchitectureGraph({ nodes, edges, onNodeClick }: { nodes: GraphNode[], edges: GraphEdge[], onNodeClick: (file?: string)=>void }) {
  return (
    <ReactFlowProvider>
      <FlowInner nodes={nodes} edges={edges} onNodeClick={onNodeClick} />
    </ReactFlowProvider>
  )
}

function FlowInner({ nodes, edges, onNodeClick }: { nodes: GraphNode[], edges: GraphEdge[], onNodeClick: (file?: string)=>void }) {
  const flowNodes = useMemo(()=> layout(nodes, edges), [nodes, edges])
  const flowEdges: Edge[] = edges.map(e=>({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label,
    animated: e.type==='import',
    style: { stroke: e.type==='api' ? '#7c5cff' : '#3a3a4a', strokeWidth: 1.5 },
    labelStyle: { fill: '#9aa0b2', fontSize: 10 },
    type: 'smoothstep'
  }))

  // When the default lock control engages, additionally disable panning while
  // explicitly keeping all zoom pathways enabled.
  const [panLocked, setPanLocked] = useState(false)
  // Shared viewport memory for the fit/center toggle: default = viewport
  // established on init (after the existing fitView is applied); preFit =
  // viewport just before the last fit, so toggle restores pre-fit state.
  const viewportMemoryRef = useRef<{ def: Viewport | null, preFit: Viewport | null }>({ def: null, preFit: null })

  return (
    <div className="h-full w-full bg-[#0e0e14] rounded-xl border border-[#23232f] overflow-hidden">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        onNodeClick={(_, node)=> onNodeClick((node.data as any).file)}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        onInit={(instance)=> { viewportMemoryRef.current.def = instance.getViewport() }}
        panOnDrag={!panLocked}
        panOnScroll={false}
        zoomOnScroll
        zoomOnPinch
        zoomOnDoubleClick
      >
        <Background color="#1f1f2e" gap={16} />
        <ThemedControls viewportMemoryRef={viewportMemoryRef} onLockChange={(locked)=> setPanLocked(locked)} />
        <MiniMap style={{ background: '#111119' }} maskColor="rgba(0,0,0,0.6)" nodeColor={(n)=> (n.data as any).type==='api' ? '#7c5cff' : '#2a2a3a'} pannable={!panLocked} zoomable />
      </ReactFlow>
    </div>
  )
}

// React Flow's control icons are SVGs with no fill attribute, so they render
// black and ignore the button text color. `fill-current` makes them follow the
// (light) button color, fixing contrast on the dark graph background.
// Tooltips use the project's existing native `title` mechanism; the lock
// tooltip tracks the real interactivity state from the React Flow store.
const selectInteractive = (s: any) => s.nodesDraggable || s.nodesConnectable || s.elementsSelectable

function ThemedControls({ viewportMemoryRef, onLockChange }: { viewportMemoryRef: React.MutableRefObject<{ def: Viewport | null, preFit: Viewport | null }>, onLockChange: (locked: boolean)=>void }) {
  const isInteractive = useStore(selectInteractive)
  const locked = !isInteractive
  const { getViewport, setViewport } = useReactFlow()
  const [isFitted, setIsFitted] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Sync lock state up so the graph disables panning while locked.
  // Node drag/select locking itself stays owned by React Flow's default
  // interactive control; we only add pan suppression + keep zoom enabled.
  useEffect(() => {
    onLockChange(locked)
  }, [locked, onLockChange])

  // Fit/center toggle: intercept the existing fit button in the capture phase.
  // Unfitted -> save current viewport, allow default fit, mark fitted.
  // Fitted -> block default fit, restore pre-fit (fallback: init default).
  useEffect(() => {
    const root = ref.current
    if (!root) return
    const btn = root.querySelector('.react-flow__controls-fitview')
    if (!btn) return
    const handler = (e: Event) => {
      if (!isFitted) {
        viewportMemoryRef.current.preFit = getViewport()
        setIsFitted(true)
        // let React Flow's default fitView proceed
      } else {
        e.preventDefault()
        e.stopPropagation()
        const target = viewportMemoryRef.current.preFit || viewportMemoryRef.current.def
        if (target) setViewport(target)
        setIsFitted(false)
      }
    }
    btn.addEventListener('click', handler, true)
    return () => btn.removeEventListener('click', handler, true)
  }, [isFitted, getViewport, setViewport, viewportMemoryRef])

  useEffect(() => {
    const root = ref.current
    if (!root) return
    const setTip = (sel: string, tip: string) => {
      const el = root.querySelector(sel)
      if (el) {
        el.setAttribute('title', tip)
        el.setAttribute('aria-label', tip)
      }
    }
    setTip('.react-flow__controls-zoomin', 'Zoom in')
    setTip('.react-flow__controls-zoomout', 'Zoom out')
    setTip('.react-flow__controls-fitview', isFitted ? 'Restore default graph view' : 'Fit graph to view')
    setTip('.react-flow__controls-interactive', isInteractive ? 'Lock graph interaction' : 'Unlock graph interaction')
  })

  return (
    <div ref={ref} className="contents">
      <Controls className="!bg-[#111119] !border-[#23232f] [&>button]:!bg-[#111119] [&>button]:!border-[#23232f] [&>button]:!text-zinc-300 [&>button:hover]:!bg-white/10 [&>button:hover]:!text-white [&_svg]:!fill-current" />
    </div>
  )
}
