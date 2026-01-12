const STORAGE_KEY_PREFIX = 'starcoin_bridge_'
const getKey = (key: string) => STORAGE_KEY_PREFIX + key
const storage = {
  getItem(key: string): string | null {
    key = getKey(key)
    try {
      return JSON.parse(localStorage.getItem(key) || 'null')
    } catch (e) {
      return null
    }
  },

  setItem(key: string, value: string): void {
    key = getKey(key)
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {}
  },

  removeItem(key: string): void {
    key = getKey(key)
    try {
      localStorage.removeItem(key)
    } catch {}
  },
}

export default storage
