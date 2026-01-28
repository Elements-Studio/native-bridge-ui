import devEnv from './env.development'
import prodEnv from './env.production'
import type { Coins } from './types/domain'

const env = (process.env.NODE_ENV === 'development' ? devEnv : prodEnv) as { coins: Coins }

export default env
