import { decrypt, encrypt, sha256 } from '@/lib/crypto'

const STORAGE_KEY_PREFIX = 'starcoin_bridge_'
const getKey = (key: string) => sha256(STORAGE_KEY_PREFIX + key)
const storage = {
  async getItem<T = any>(key: string): Promise<T | null> {
    key = await getKey(key)
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return null
      return JSON.parse(await decrypt(raw))
    } catch (e) {
      if (process.env.NODE_ENV === 'development') {
        console.error(e)
      }

      return null
    }
  },

  setItem: async function (key: string, value: any): Promise<void> {
    key = await getKey(key)
    try {
      localStorage.setItem(key, await encrypt(JSON.stringify(value)))
    } catch (e) {
      if (process.env.NODE_ENV === 'development') {
        console.error(e)
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
