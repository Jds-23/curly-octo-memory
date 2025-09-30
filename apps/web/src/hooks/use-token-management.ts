/**
 * Token Management Hook for Better-T-Stack Web App
 *
 * Provides comprehensive token management functionality with multichain support
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useChainId } from "wagmi";
import {
	type SupportedChainId,
	SUPPORTED_CHAINS,
	getTokensForChain,
	searchTokens,
	getNativeToken,
	getWrappedToken,
	isSupportedChain,
	getChainInfo,
	TokenListManager,
} from "@/lib/tokens/multichain-tokens";
import type { Token } from "@/types/token";

export interface UseTokenManagementOptions {
	/** Include external token lists (Uniswap, etc.) */
	includeExternalLists?: boolean;
	/** Auto-fetch tokens when chain changes */
	autoFetch?: boolean;
	/** Default chains to search when no specific chain is selected */
	defaultChains?: SupportedChainId[];
}

export interface TokenManagementState {
	// Current state
	tokens: Token[];
	loading: boolean;
	error: string | null;
	currentChainId: SupportedChainId | null;

	// Available chains
	supportedChains: Array<{
		id: string;
		name: string;
		icon: string;
		chainId: SupportedChainId;
	}>;

	// Actions
	searchTokens: (query: string, chainIds?: SupportedChainId[]) => Token[];
	getTokensForChain: (chainId: SupportedChainId) => Promise<Token[]>;
	getNativeToken: (chainId?: SupportedChainId) => Token | undefined;
	getWrappedToken: (chainId?: SupportedChainId) => Token | undefined;
	refreshTokens: (chainId?: SupportedChainId) => Promise<void>;
}

/**
 * Hook for comprehensive token management
 */
export function useTokenManagement(
	options: UseTokenManagementOptions = {}
): TokenManagementState {
	const {
		includeExternalLists = true,
		autoFetch = true,
		defaultChains = [
			SUPPORTED_CHAINS.ETHEREUM,
			SUPPORTED_CHAINS.POLYGON,
			SUPPORTED_CHAINS.OPTIMISM,
			SUPPORTED_CHAINS.BASE,
			SUPPORTED_CHAINS.ARBITRUM,
		],
	} = options;

	const wagmiChainId = useChainId();
	const currentChainId = useMemo(() => {
		return isSupportedChain(wagmiChainId) ? wagmiChainId : null;
	}, [wagmiChainId]);

	// State
	const [tokens, setTokens] = useState<Token[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Supported chains for display
	const supportedChains = useMemo(() => {
		return Object.entries(SUPPORTED_CHAINS).map(([name, chainId]) => {
			const info = getChainInfo(chainId);
			return {
				id: chainId.toString(),
				name: info.displayName,
				icon: info.icon,
				chainId,
			};
		});
	}, []);

	// Search tokens across chains
	const searchTokensHandler = useCallback(
		(query: string, chainIds?: SupportedChainId[]): Token[] => {
			if (!query.trim()) return tokens;

			const chainsToSearch = chainIds || defaultChains;
			return searchTokens(query, chainsToSearch);
		},
		[tokens, defaultChains]
	);

	// Get tokens for specific chain
	const getTokensForChainHandler = useCallback(
		async (chainId: SupportedChainId): Promise<Token[]> => {
			try {
				if (includeExternalLists) {
					return await TokenListManager.getCombinedTokenList(chainId);
				} else {
					return getTokensForChain(chainId);
				}
			} catch (err) {
				console.warn(`Failed to get tokens for chain ${chainId}:`, err);
				// Fallback to common tokens
				return getTokensForChain(chainId);
			}
		},
		[includeExternalLists]
	);

	// Get native token for chain
	const getNativeTokenHandler = useCallback(
		(chainId?: SupportedChainId): Token | undefined => {
			const targetChainId = chainId || currentChainId;
			return targetChainId ? getNativeToken(targetChainId) : undefined;
		},
		[currentChainId]
	);

	// Get wrapped token for chain
	const getWrappedTokenHandler = useCallback(
		(chainId?: SupportedChainId): Token | undefined => {
			const targetChainId = chainId || currentChainId;
			return targetChainId ? getWrappedToken(targetChainId) : undefined;
		},
		[currentChainId]
	);

	// Refresh tokens for chain
	const refreshTokens = useCallback(
		async (chainId?: SupportedChainId) => {
			const targetChainId = chainId || currentChainId;
			if (!targetChainId) return;

			setLoading(true);
			setError(null);

			try {
				const chainTokens = await getTokensForChainHandler(targetChainId);
				setTokens(chainTokens);
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to fetch tokens");
			} finally {
				setLoading(false);
			}
		},
		[currentChainId, getTokensForChainHandler]
	);

	// Auto-fetch tokens when chain changes
	useEffect(() => {
		if (autoFetch && currentChainId) {
			refreshTokens(currentChainId);
		}
	}, [autoFetch, currentChainId, refreshTokens]);

	// Initialize with default tokens if no current chain
	useEffect(() => {
		if (!currentChainId && tokens.length === 0) {
			// Load tokens from all default chains
			const allDefaultTokens = defaultChains.flatMap(chainId =>
				getTokensForChain(chainId)
			);
			setTokens(allDefaultTokens);
		}
	}, [currentChainId, tokens.length, defaultChains]);

	return {
		// State
		tokens,
		loading,
		error,
		currentChainId,
		supportedChains,

		// Actions
		searchTokens: searchTokensHandler,
		getTokensForChain: getTokensForChainHandler,
		getNativeToken: getNativeTokenHandler,
		getWrappedToken: getWrappedTokenHandler,
		refreshTokens,
	};
}

/**
 * Simpler hook for just getting tokens for current chain
 */
export function useCurrentChainTokens() {
	const { tokens, loading, error, currentChainId, refreshTokens } = useTokenManagement({
		autoFetch: true,
		includeExternalLists: true,
	});

	return {
		tokens,
		loading,
		error,
		chainId: currentChainId,
		refresh: refreshTokens,
	};
}

/**
 * Hook for token search across all chains
 */
export function useTokenSearch() {
	const { searchTokens: search, supportedChains } = useTokenManagement({
		autoFetch: false,
		includeExternalLists: false, // Use local search for performance
	});

	const [query, setQuery] = useState("");
	const [selectedChains, setSelectedChains] = useState<SupportedChainId[]>([]);

	const results = useMemo(() => {
		if (!query.trim()) return [];
		return search(query, selectedChains.length > 0 ? selectedChains : undefined);
	}, [query, selectedChains, search]);

	return {
		query,
		setQuery,
		selectedChains,
		setSelectedChains,
		results,
		supportedChains,
	};
}