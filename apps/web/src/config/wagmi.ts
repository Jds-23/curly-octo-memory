import { http, createConfig } from 'wagmi'
import { mainnet, sepolia, baseSepolia } from 'wagmi/chains'
import { injected, walletConnect } from 'wagmi/connectors'
import { porto } from 'porto/wagmi'

export const config = createConfig({
	chains: [mainnet, sepolia, baseSepolia],
	connectors: [
		injected(),
		porto(),
		walletConnect({
			projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '',
		}),
	],
	transports: {
		[mainnet.id]: http(),
		[sepolia.id]: http(),
		[baseSepolia.id]: http(),
	},
})