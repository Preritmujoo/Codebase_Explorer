import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
})

export async function uploadZip(file: File) {
  const fd = new FormData()
  fd.append('file', file)
  const res = await api.post('/api/analyze', fd, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return res.data
}

export async function fetchAnalysis(id: string) {
  const res = await api.get(`/api/repository/${id}/analysis`)
  return res.data
}

export async function fetchFile(id: string, path: string) {
  const res = await api.get(`/api/repository/${id}/file`, { params: { path } })
  return res.data.content as string
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export async function getLlmStatus(): Promise<{ configured: boolean, default_model: string }> {
  const res = await api.get('/api/llm/status')
  return res.data
}

export async function askAI(messages: ChatMessage[], model?: string): Promise<{ content: string, model: string }> {
  const res = await api.post('/api/chat', { messages, model })
  return res.data
}

export async function askRepoChat(
  repoId: string,
  messages: ChatMessage[],
  opts?: { file_path?: string, include_structure?: boolean, model?: string },
): Promise<{ content: string, model: string }> {
  const res = await api.post(`/api/repository/${repoId}/chat`, { messages, ...opts })
  return res.data
}
