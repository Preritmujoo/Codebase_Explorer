import { AnalysisResult } from '../types'

export function InsightsPanel({ data }: { data: AnalysisResult }) {
  const frameworks = data.frameworks.filter(f=>f.detected)
  return (
    <div className="space-y-4 p-3 overflow-y-auto">
      <div className="rounded-xl bg-[#111119] border border-[#23232f] p-4">
        <div className="text-xs tracking-widest text-zinc-500 font-semibold mb-3">OVERVIEW</div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Stat label="Files" value={data.file_count} />
          <Stat label="Lines" value={data.total_lines} />
          <Stat label="APIs" value={data.endpoints.length} />
          <Stat label="Classes" value={data.classes.length} />
        </div>
      </div>

      <div className="rounded-xl bg-[#111119] border border-[#23232f] p-4">
        <div className="text-xs tracking-widest text-zinc-500 font-semibold mb-3">LANGUAGES</div>
        <div className="space-y-2">
          {data.languages.map(l=> (
            <div key={l.language} className="flex items-center gap-2 text-sm">
              <span className="w-3 h-3 rounded-full" style={{background:l.color}} />
              <span className="flex-1 text-zinc-300">{l.language}</span>
              <span className="text-zinc-500 text-xs">{l.files} files · {l.lines} lines</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-[#111119] border border-[#23232f] p-4">
        <div className="text-xs tracking-widest text-zinc-500 font-semibold mb-3">FRAMEWORKS</div>
        {frameworks.length===0 ? <div className="text-sm text-zinc-500">None detected</div> : (
          <div className="flex flex-wrap gap-1.5">
            {frameworks.map(f=> (
              <span key={f.name} className="px-2.5 py-1 rounded-full bg-[#7c5cff]/15 border border-[#7c5cff]/30 text-xs text-[#a99cff]">{f.name}</span>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl bg-[#111119] border border-[#23232f] p-4">
        <div className="text-xs tracking-widest text-zinc-500 font-semibold mb-3">DEPENDENCIES</div>
        {data.dependencies.length===0 ? <div className="text-sm text-zinc-500">No manifest found</div> : (
          <div className="space-y-3">
            {data.dependencies.map((d,i)=> (
              <div key={i}>
                <div className="text-xs text-zinc-500 mb-1">{d.file} · {d.ecosystem}</div>
                <div className="flex flex-wrap gap-1">
                  {d.packages.slice(0,12).map(p=> (
                    <span key={p.name} className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[11px] text-zinc-300">{p.name}</span>
                  ))}
                  {d.packages.length>12 && <span className="text-xs text-zinc-500">+{d.packages.length-12} more</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl bg-[#111119] border border-[#23232f] p-4">
        <div className="text-xs tracking-widest text-zinc-500 font-semibold mb-3">API ENDPOINTS</div>
        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
          {data.endpoints.length===0 ? <div className="text-sm text-zinc-500">No endpoints</div> : data.endpoints.map((e,i)=> (
            <div key={i} className="flex items-center gap-2 text-xs bg-white/[0.04] border border-white/5 rounded-lg px-2.5 py-2">
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${methodColor(e.method)}`}>{e.method}</span>
              <span className="text-zinc-300 truncate flex-1">{e.path}</span>
              <span className="text-zinc-500 truncate">{e.file.split('/').pop()}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-[#111119] border border-[#23232f] p-4">
        <div className="text-xs tracking-widest text-zinc-500 font-semibold mb-3">CLASSES & FUNCTIONS</div>
        <div className="text-xs text-zinc-500 mb-2">{data.classes.length} classes · {data.functions.length} functions</div>
        <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
          {data.classes.slice(0,20).map((c,i)=> (
            <div key={i} className="text-xs text-zinc-400"><span className="text-[#22d3ee]">class</span> {c.name} <span className="text-zinc-600">— {c.file}:{c.line}</span></div>
          ))}
          {data.functions.slice(0,20).map((f,i)=> (
            <div key={'f'+i} className="text-xs text-zinc-400"><span className="text-[#7c5cff]">fn</span> {f.name}() <span className="text-zinc-600">— {f.file}:{f.line}</span></div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Stat({label, value}:{label:string,value:any}) {
  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-lg px-3 py-2">
      <div className="text-[11px] text-zinc-500">{label}</div>
      <div className="text-lg font-semibold text-white">{value}</div>
    </div>
  )
}
function methodColor(m:string){
  switch(m){
    case 'GET': return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
    case 'POST': return 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
    case 'PUT': return 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
    case 'DELETE': return 'bg-red-500/20 text-red-400 border border-red-500/30'
    default: return 'bg-zinc-700 text-zinc-300'
  }
}
