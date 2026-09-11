export type FileNode = {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
  lines?: number
  language?: string
  children?: FileNode[]
}
export type LanguageStat = { language: string; files: number; lines: number; color: string }
export type FrameworkInfo = { name: string; detected: boolean; evidence: string[] }
export type EndpointInfo = { path: string; method: string; file: string; function: string; framework: string; line: number }
export type GraphNode = { id: string; label: string; type: string; file?: string }
export type GraphEdge = { id: string; source: string; target: string; label?: string; type: string }
export type AnalysisResult = {
  id: string
  file_tree: FileNode
  languages: LanguageStat[]
  frameworks: FrameworkInfo[]
  dependencies: { ecosystem: string; file: string; packages: { name: string; version: string }[] }[]
  endpoints: EndpointInfo[]
  classes: { name: string; file: string; line: number; methods: string[]; bases: string[] }[]
  functions: { name: string; file: string; line: number; args: string[]; is_async: boolean }[]
  imports: { source: string; imported: string; file: string; line: number; is_local: boolean }[]
  graph: { nodes: GraphNode[]; edges: GraphEdge[] }
  stats: Record<string, any>
  file_count: number
  total_lines: number
}
