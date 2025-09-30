import { porto } from "porto/wagmi";
import { createConfig, http } from "wagmi";
import { arbitrum, base, mainnet, optimism, polygon, sepolia } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";

export const config = createConfig({
	chains: [mainnet, polygon, optimism, base, arbitrum, sepolia],
	connectors: [
		injected(),
		porto(),
		walletConnect({
			projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "",
		}),
	],
	transports: {
		[mainnet.id]: http(),
		[polygon.id]: http(),
		[optimism.id]: http(),
		[base.id]: http(),
		[arbitrum.id]: http(),
		[sepolia.id]: http(),
	},
});
