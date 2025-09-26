import { porto } from "porto/wagmi";
import { createConfig, http } from "wagmi";
import { baseSepolia, mainnet, sepolia } from "wagmi/chains";
import { injected, walletConnect } from "wagmi/connectors";

export const config = createConfig({
	chains: [mainnet, sepolia, baseSepolia],
	connectors: [
		injected(),
		porto(),
		walletConnect({
			projectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "",
		}),
	],
	transports: {
		[mainnet.id]: http(),
		[sepolia.id]: http(),
		[baseSepolia.id]: http(),
	},
});
