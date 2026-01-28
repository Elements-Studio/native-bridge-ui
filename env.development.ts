const indexerHost = '/api'

export default {
  apis: {
    '/transfers': `${indexerHost}/transfers`,
    '/estimate_fees': `${indexerHost}/estimate_fees`,
    committees: {
      signs: [`/api0/sign`, `/api1/sign`, `/api2/sign`],
    },
  },
}
