import { useState } from 'react'

export function UploadDropzone({ onUpload, loading }: { onUpload: (f:File)=>void, loading?: boolean }) {
  const [drag, setDrag] = useState(false)
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDrag(false)
    const f = e.dataTransfer.files[0]
    if (f) onUpload(f)
  }
  return (
    <div
      onDragOver={e=>{e.preventDefault(); setDrag(true)}}
      onDragLeave={()=>setDrag(false)}
      onDrop={handleDrop}
      className={`relative rounded-2xl border-2 border-dashed p-8 text-center transition ${drag ? 'border-[#7c5cff] bg-[#7c5cff]/10' : 'border-[#23232f] bg-[#111119] hover:border-[#7c5cff]/40'} ${loading ? 'opacity-60 pointer-events-none' : ''}`}
    >
      <div className="mx-auto w-12 h-12 rounded-xl bg-gradient-to-br from-[#7c5cff] to-[#22d3ee] flex items-center justify-center text-xl mb-3">⬆</div>
      <div className="text-white font-medium">Drag & drop your .zip repository</div>
      <div className="text-sm text-zinc-500 mt-1">or click to browse · max 50 MB</div>
      <label className="mt-4 inline-flex px-5 py-2 rounded-full bg-white text-black text-sm font-semibold cursor-pointer hover:bg-zinc-200 transition">
        Browse files
        <input type="file" accept=".zip" className="hidden" onChange={e=> e.target.files?.[0] && onUpload(e.target.files[0])} />
      </label>
      {loading && <div className="mt-4 text-sm text-[#7c5cff] animate-pulse">Analyzing repository...</div>}
    </div>
  )
}
