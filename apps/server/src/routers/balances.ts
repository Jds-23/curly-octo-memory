/**
 * Balances Router - Better-T-Stack Server
 *
 * Provides EVM token balances using Dune API
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, router } from "../lib/trpc";

// Environment variables
const DUNE_API_KEY = process.env.DUNE_SIM_API_KEY;
const DUNE_SIM_BASE_URL = "https://api.sim.dune.com";

// Types
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

export interface EvmBalancesResponse {
	wallet_address: string;
	balances: DuneBalance[];
}

// Input validation schemas
const getBalancesSchema = z.object({
	address: z
		.string()
		.regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM address format"),
	chain_ids: z.string().optional(),
	filters: z.enum(["erc20", "native"]).optional(),
	metadata: z.string().optional().default("logo"),
	historical_prices: z.string().optional(),
	offset: z.string().optional(),
	limit: z.string().optional(),
});

const batchBalancesSchema = z.object({
	addresses: z
		.array(
			z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid EVM address format"),
		)
		.min(1, "At least one address is required")
		.max(100, "Maximum 100 addresses allowed"),
	chain_ids: z.string().optional(),
	filters: z.enum(["erc20", "native"]).optional(),
	metadata: z.string().optional().default("logo"),
	historical_prices: z.string().optional(),
	offset: z.string().optional(),
	limit: z.string().optional(),
});

// Helper function to fetch EVM balances from Dune API
async function fetchEvmBalances(
	params: z.infer<typeof getBalancesSchema>,
): Promise<EvmBalancesResponse> {
	if (!DUNE_API_KEY) {
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: "Dune API key not configured",
		});
	}

	const url = new URL(`${DUNE_SIM_BASE_URL}/v1/evm/balances/${params.address}`);

	// Add query parameters
	if (params.chain_ids) url.searchParams.set("chain_ids", params.chain_ids);
	if (params.filters) url.searchParams.set("filters", params.filters);
	if (params.metadata) url.searchParams.set("metadata", params.metadata);
	if (params.historical_prices)
		url.searchParams.set("historical_prices", params.historical_prices);
	if (params.offset) url.searchParams.set("offset", params.offset);
	if (params.limit) url.searchParams.set("limit", params.limit);

	try {
		const response = await fetch(url.toString(), {
			method: "GET",
			headers: {
				"X-Sim-Api-Key": DUNE_API_KEY,
				"Content-Type": "application/json",
			},
		});

		if (!response.ok) {
			const errorText = await response.text();
			throw new TRPCError({
				code:
					response.status === 400
						? "BAD_REQUEST"
						: response.status === 401 || response.status === 403
							? "UNAUTHORIZED"
							: response.status === 404
								? "NOT_FOUND"
								: "INTERNAL_SERVER_ERROR",
				message: `Dune API error: ${response.status} - ${errorText}`,
			});
		}

		return await response.json();
	} catch (error) {
		if (error instanceof TRPCError) {
			throw error;
		}

		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: `Failed to fetch balances: ${error instanceof Error ? error.message : "Unknown error"}`,
		});
	}
}

// Advanced token filtering
function advancedTokenFilter(
	tokens: DuneBalance[],
	options: {
		minLiquidity?: number;
		requireCompleteName?: boolean;
		minPriceUsd?: number;
		allowLowLiquidity?: boolean;
	},
) {
	const {
		minLiquidity = 1000,
		requireCompleteName = true,
		minPriceUsd = 0.000001,
		allowLowLiquidity = false,
	} = options;

	return tokens.filter((token) => {
		// Check if token has complete metadata
		if (requireCompleteName && (!token.name || !token.symbol)) {
			return false;
		}

		// Check minimum price threshold
		if (token.price_usd && token.price_usd < minPriceUsd) {
			return false;
		}

		// Check liquidity requirements
		if (!allowLowLiquidity && token.low_liquidity) {
			return false;
		}

		if ((token.pool_size ?? 0) < minLiquidity) {
			return false;
		}

		if (!token.token_metadata?.logo && !token.logo) {
			return false;
		}

		return true;
	});
}

export const balancesRouter = router({
	// Get balances for a single address
	getBalances: publicProcedure
		.input(getBalancesSchema)
		.query(async ({ input }) => {
			const result = await fetchEvmBalances(input);

			return {
				wallet_address: result.wallet_address,
				balances: result.balances,
				type: "evm" as const,
				timestamp: new Date().toISOString(),
				api_version: "v1" as const,
			};
		}),

	// Get filtered balances for a single address
	getFilteredBalances: publicProcedure
		.input(
			getBalancesSchema.extend({
				minLiquidity: z.number().optional(),
				requireCompleteName: z.boolean().optional(),
				minPriceUsd: z.number().optional(),
				allowLowLiquidity: z.boolean().optional(),
			}),
		)
		.query(async ({ input }) => {
			const {
				minLiquidity,
				requireCompleteName,
				minPriceUsd,
				allowLowLiquidity,
				...balanceParams
			} = input;

			const result = await fetchEvmBalances(balanceParams);

			const filteredBalances = advancedTokenFilter(result.balances, {
				minLiquidity,
				requireCompleteName,
				minPriceUsd,
				allowLowLiquidity,
			});

			return {
				wallet_address: result.wallet_address,
				balances: filteredBalances,
				original_count: result.balances.length,
				filtered_count: filteredBalances.length,
				type: "evm" as const,
				timestamp: new Date().toISOString(),
				api_version: "v1" as const,
			};
		}),

	// Get balances for multiple addresses
	getBatchBalances: publicProcedure
		.input(batchBalancesSchema)
		.mutation(async ({ input }) => {
			const { addresses, ...params } = input;

			// Fetch balances for all addresses in parallel
			const results = await Promise.allSettled(
				addresses.map(async (address) => {
					return await fetchEvmBalances({ ...params, address });
				}),
			);

			const processedResults = results.map((result, index) => ({
				address: addresses[index],
				status: result.status,
				data: result.status === "fulfilled" ? result.value : null,
				error:
					result.status === "rejected"
						? result.reason instanceof TRPCError
							? result.reason.message
							: "Unknown error"
						: null,
			}));

			return {
				type: "evm" as const,
				timestamp: new Date().toISOString(),
				api_version: "v1" as const,
				results: processedResults,
				total_addresses: addresses.length,
				successful_addresses: processedResults.filter(
					(r) => r.status === "fulfilled",
				).length,
			};
		}),

	// Get token info for search/selection
	getTokensByChain: publicProcedure
		.input(
			z.object({
				chain_ids: z.string().optional(),
				limit: z.string().optional().default("100"),
				search: z.string().optional(),
			}),
		)
		.query(async ({ input }) => {
			// For now, we'll return popular tokens based on a hardcoded list
			// In a real implementation, you might want to fetch this from a token list API
			const popularTokens = [
				{
					address: "0xA0b86a33E6776808fA4a6E0816502ef05D7b8E7E",
					symbol: "ETH",
					name: "Ethereum",
					decimals: 18,
					chain_id: 1,
					logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",
					price_usd: 3000,
					is_native: true,
					verified: true,
				},
				{
					address: "0xA0B86a33E6776808FA4a6E0816502EF05D7B8E7F",
					symbol: "USDC",
					name: "USD Coin",
					decimals: 6,
					chain_id: 1,
					logo: "https://cryptologos.cc/logos/usd-coin-usdc-logo.png",
					price_usd: 1,
					verified: true,
				},
				{
					address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
					symbol: "USDT",
					name: "Tether USD",
					decimals: 6,
					chain_id: 1,
					logo: "https://cryptologos.cc/logos/tether-usdt-logo.png",
					price_usd: 1,
					verified: true,
				},
				{
					address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
					symbol: "UNI",
					name: "Uniswap",
					decimals: 18,
					chain_id: 1,
					logo: "https://cryptologos.cc/logos/uniswap-uni-logo.png",
					price_usd: 10,
					verified: true,
				},
				{
					address: "0x514910771AF9Ca656af840dff83E8264EcF986CA",
					symbol: "LINK",
					name: "Chainlink",
					decimals: 18,
					chain_id: 1,
					logo: "https://cryptologos.cc/logos/chainlink-link-logo.png",
					price_usd: 15,
					verified: true,
				},
			];

			let filteredTokens = popularTokens;

			// Apply search filter if provided
			if (input.search) {
				const searchLower = input.search.toLowerCase();
				filteredTokens = popularTokens.filter(
					(token) =>
						token.symbol.toLowerCase().includes(searchLower) ||
						token.name.toLowerCase().includes(searchLower) ||
						token.address.toLowerCase().includes(searchLower),
				);
			}

			// Apply limit
			const limit = Number.parseInt(input.limit || "100");
			filteredTokens = filteredTokens.slice(0, limit);

			return {
				tokens: filteredTokens,
				total: filteredTokens.length,
				chain_ids: input.chain_ids || "1",
				timestamp: new Date().toISOString(),
			};
		}),
});
