/**
 * Token Format Adapter for Better-T-Stack Web App
 *
 * Unified adapter for converting between different token formats used throughout the application.
 * This replaces scattered conversion logic with centralized, type-safe transformations.
 */

import { isAddress } from "viem";
import type { Token, TokenBalance, TokenWithBalance } from "@/types/token";

/**
 * Search input parsing result
 */
export interface SearchInput {
	term?: string;
	address?: string;
}

/**
 * Normalized chain ID format (always string)
 */
export type NormalizedChainId = string;

/**
 * Generic API token format for external APIs
 */
export interface ApiTokenData {
	address: string;
	chain_id: string;
	name: string;
	symbol: string;
	decimals: string | number; // API might return string or number
	icon?: string;
	logoURI?: string; // Alternative field name
	metadata?: {
		logoURI?: string;
		verified?: boolean;
		isNative?: boolean;
	};
}

/**
 * Balance data from external APIs
 */
export interface BalanceData {
	address: string;
	symbol: string;
	decimals: number;
	name: string;
	chain_id?: string;
	chain?: string;
	amount?: string;
	value_usd?: number;
	price_usd?: number;
	token_metadata?: {
		logo?: string;
		verified?: boolean;
	};
	low_liquidity?: boolean;
}

/**
 * Solana chain ID mapping constant
 */
export const SOLANA_CHAIN_ID = "solana";
export const SOLANA_AS_RELAY_NUM = 792703809;

/**
 * Token Format Adapter - handles all token format conversions
 */
export class TokenFormatAdapter {
	/**
	 * Normalize chain ID to consistent string format
	 */
	static normalizeChainId(chainId: number | string): NormalizedChainId {
		if (chainId === SOLANA_AS_RELAY_NUM || chainId === "792703809") {
			return SOLANA_CHAIN_ID;
		}
		return chainId.toString();
	}

	/**
	 * Convert API token data to unified Token format
	 */
	static apiTokenToToken(apiToken: ApiTokenData): Token {
		const chainId = TokenFormatAdapter.normalizeChainId(apiToken.chain_id);

		return {
			address: apiToken.address,
			symbol: apiToken.symbol,
			decimals:
				typeof apiToken.decimals === "string"
					? Number.parseInt(apiToken.decimals, 10)
					: apiToken.decimals,
			name: apiToken.name,
			chainId: chainId,
			icon: apiToken.icon || apiToken.logoURI || apiToken.metadata?.logoURI,
			isNative: apiToken.metadata?.isNative || false,
			tags: apiToken.metadata?.verified ? ["verified"] : undefined,
		};
	}

	/**
	 * Convert balance data to unified Token format
	 */
	static balanceToToken(balance: BalanceData): Token {
		const chainId = TokenFormatAdapter.normalizeChainId(
			balance.chain_id?.toString() || balance.chain || SOLANA_CHAIN_ID,
		);

		return {
			address: balance.address,
			symbol: balance.symbol,
			decimals: balance.decimals,
			name: balance.name,
			chainId: chainId,
			icon: balance.token_metadata?.logo,
			isNative:
				balance.address === "native" ||
				balance.address === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
			tags: balance.token_metadata?.verified ? ["verified"] : undefined,
		};
	}

	/**
	 * Convert balance data to TokenWithBalance format
	 */
	static balanceToTokenWithBalance(balance: BalanceData): TokenWithBalance {
		const baseToken = TokenFormatAdapter.balanceToToken(balance);

		return {
			...baseToken,
			amount: balance.amount || "0",
			valueUsd: balance.value_usd || null,
			priceUsd: balance.price_usd || null,
			metadata: {
				logo: balance.token_metadata?.logo,
				verified: balance.token_metadata?.verified,
			},
			lowLiquidity: balance.low_liquidity,
		};
	}

	/**
	 * Convert Token to TokenBalance format (for API compatibility)
	 */
	static tokenToTokenBalance(token: TokenWithBalance): TokenBalance {
		return {
			amount: token.amount,
			value_usd: token.valueUsd,
			price_usd: token.priceUsd,
			symbol: token.symbol,
			decimals: token.decimals,
			token_metadata: {
				logo: token.icon || token.metadata?.logo,
			},
			low_liquidity: token.lowLiquidity,
		};
	}

	/**
	 * Create a minimal token representation for quick operations
	 */
	static createMinimalToken(
		address: string,
		symbol: string,
		decimals: number,
		chainId: string | number,
		name?: string,
	): Token {
		return {
			address,
			symbol,
			decimals,
			name: name || symbol, // Fallback to symbol for name
			chainId: TokenFormatAdapter.normalizeChainId(chainId),
		};
	}

	/**
	 * Batch convert array of API tokens to tokens
	 */
	static apiTokensToTokens(apiTokens: ApiTokenData[]): Token[] {
		return apiTokens.map((apiToken) =>
			TokenFormatAdapter.apiTokenToToken(apiToken),
		);
	}

	/**
	 * Batch convert array of balances to tokens with balance
	 */
	static balancesToTokensWithBalance(
		balances: BalanceData[],
	): TokenWithBalance[] {
		return balances.map((balance) =>
			TokenFormatAdapter.balanceToTokenWithBalance(balance),
		);
	}

	/**
	 * Filter and convert balances with criteria
	 */
	static filterAndConvertBalances(
		balances: BalanceData[],
		options: {
			minValueUsd?: number;
			excludeZeroBalances?: boolean;
			chainId?: string;
			requireVerified?: boolean;
		} = {},
	): TokenWithBalance[] {
		let filtered = balances;

		// Filter by minimum USD value
		if (options.minValueUsd !== undefined) {
			filtered = filtered.filter(
				(b) => (b.value_usd || 0) >= options.minValueUsd!,
			);
		}

		// Exclude zero balances
		if (options.excludeZeroBalances) {
			filtered = filtered.filter((b) => Number.parseFloat(b.amount || "0") > 0);
		}

		// Filter by chain ID
		if (options.chainId) {
			const normalizedChainId = TokenFormatAdapter.normalizeChainId(
				options.chainId,
			);
			filtered = filtered.filter((b) => {
				const balanceChainId = TokenFormatAdapter.normalizeChainId(
					b.chain_id?.toString() || b.chain || SOLANA_CHAIN_ID,
				);
				return balanceChainId === normalizedChainId;
			});
		}

		// Require verified tokens
		if (options.requireVerified) {
			filtered = filtered.filter((b) => b.token_metadata?.verified === true);
		}

		return TokenFormatAdapter.balancesToTokensWithBalance(filtered);
	}
}

/**
 * Search Manager - handles search input parsing and validation
 */
export class SearchManager {
	/**
	 * Parse search input to determine if it's a term or address
	 */
	static parseSearchInput(input: string): SearchInput {
		if (!input || input.trim() === "") {
			return {};
		}

		const trimmed = input.trim();

		// Check if it looks like an Ethereum address (0x + 40 hex chars)
		if (isAddress(trimmed)) {
			return { address: trimmed };
		}

		// Check if it looks like a Solana address (32-44 base58 chars)
		if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(trimmed)) {
			return { address: trimmed };
		}

		// Otherwise treat as search term
		return { term: trimmed };
	}

	/**
	 * Build query parameters from search input
	 */
	static buildQueryParams(
		searchInput: SearchInput,
		chainIds: (number | string)[],
		options: {
			defaultList?: boolean;
			limit?: number;
			verified?: boolean;
		} = {},
	) {
		return {
			chainIds: chainIds.map((id) => SearchManager.normalizeChainId(id)),
			defaultList:
				searchInput.term || searchInput.address
					? false
					: (options.defaultList ?? true),
			limit: options.limit || 20,
			term: searchInput.term,
			address: searchInput.address,
			verified: options.verified,
		};
	}

	/**
	 * Create search filters for client-side filtering
	 */
	static createTokenFilter(searchTerm: string) {
		if (!searchTerm || searchTerm.trim() === "") {
			return () => true;
		}

		const term = searchTerm.toLowerCase().trim();

		return (token: Token): boolean => {
			return (
				token.symbol.toLowerCase().includes(term) ||
				token.name.toLowerCase().includes(term) ||
				token.address.toLowerCase().includes(term) ||
				(token.chainName || "").toLowerCase().includes(term) ||
				(token.tags || []).some((tag) => tag.toLowerCase().includes(term))
			);
		};
	}

	/**
	 * Normalize chain ID (proxy to TokenFormatAdapter)
	 */
	static normalizeChainId(chainId: number | string): string {
		return TokenFormatAdapter.normalizeChainId(chainId);
	}
}

/**
 * Type validation utilities
 */
export class TokenValidator {
	/**
	 * Validate that an object is a valid API token
	 */
	static isApiToken(value: unknown): value is ApiTokenData {
		return (
			typeof value === "object" &&
			value !== null &&
			"address" in value &&
			"symbol" in value &&
			"name" in value &&
			"chain_id" in value &&
			"decimals" in value
		);
	}

	/**
	 * Validate that an object is a valid balance data
	 */
	static isBalanceData(value: unknown): value is BalanceData {
		return (
			typeof value === "object" &&
			value !== null &&
			"address" in value &&
			"symbol" in value &&
			"decimals" in value &&
			"name" in value
		);
	}

	/**
	 * Validate API token array
	 */
	static validateApiTokens(tokens: unknown[]): ApiTokenData[] {
		return tokens.filter(TokenValidator.isApiToken);
	}

	/**
	 * Validate balance array
	 */
	static validateBalances(balances: unknown[]): BalanceData[] {
		return balances.filter(TokenValidator.isBalanceData);
	}

	/**
	 * Validate and normalize chain ID
	 */
	static validateChainId(chainId: unknown): string | null {
		if (typeof chainId === "string") {
			return TokenFormatAdapter.normalizeChainId(chainId);
		}
		if (typeof chainId === "number") {
			return TokenFormatAdapter.normalizeChainId(chainId);
		}
		return null;
	}
}
