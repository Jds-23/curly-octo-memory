import { type UseQueryOptions, useQuery } from "@tanstack/react-query";

// Re-export types for convenience
export interface CurrencyMetadata {
	logoURI?: string;
	verified?: boolean;
	isNative?: boolean;
}

export interface Currency {
	chainId: number;
	address: string;
	symbol: string;
	name: string;
	decimals: number;
	vmType: string;
	metadata: CurrencyMetadata;
}

export interface CurrenciesRequest {
	defaultList?: boolean;
	chainIds?: number[];
	term?: string;
	address?: string;
	currencyId?: string;
	tokens?: string[];
	verified?: boolean;
	limit?: number;
	includeAllChains?: boolean;
	useExternalSearch?: boolean;
	depositAddressOnly?: boolean;
}

// API Response types
interface CurrenciesResponse {
	success: boolean;
	currencies: Currency[];
	message: string;
}

interface CurrencyByAddressResponse {
	success: boolean;
	currencies: Currency[];
	currency: Currency | null;
	message: string;
}

// Constants
export const TOKEN_LIMIT = 50; // Default limit for token searches
const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3000";

// Helper function to make tRPC calls via fetch
async function callTRPC<T>(procedure: string, input: any): Promise<T> {
	const url = `${SERVER_URL}/trpc/${procedure}?input=${encodeURIComponent(JSON.stringify(input))}`;
	const response = await fetch(url, {
		method: "GET",
		headers: {
			"Content-Type": "application/json",
		},
	});

	if (!response.ok) {
		throw new Error(`HTTP ${response.status}: ${response.statusText}`);
	}

	const data = await response.json();
	return data.result.data;
}

// General currencies hook using direct HTTP call
export const useCurrencies = (
	params: CurrenciesRequest,
	options?: Omit<
		UseQueryOptions<CurrenciesResponse, Error>,
		"queryKey" | "queryFn"
	>,
) => {
	return useQuery({
		queryKey: ["currencies.getCurrencies", params],
		queryFn: () =>
			callTRPC<CurrenciesResponse>("currencies.getCurrencies", params),
		gcTime: 10 * 60 * 1000, // 10 minutes
		staleTime: 5 * 60 * 1000, // 5 minutes
		...options,
	});
};

// Search currencies by term
export const useSearchCurrencies = (
	term: string,
	chainIds?: number[],
	options?: Omit<
		UseQueryOptions<CurrenciesResponse, Error>,
		"queryKey" | "queryFn"
	>,
) => {
	return useQuery({
		queryKey: [
			"currencies.searchCurrencies",
			{ term, chainIds, limit: TOKEN_LIMIT },
		],
		queryFn: () =>
			callTRPC<CurrenciesResponse>("currencies.searchCurrencies", {
				term,
				chainIds,
				limit: TOKEN_LIMIT,
			}),
		enabled: term.length > 0,
		gcTime: 10 * 60 * 1000, // 10 minutes
		staleTime: 0, // Always refetch for search results
		...options,
	});
};

// Default currencies list
export const useDefaultCurrencies = (
	chainIds?: number[],
	limit = 100,
	options?: Omit<
		UseQueryOptions<CurrenciesResponse, Error>,
		"queryKey" | "queryFn"
	>,
) => {
	return useQuery({
		queryKey: ["currencies.getDefaultCurrencies", { chainIds, limit }],
		queryFn: () =>
			callTRPC<CurrenciesResponse>("currencies.getDefaultCurrencies", {
				chainIds,
				limit,
			}),
		gcTime: 30 * 60 * 1000, // 30 minutes (longer cache for default list)
		staleTime: 15 * 60 * 1000, // 15 minutes
		...options,
	});
};

// Get currency by address
export const useCurrencyByAddress = (
	address: string,
	chainId?: number,
	options?: Omit<
		UseQueryOptions<CurrencyByAddressResponse, Error>,
		"queryKey" | "queryFn"
	>,
) => {
	return useQuery({
		queryKey: ["currencies.getCurrencyByAddress", { address, chainId }],
		queryFn: () =>
			callTRPC<CurrencyByAddressResponse>("currencies.getCurrencyByAddress", {
				address,
				chainId,
			}),
		enabled: !!address,
		gcTime: 30 * 60 * 1000, // 30 minutes
		staleTime: 15 * 60 * 1000, // 15 minutes
		...options,
	});
};

// Get currencies by multiple token addresses
export const useCurrenciesByTokens = (
	tokens: string[],
	options?: Omit<
		UseQueryOptions<CurrenciesResponse, Error>,
		"queryKey" | "queryFn"
	>,
) => {
	return useQuery({
		queryKey: ["currencies.getCurrenciesByTokens", { tokens }],
		queryFn: () =>
			callTRPC<CurrenciesResponse>("currencies.getCurrenciesByTokens", {
				tokens,
			}),
		enabled: tokens.length > 0,
		gcTime: 20 * 60 * 1000, // 20 minutes
		staleTime: 10 * 60 * 1000, // 10 minutes
		...options,
	});
};

// Utility hook to get a single currency (returns the first match)
export const useSingleCurrency = (
	params: CurrenciesRequest,
	options?: Omit<
		UseQueryOptions<Currency | null, Error>,
		"queryKey" | "queryFn"
	>,
) => {
	const query = useCurrencies(params);

	return {
		...query,
		data: query.data?.currencies?.[0] || null,
	};
};

// Popular tokens for a specific chain
export const usePopularTokens = (
	chainId: number,
	limit = 20,
	options?: Omit<
		UseQueryOptions<CurrenciesResponse, Error>,
		"queryKey" | "queryFn"
	>,
) => {
	return useDefaultCurrencies([chainId], limit, options);
};

// Multi-chain search
export const useMultiChainSearch = (
	term: string,
	chainIds: number[],
	options?: Omit<
		UseQueryOptions<CurrenciesResponse, Error>,
		"queryKey" | "queryFn"
	>,
) => {
	return useSearchCurrencies(term, chainIds, {
		enabled: term.length > 2 && chainIds.length > 0, // Require at least 3 characters and some chains
		...options,
	});
};
