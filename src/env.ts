import devEvn from './env.development'
import prodEnv from './env.production'

const env = process.env.NODE_ENV === 'development' ? devEvn : prodEnv

export default env
