import { decrypt, encrypt, sha256 } from '@/lib/crypto'

const STORAGE_KEY_PREFIX = 'starcoin_bridge_'
const getKey = (key: string) => sha256(STORAGE_KEY_PREFIX + key)
const storage = {
  async getItem<T = unknown>(key: string): Promise<T | null> {
    key = await getKey(key)
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return null
      return JSON.parse(await decrypt(raw)) as T
    } catch (error: unknown) {
      if (process.env.NODE_ENV === 'development') {
        console.error(error)
      }

      return null
    }
  },

  setItem: async function <T = unknown>(key: string, value: T): Promise<void> {
    key = await getKey(key)
    try {
      localStorage.setItem(key, await encrypt(JSON.stringify(value)))
    } catch (error: unknown) {
      if (process.env.NODE_ENV === 'development') {
        console.error(error)
      }
    }
  },

  removeItem: async function (key: string): Promise<void> {
    key = await getKey(key)
    try {
      localStorage.removeItem(key)
    } catch (e) {
      if (process.env.NODE_ENV === 'development') {
        console.error(e)
      }
    }
  },
}

export default storage
