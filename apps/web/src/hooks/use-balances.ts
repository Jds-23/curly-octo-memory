/**
 * Balances Hook - Better-T-Stack Web App
 *
 * React hooks for fetching EVM token balances using tRPC
 */

import { TokenFormatAdapter } from "@/lib/adapters/token-format-adapter";
import type { TokenWithBalance } from "@/types/token";
import { trpc } from "@/utils/trpc";

// Types based on the server API response structure
export interface DuneBalance {
	chain?: string;
	chain_id?: number;
	address: string;
	amount: string;
	balance?: string;
	value_usd?: number;
	symbol: string;
	name: string;
	decimals: number;
	logo?: string;
	price_usd?: number;
	liquidity?: any;
	low_liquidity?: boolean;
	pool_size?: number;
	token_metadata?: {
		logo?: string;
	};
}

export interface BalancesResponse {
	wallet_address: string;
	balances: DuneBalance[];
	type: "evm";
	timestamp: string;
	api_version: "v1";
}

export interface FilteredBalancesResponse extends BalancesResponse {
	original_count: number;
	filtered_count: number;
}

export interface BatchBalancesResponse {
	type: "evm";
	timestamp: string;
	api_version: "v1";
	results: Array<{
		address: string;
		status: "fulfilled" | "rejected";
		data: BalancesResponse | null;
		error: string | null;
	}>;
	total_addresses: number;
	successful_addresses: number;
}

export interface TokensResponse {
	tokens: Array<{
		address: string;
		symbol: string;
		name: string;
		decimals: number;
		chain_id: number;
		logo?: string;
		price_usd?: number;
		is_native?: boolean;
		verified?: boolean;
	}>;
	total: number;
	chain_ids: string;
	timestamp: string;
}

// Input types for hooks
export interface UseBalancesParams {
	address?: string | null;
	chain_ids?: string;
	filters?: "erc20" | "native";
	metadata?: string;
	historical_prices?: string;
	offset?: string;
	limit?: string;
}

export interface UseFilteredBalancesParams extends UseBalancesParams {
	minLiquidity?: number;
	requireCompleteName?: boolean;
	minPriceUsd?: number;
	allowLowLiquidity?: boolean;
}

export interface UseBatchBalancesParams {
	addresses?: string[];
	chain_ids?: string;
	filters?: "erc20" | "native";
	metadata?: string;
	historical_prices?: string;
	offset?: string;
	limit?: string;
}

export interface UseTokensParams {
	chain_ids?: string;
	limit?: string;
	search?: string;
}

/**
 * Hook to fetch balances for a single wallet address
 */
export function useBalances(params: UseBalancesParams) {
	return trpc.balances.getBalances.useQuery(
		{
			address: params.address!,
			chain_ids: params.chain_ids,
			filters: params.filters,
			metadata: params.metadata || "logo",
			historical_prices: params.historical_prices,
			offset: params.offset,
			limit: params.limit,
		},
		{
			enabled: Boolean(params.address),
			staleTime: 5 * 60 * 1000, // 5 minutes
			gcTime: 10 * 60 * 1000, // 10 minutes
			retry: (failureCount, error) => {
				// Don't retry on client errors
				if (
					error.data?.code === "BAD_REQUEST" ||
					error.data?.code === "UNAUTHORIZED"
				) {
					return false;
				}
				return failureCount < 3;
			},
		},
	);
}

/**
 * Hook to fetch filtered balances for a single wallet address
 */
export function useFilteredBalances(params: UseFilteredBalancesParams) {
	return trpc.balances.getFilteredBalances.useQuery(
		{
			address: params.address!,
			chain_ids: params.chain_ids,
			filters: params.filters,
			metadata: params.metadata || "logo",
			historical_prices: params.historical_prices,
			offset: params.offset,
			limit: params.limit,
			minLiquidity: params.minLiquidity,
			requireCompleteName: params.requireCompleteName,
			minPriceUsd: params.minPriceUsd,
			allowLowLiquidity: params.allowLowLiquidity,
		},
		{
			enabled: Boolean(params.address),
			staleTime: 5 * 60 * 1000, // 5 minutes
			gcTime: 10 * 60 * 1000, // 10 minutes
			retry: (failureCount, error) => {
				// Don't retry on client errors
				if (
					error.data?.code === "BAD_REQUEST" ||
					error.data?.code === "UNAUTHORIZED"
				) {
					return false;
				}
				return failureCount < 3;
			},
		},
	);
}

/**
 * Hook to fetch balances for multiple wallet addresses
 */
export function useBatchBalances(params: UseBatchBalancesParams) {
	return trpc.balances.getBatchBalances.useMutation({
		retry: (failureCount, error) => {
			// Don't retry on client errors
			if (
				error.data?.code === "BAD_REQUEST" ||
				error.data?.code === "UNAUTHORIZED"
			) {
				return false;
			}
			return failureCount < 3;
		},
	});
}

/**
 * Hook to fetch tokens by chain for search/selection
 */
export function useTokensByChain(params: UseTokensParams) {
	return trpc.balances.getTokensByChain.useQuery(
		{
			chain_ids: params.chain_ids,
			limit: params.limit || "100",
			search: params.search,
		},
		{
			staleTime: 30 * 60 * 1000, // 30 minutes (tokens don't change often)
			gcTime: 60 * 60 * 1000, // 1 hour
		},
	);
}

/**
 * Hook for EVM balances with sensible defaults
 */
export function useEvmBalances(
	address: string | null | undefined,
	options?: {
		chain_ids?: string;
		filters?: "erc20" | "native";
		metadata?: string;
		limit?: string;
		enableFiltering?: boolean;
		filterOptions?: {
			minLiquidity?: number;
			requireCompleteName?: boolean;
			minPriceUsd?: number;
			allowLowLiquidity?: boolean;
		};
	},
) {
	const {
		chain_ids,
		filters,
		metadata = "logo",
		limit,
		enableFiltering = false,
		filterOptions,
	} = options || {};

	const balancesQuery = enableFiltering
		? useFilteredBalances({
				address,
				chain_ids,
				filters,
				metadata,
				limit,
				...filterOptions,
			})
		: useBalances({
				address,
				chain_ids,
				filters,
				metadata,
				limit,
			});

	// Convert Dune balances to TokenWithBalance format
	const convertedBalances: TokenWithBalance[] =
		balancesQuery.data?.balances.map((balance) =>
			TokenFormatAdapter.balanceToTokenWithBalance({
				address: balance.address,
				symbol: balance.symbol,
				decimals: balance.decimals,
				name: balance.name,
				chain_id: balance.chain_id?.toString() || balance.chain || "1",
				amount: balance.amount || balance.balance || "0",
				value_usd: balance.value_usd || null,
				price_usd: balance.price_usd || null,
				token_metadata: {
					logo: balance.logo || balance.token_metadata?.logo,
					verified: true, // Assume Dune tokens are verified
				},
				low_liquidity: balance.low_liquidity,
			}),
		) || [];

	return {
		...balancesQuery,
		data: balancesQuery.data
			? {
					...balancesQuery.data,
					balances: convertedBalances,
				}
			: undefined,
		convertedBalances,
	};
}

/**
 * Hook to get popular/default tokens for a chain
 */
export function usePopularTokens(chainIds?: string, search?: string) {
	return useTokensByChain({
		chain_ids: chainIds || "1", // Default to Ethereum mainnet
		limit: "50",
		search,
	});
}

/**
 * Combined hook for both balances and popular tokens
 */
export function useTokensAndBalances(
	address: string | null | undefined,
	options?: {
		chain_ids?: string;
		enableFiltering?: boolean;
		filterOptions?: {
			minLiquidity?: number;
			requireCompleteName?: boolean;
			minPriceUsd?: number;
			allowLowLiquidity?: boolean;
		};
	},
) {
	const { chain_ids = "1", enableFiltering, filterOptions } = options || {};

	// Fetch user balances
	const balancesQuery = useEvmBalances(address, {
		chain_ids,
		enableFiltering,
		filterOptions,
	});

	// Fetch popular tokens
	const popularTokensQuery = usePopularTokens(chain_ids);

	// Convert popular tokens to Token format
	const popularTokens =
		popularTokensQuery.data?.tokens.map((token) =>
			TokenFormatAdapter.createMinimalToken(
				token.address,
				token.symbol,
				token.decimals,
				token.chain_id,
				token.name,
			),
		) || [];

	return {
		balances: balancesQuery,
		popularTokens: popularTokensQuery,
		allTokens: popularTokens,
		userBalances: balancesQuery.convertedBalances,
		isLoading: balancesQuery.isLoading || popularTokensQuery.isLoading,
		error: balancesQuery.error || popularTokensQuery.error,
	};
}
