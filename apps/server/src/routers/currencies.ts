import { z } from "zod";
import { publicProcedure, router } from "../lib/trpc";

const RELAY_API_BASE_URL = "https://api.relay.link";

// Types and interfaces
interface CurrencyMetadata {
	logoURI?: string;
	verified?: boolean;
	isNative?: boolean;
}

interface ApiCurrency {
	chainId: number;
	address: string;
	symbol: string;
	name: string;
	decimals: number;
	vmType: string;
	metadata: CurrencyMetadata;
}

interface CurrenciesRequest {
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

// Helper function to call Relay API
async function fetchCurrencies(params: CurrenciesRequest): Promise<ApiCurrency[]> {
	const response = await fetch(`${RELAY_API_BASE_URL}/currencies/v2`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(params),
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Relay API error: ${response.status} ${response.statusText} - ${errorText}`);
	}

	return response.json() as Promise<ApiCurrency[]>;
}

// Input validation schemas
const currenciesInputSchema = z.object({
	defaultList: z.boolean().optional(),
	chainIds: z.array(z.number()).optional(),
	term: z.string().optional(),
	address: z.string().optional(),
	currencyId: z.string().optional(),
	tokens: z.array(z.string()).optional(),
	verified: z.boolean().optional(),
	limit: z.number().min(1).max(100).optional(),
	includeAllChains: z.boolean().optional(),
	useExternalSearch: z.boolean().optional(),
	depositAddressOnly: z.boolean().optional(),
});

const searchCurrenciesInputSchema = z.object({
	term: z.string().min(1, "Search term is required"),
	chainIds: z.array(z.number()).optional(),
	limit: z.number().min(1).max(100).default(50),
});

const defaultCurrenciesInputSchema = z.object({
	chainIds: z.array(z.number()).optional(),
	limit: z.number().min(1).max(100).default(100),
});

const currencyByAddressInputSchema = z.object({
	address: z.string().min(1, "Address is required"),
	chainId: z.number().optional(),
});

// tRPC router
export const currenciesRouter: any = router({
	// General currencies query
	getCurrencies: publicProcedure
		.input(currenciesInputSchema)
		.query(async ({ input }) => {
			try {
				const currencies = await fetchCurrencies(input);
				return {
					success: true,
					currencies,
					message: `Found ${currencies.length} currencies`,
				} as {
					success: boolean;
					currencies: any[];
					message: string;
				};
			} catch (error) {
				console.error("Error fetching currencies:", error);
				return {
					success: false,
					currencies: [],
					message: `Error fetching currencies: ${error instanceof Error ? error.message : "Unknown error"}`,
				} as any;
			}
		}),

	// Search currencies by term
	searchCurrencies: publicProcedure
		.input(searchCurrenciesInputSchema)
		.query(async ({ input }) => {
			try {
				const { term, chainIds, limit } = input;
				const currencies = await fetchCurrencies({
					term,
					chainIds,
					verified: true,
					limit,
					includeAllChains: true,
				});

				return {
					success: true,
					currencies,
					message: `Found ${currencies.length} currencies for "${term}"`,
				};
			} catch (error) {
				console.error("Error searching currencies:", error);
				return {
					success: false,
					currencies: [],
					message: `Error searching currencies: ${error instanceof Error ? error.message : "Unknown error"}`,
				};
			}
		}),

	// Get default currency list
	getDefaultCurrencies: publicProcedure
		.input(defaultCurrenciesInputSchema)
		.query(async ({ input }) => {
			try {
				const { chainIds, limit } = input;
				const currencies = await fetchCurrencies({
					defaultList: true,
					chainIds,
					verified: true,
					limit,
				});

				return {
					success: true,
					currencies,
					message: `Found ${currencies.length} default currencies`,
				};
			} catch (error) {
				console.error("Error fetching default currencies:", error);
				return {
					success: false,
					currencies: [],
					message: `Error fetching default currencies: ${error instanceof Error ? error.message : "Unknown error"}`,
				};
			}
		}),

	// Get currency by address
	getCurrencyByAddress: publicProcedure
		.input(currencyByAddressInputSchema)
		.query(async ({ input }) => {
			try {
				const { address, chainId } = input;
				const currencies = await fetchCurrencies({
					address,
					chainIds: chainId ? [chainId] : undefined,
					includeAllChains: true,
				});

				return {
					success: true,
					currencies,
					currency: currencies[0] || null,
					message: currencies.length > 0 ? "Currency found" : "Currency not found",
				};
			} catch (error) {
				console.error("Error fetching currency by address:", error);
				return {
					success: false,
					currencies: [],
					currency: null,
					message: `Error fetching currency: ${error instanceof Error ? error.message : "Unknown error"}`,
				};
			}
		}),

	// Get currencies by multiple token addresses
	getCurrenciesByTokens: publicProcedure
		.input(
			z.object({
				tokens: z.array(z.string()).min(1, "At least one token address is required"),
			})
		)
		.query(async ({ input }) => {
			try {
				const { tokens } = input;
				const currencies = await fetchCurrencies({
					tokens,
					includeAllChains: true,
				});

				return {
					success: true,
					currencies,
					message: `Found ${currencies.length} currencies from ${tokens.length} token addresses`,
				};
			} catch (error) {
				console.error("Error fetching currencies by tokens:", error);
				return {
					success: false,
					currencies: [],
					message: `Error fetching currencies: ${error instanceof Error ? error.message : "Unknown error"}`,
				};
			}
		}),
});