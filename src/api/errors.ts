import axios from 'axios'

export function getApiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const d = err.response?.data
    if (d && typeof d === 'object' && 'detail' in d) {
      const detail = (d as { detail: unknown }).detail
      if (typeof detail === 'string') return detail
      if (Array.isArray(detail)) {
        return detail
          .map((x) => (typeof x === 'object' && x && 'msg' in x ? String((x as { msg: unknown }).msg) : JSON.stringify(x)))
          .join('; ')
      }
    }
    if (err.response?.status) {
      return `${err.response.status} ${err.message}`
    }
    return err.message
  }
  if (err instanceof Error) return err.message
  return String(err)
}
