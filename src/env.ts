import devEnv from './env.development'
import prodEnv from './env.production'

const env = process.env.NODE_ENV === 'development' ? devEnv : prodEnv

export default env
