/**
 * Multichain Token Data Integration for Better-T-Stack Web App
 *
 * Integrates with Uniswap SDK and other sources to provide comprehensive token data
 * across multiple chains (Ethereum, Polygon, Optimism, Base, Arbitrum)
 */

import { Token as UniswapToken } from "@uniswap/sdk-core";
import type { Address } from "viem";
import type { Token } from "@/types/token";

// Chain IDs for supported networks
export const SUPPORTED_CHAINS = {
	ETHEREUM: 1,
	POLYGON: 137,
	OPTIMISM: 10,
	BASE: 8453,
	ARBITRUM: 42161,
} as const;

export type SupportedChainId = typeof SUPPORTED_CHAINS[keyof typeof SUPPORTED_CHAINS];

// Chain metadata
export const CHAIN_INFO = {
	[SUPPORTED_CHAINS.ETHEREUM]: {
		name: "Ethereum",
		displayName: "Ethereum",
		icon: "🟦",
		explorerUrl: "https://etherscan.io",
		nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }
	},
	[SUPPORTED_CHAINS.POLYGON]: {
		name: "Polygon",
		displayName: "Polygon",
		icon: "🟣",
		explorerUrl: "https://polygonscan.com",
		nativeCurrency: { name: "Matic", symbol: "MATIC", decimals: 18 }
	},
	[SUPPORTED_CHAINS.OPTIMISM]: {
		name: "Optimism",
		displayName: "OP Mainnet",
		icon: "🔴",
		explorerUrl: "https://optimistic.etherscan.io",
		nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }
	},
	[SUPPORTED_CHAINS.BASE]: {
		name: "Base",
		displayName: "Base",
		icon: "🔵",
		explorerUrl: "https://basescan.org",
		nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }
	},
	[SUPPORTED_CHAINS.ARBITRUM]: {
		name: "Arbitrum",
		displayName: "Arbitrum One",
		icon: "🟠",
		explorerUrl: "https://arbiscan.io",
		nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }
	},
} as const;

// Common token addresses across chains
export const COMMON_TOKENS: Record<SupportedChainId, Token[]> = {
	[SUPPORTED_CHAINS.ETHEREUM]: [
		{
			address: "0x0000000000000000000000000000000000000000" as Address,
			symbol: "ETH",
			name: "Ether",
			decimals: 18,
			chainId: "1",
			isNative: true,
			icon: "https://cryptologos.cc/logos/ethereum-eth-logo.png",
			tags: ["native"]
		},
		{
			address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as Address,
			symbol: "WETH",
			name: "Wrapped Ether",
			decimals: 18,
			chainId: "1",
			icon: "https://cryptologos.cc/logos/ethereum-eth-logo.png",
			tags: ["wrapped"]
		},
		{
			address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48" as Address,
			symbol: "USDC",
			name: "USD Coin",
			decimals: 6,
			chainId: "1",
			icon: "https://cryptologos.cc/logos/usd-coin-usdc-logo.png",
			tags: ["stable", "verified"]
		},
		{
			address: "0xdac17f958d2ee523a2206206994597c13d831ec7" as Address,
			symbol: "USDT",
			name: "Tether USD",
			decimals: 6,
			chainId: "1",
			icon: "https://cryptologos.cc/logos/tether-usdt-logo.png",
			tags: ["stable", "verified"]
		},
		{
			address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984" as Address,
			symbol: "UNI",
			name: "Uniswap",
			decimals: 18,
			chainId: "1",
			icon: "https://cryptologos.cc/logos/uniswap-uni-logo.png",
			tags: ["governance", "verified"]
		},
	],
	[SUPPORTED_CHAINS.POLYGON]: [
		{
			address: "0x0000000000000000000000000000000000000000" as Address,
			symbol: "MATIC",
			name: "Polygon",
			decimals: 18,
			chainId: "137",
			isNative: true,
			icon: "https://cryptologos.cc/logos/polygon-matic-logo.png",
			tags: ["native"]
		},
		{
			address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619" as Address,
			symbol: "WETH",
			name: "Wrapped Ether",
			decimals: 18,
			chainId: "137",
			icon: "https://cryptologos.cc/logos/ethereum-eth-logo.png",
			tags: ["wrapped"]
		},
		{
			address: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359" as Address,
			symbol: "USDC",
			name: "USD Coin (PoS)",
			decimals: 6,
			chainId: "137",
			icon: "https://cryptologos.cc/logos/usd-coin-usdc-logo.png",
			tags: ["stable", "verified"]
		},
		{
			address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F" as Address,
			symbol: "USDT",
			name: "Tether USD (PoS)",
			decimals: 6,
			chainId: "137",
			icon: "https://cryptologos.cc/logos/tether-usdt-logo.png",
			tags: ["stable", "verified"]
		},
	],
	[SUPPORTED_CHAINS.OPTIMISM]: [
		{
			address: "0x0000000000000000000000000000000000000000" as Address,
			symbol: "ETH",
			name: "Ether",
			decimals: 18,
			chainId: "10",
			isNative: true,
			icon: "https://cryptologos.cc/logos/ethereum-eth-logo.png",
			tags: ["native"]
		},
		{
			address: "0x4200000000000000000000000000000000000006" as Address,
			symbol: "WETH",
			name: "Wrapped Ether",
			decimals: 18,
			chainId: "10",
			icon: "https://cryptologos.cc/logos/ethereum-eth-logo.png",
			tags: ["wrapped"]
		},
		{
			address: "0x7F5c764cBc14f9669B88837ca1490cCa17c31607" as Address,
			symbol: "USDC",
			name: "USD Coin",
			decimals: 6,
			chainId: "10",
			icon: "https://cryptologos.cc/logos/usd-coin-usdc-logo.png",
			tags: ["stable", "verified"]
		},
		{
			address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58" as Address,
			symbol: "USDT",
			name: "Tether USD",
			decimals: 6,
			chainId: "10",
			icon: "https://cryptologos.cc/logos/tether-usdt-logo.png",
			tags: ["stable", "verified"]
		},
	],
	[SUPPORTED_CHAINS.BASE]: [
		{
			address: "0x0000000000000000000000000000000000000000" as Address,
			symbol: "ETH",
			name: "Ether",
			decimals: 18,
			chainId: "8453",
			isNative: true,
			icon: "https://cryptologos.cc/logos/ethereum-eth-logo.png",
			tags: ["native"]
		},
		{
			address: "0x4200000000000000000000000000000000000006" as Address,
			symbol: "WETH",
			name: "Wrapped Ether",
			decimals: 18,
			chainId: "8453",
			icon: "https://cryptologos.cc/logos/ethereum-eth-logo.png",
			tags: ["wrapped"]
		},
		{
			address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913" as Address,
			symbol: "USDC",
			name: "USD Coin",
			decimals: 6,
			chainId: "8453",
			icon: "https://cryptologos.cc/logos/usd-coin-usdc-logo.png",
			tags: ["stable", "verified"]
		},
	],
	[SUPPORTED_CHAINS.ARBITRUM]: [
		{
			address: "0x0000000000000000000000000000000000000000" as Address,
			symbol: "ETH",
			name: "Ether",
			decimals: 18,
			chainId: "42161",
			isNative: true,
			icon: "https://cryptologos.cc/logos/ethereum-eth-logo.png",
			tags: ["native"]
		},
		{
			address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1" as Address,
			symbol: "WETH",
			name: "Wrapped Ether",
			decimals: 18,
			chainId: "42161",
			icon: "https://cryptologos.cc/logos/ethereum-eth-logo.png",
			tags: ["wrapped"]
		},
		{
			address: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8" as Address,
			symbol: "USDC",
			name: "USD Coin (Arb1)",
			decimals: 6,
			chainId: "42161",
			icon: "https://cryptologos.cc/logos/usd-coin-usdc-logo.png",
			tags: ["stable", "verified"]
		},
		{
			address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9" as Address,
			symbol: "USDT",
			name: "Tether USD",
			decimals: 6,
			chainId: "42161",
			icon: "https://cryptologos.cc/logos/tether-usdt-logo.png",
			tags: ["stable", "verified"]
		},
	],
};

/**
 * Convert our Token interface to Uniswap SDK Token
 */
export function toUniswapToken(token: Token): UniswapToken {
	return new UniswapToken(
		Number.parseInt(token.chainId),
		token.address as Address,
		token.decimals,
		token.symbol,
		token.name
	);
}

/**
 * Convert Uniswap SDK Token to our Token interface
 */
export function fromUniswapToken(uniswapToken: UniswapToken): Token {
	return {
		address: uniswapToken.address as Address,
		symbol: uniswapToken.symbol!,
		name: uniswapToken.name!,
		decimals: uniswapToken.decimals,
		chainId: uniswapToken.chainId.toString(),
	};
}

/**
 * Get tokens for a specific chain
 */
export function getTokensForChain(chainId: SupportedChainId): Token[] {
	return COMMON_TOKENS[chainId] || [];
}

/**
 * Get all tokens across all supported chains
 */
export function getAllTokens(): Token[] {
	return Object.values(COMMON_TOKENS).flat();
}

/**
 * Find a token by address and chain
 */
export function findToken(address: string, chainId: SupportedChainId): Token | undefined {
	return COMMON_TOKENS[chainId]?.find(
		token => token.address.toLowerCase() === address.toLowerCase()
	);
}

/**
 * Search tokens across all chains
 */
export function searchTokens(query: string, chainIds?: SupportedChainId[]): Token[] {
	const chains = chainIds || Object.keys(COMMON_TOKENS).map(Number) as SupportedChainId[];
	const searchTerm = query.toLowerCase();

	const results: Token[] = [];

	for (const chainId of chains) {
		const tokens = COMMON_TOKENS[chainId] || [];
		for (const token of tokens) {
			if (
				token.symbol.toLowerCase().includes(searchTerm) ||
				token.name.toLowerCase().includes(searchTerm) ||
				token.address.toLowerCase().includes(searchTerm)
			) {
				results.push(token);
			}
		}
	}

	return results;
}

/**
 * Get native token for a chain
 */
export function getNativeToken(chainId: SupportedChainId): Token | undefined {
	return COMMON_TOKENS[chainId]?.find(token => token.isNative);
}

/**
 * Get wrapped native token for a chain
 */
export function getWrappedToken(chainId: SupportedChainId): Token | undefined {
	return COMMON_TOKENS[chainId]?.find(token => token.tags?.includes("wrapped"));
}

/**
 * Check if a chain is supported
 */
export function isSupportedChain(chainId: number): chainId is SupportedChainId {
	return Object.values(SUPPORTED_CHAINS).includes(chainId as SupportedChainId);
}

/**
 * Get chain info for display
 */
export function getChainInfo(chainId: SupportedChainId) {
	return CHAIN_INFO[chainId];
}

/**
 * Token list integration - can be extended to fetch from external sources
 */
export class TokenListManager {
	private static cache: Map<string, Token[]> = new Map();

	/**
	 * Fetch tokens from Uniswap's default token list
	 */
	static async fetchUniswapTokenList(chainId: SupportedChainId): Promise<Token[]> {
		const cacheKey = `uniswap-${chainId}`;

		// Return cached result if available
		if (this.cache.has(cacheKey)) {
			return this.cache.get(cacheKey)!;
		}

		try {
			// Fetch from Uniswap's token list
			const response = await fetch('https://gateway.ipfs.io/ipns/tokens.uniswap.org');
			const tokenList = await response.json();

			const chainTokens = tokenList.tokens
				.filter((token: any) => token.chainId === chainId)
				.map((token: any): Token => ({
					address: token.address as Address,
					symbol: token.symbol,
					name: token.name,
					decimals: token.decimals,
					chainId: chainId.toString(),
					icon: token.logoURI,
					tags: token.tags,
				}));

			this.cache.set(cacheKey, chainTokens);
			return chainTokens;
		} catch (error) {
			console.warn(`Failed to fetch Uniswap token list for chain ${chainId}:`, error);
			// Fallback to common tokens
			return getTokensForChain(chainId);
		}
	}

	/**
	 * Get combined token list (common + external sources)
	 */
	static async getCombinedTokenList(chainId: SupportedChainId): Promise<Token[]> {
		const [commonTokens, uniswapTokens] = await Promise.allSettled([
			Promise.resolve(getTokensForChain(chainId)),
			this.fetchUniswapTokenList(chainId)
		]);

		const common = commonTokens.status === 'fulfilled' ? commonTokens.value : [];
		const external = uniswapTokens.status === 'fulfilled' ? uniswapTokens.value : [];

		// Merge and deduplicate by address
		const addressMap = new Map<string, Token>();

		// Common tokens have priority
		for (const token of common) {
			addressMap.set(token.address.toLowerCase(), token);
		}

		// Add external tokens if not already present
		for (const token of external) {
			if (!addressMap.has(token.address.toLowerCase())) {
				addressMap.set(token.address.toLowerCase(), token);
			}
		}

		return Array.from(addressMap.values());
	}
}