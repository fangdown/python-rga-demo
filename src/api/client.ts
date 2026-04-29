import axios from 'axios'

function defaultBaseURL(): string {
  return 'https://api.fangdu.chat/python/api/v1/rag'
}

export function getRagBaseURL(): string {
  const raw = import.meta.env.VITE_RAG_BASE_URL as string | undefined
  const u = (raw && raw.trim()) || defaultBaseURL()
  return u.replace(/\/$/, '')
}

export const ragClient = axios.create({
  baseURL: getRagBaseURL(),
})
