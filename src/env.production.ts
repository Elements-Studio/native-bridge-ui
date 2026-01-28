const indexerHost = 'https://bridge-indexer-monitor-dev2anvil.starswap.xyz'
const signHost = 'https://bridge-sign-monitor-dev2anvil.starswap.xyz'

export default {
  apis: {
    '/transfers': `${indexerHost}/transfers`,
    '/estimate_fees': `${indexerHost}/estimate_fees`,
    committees: {
      signs: [
        `${signHost}/bridge-node1-dev2anvil/sign`,
        `${signHost}/bridge-node2-dev2anvil/sign`,
        `${signHost}/bridge-node3-dev2anvil/sign`,
      ],
    },
  },
}
