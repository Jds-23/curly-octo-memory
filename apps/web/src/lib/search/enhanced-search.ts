/**
 * Enhanced Search and Filtering System - Better-T-Stack Web App
 *
 * Provides advanced search capabilities including fuzzy matching,
 * filtering, suggestions, and search history for the TokenSelector.
 */

import type { Token, TokenWithBalance } from "@/types/token";

/**
 * Search result with relevance scoring
 */
export interface SearchResult {
	token: Token | TokenWithBalance;
	score: number; // 0-1, higher is more relevant
	matchedFields: string[]; // Which fields matched the search
	exactMatch: boolean;
}

/**
 * Search suggestion
 */
export interface SearchSuggestion {
	text: string;
	category?: string;
	score?: number;
}

/**
 * Search history item
 */
export interface SearchHistoryItem {
	query: string;
	timestamp: number;
	count: number;
}

/**
 * Advanced filter options
 */
export interface AdvancedFilters {
	// Price filters
	priceRange?: {
		min?: number;
		max?: number;
	};

	// Balance filters
	balanceRange?: {
		min?: number;
		max?: number;
	};

	// Token properties
	verifiedOnly?: boolean;
	nativeOnly?: boolean;
	hasBalance?: boolean;
	excludeLowLiquidity?: boolean;

	// Tags and categories
	tags?: string[];
	excludeTags?: string[];
	categories?: TokenCategory[];

	// Chain filters
	chains?: string[];
	chainIds?: string[];
}

/**
 * Token categories for classification
 */
export enum TokenCategory {
	STABLECOIN = "stablecoin",
	DEFI = "defi",
	GOVERNANCE = "governance",
	YIELD = "yield",
	DEX = "dex",
	LENDING = "lending",
	BRIDGE = "bridge",
	GAMING = "gaming",
	NFT = "nft",
	SOCIAL = "social",
	INFRASTRUCTURE = "infrastructure",
	OTHER = "other",
}

/**
 * Enhanced Search Engine
 */
export class EnhancedSearchEngine {
	private static readonly SEARCH_HISTORY_KEY = "tokenSelector_searchHistory";
	private static readonly RECENTLY_SELECTED_KEY =
		"tokenSelector_recentlySelected";
	private static readonly MAX_HISTORY_ITEMS = 20;
	private static readonly MAX_RECENTLY_SELECTED = 10;

	/**
	 * Search tokens with fuzzy matching and scoring
	 */
	searchTokens(
		tokens: (Token | TokenWithBalance)[],
		query: string,
		options: {
			enableFuzzy?: boolean;
			enableSmartRanking?: boolean;
			threshold?: number;
			maxResults?: number;
		} = {},
	): SearchResult[] {
		const {
			enableFuzzy = true,
			enableSmartRanking = true,
			threshold = 0.1,
			maxResults = 50,
		} = options;

		if (!query.trim()) {
			return tokens.map((token) => ({
				token,
				score: 0.5,
				matchedFields: [],
				exactMatch: false,
			}));
		}

		const queryLower = query.toLowerCase();
		const results: SearchResult[] = [];

		for (const token of tokens) {
			let maxScore = 0;
			const matchedFields: string[] = [];
			let exactMatch = false;

			// Symbol matching (highest priority)
			const symbolScore = this.calculateFieldScore(
				token.symbol,
				queryLower,
				enableFuzzy,
			);
			if (symbolScore > 0) {
				maxScore = Math.max(maxScore, symbolScore * 1.0);
				matchedFields.push("symbol");
				if (token.symbol.toLowerCase() === queryLower) {
					exactMatch = true;
				}
			}

			// Name matching
			const nameScore = this.calculateFieldScore(
				token.name,
				queryLower,
				enableFuzzy,
			);
			if (nameScore > 0) {
				maxScore = Math.max(maxScore, nameScore * 0.8);
				matchedFields.push("name");
				if (token.name.toLowerCase() === queryLower) {
					exactMatch = true;
				}
			}

			// Address matching
			const addressScore = this.calculateFieldScore(
				token.address,
				queryLower,
				false,
			);
			if (addressScore > 0) {
				maxScore = Math.max(maxScore, addressScore * 0.9);
				matchedFields.push("address");
				if (token.address.toLowerCase() === queryLower) {
					exactMatch = true;
				}
			}

			// Chain name matching
			if (token.chainName) {
				const chainScore = this.calculateFieldScore(
					token.chainName,
					queryLower,
					enableFuzzy,
				);
				if (chainScore > 0) {
					maxScore = Math.max(maxScore, chainScore * 0.6);
					matchedFields.push("chainName");
				}
			}

			// Tag matching
			if (token.tags) {
				for (const tag of token.tags) {
					const tagScore = this.calculateFieldScore(
						tag,
						queryLower,
						enableFuzzy,
					);
					if (tagScore > 0) {
						maxScore = Math.max(maxScore, tagScore * 0.7);
						matchedFields.push("tags");
					}
				}
			}

			if (maxScore >= threshold) {
				results.push({
					token,
					score: Math.min(maxScore, 1),
					matchedFields,
					exactMatch,
				});
			}
		}

		return results
			.sort((a, b) => {
				// Exact matches first
				if (a.exactMatch && !b.exactMatch) return -1;
				if (!a.exactMatch && b.exactMatch) return 1;
				// Then by score
				return b.score - a.score;
			})
			.slice(0, maxResults);
	}

	/**
	 * Apply advanced filters to tokens
	 */
	applyAdvancedFilters(
		tokens: (Token | TokenWithBalance)[],
		filters: AdvancedFilters,
	): (Token | TokenWithBalance)[] {
		let filtered = [...tokens];

		// Price range filter
		if (
			filters.priceRange?.min !== undefined ||
			filters.priceRange?.max !== undefined
		) {
			filtered = filtered.filter((token) => {
				if ("priceUsd" in token && token.priceUsd !== null) {
					const price = token.priceUsd;
					if (
						filters.priceRange?.min !== undefined &&
						price < filters.priceRange.min
					)
						return false;
					if (
						filters.priceRange?.max !== undefined &&
						price > filters.priceRange.max
					)
						return false;
				}
				return true;
			});
		}

		// Balance range filter
		if (
			filters.balanceRange?.min !== undefined ||
			filters.balanceRange?.max !== undefined
		) {
			filtered = filtered.filter((token) => {
				if ("valueUsd" in token && token.valueUsd !== null) {
					const balance = token.valueUsd;
					if (
						filters.balanceRange?.min !== undefined &&
						balance < filters.balanceRange.min
					)
						return false;
					if (
						filters.balanceRange?.max !== undefined &&
						balance > filters.balanceRange.max
					)
						return false;
				}
				return true;
			});
		}

		// Verified only filter
		if (filters.verifiedOnly) {
			filtered = filtered.filter((token) => token.tags?.includes("verified"));
		}

		// Native only filter
		if (filters.nativeOnly) {
			filtered = filtered.filter((token) => token.isNative === true);
		}

		// Has balance filter
		if (filters.hasBalance) {
			filtered = filtered.filter((token) => {
				if ("amount" in token) {
					return Number.parseFloat(token.amount) > 0;
				}
				return false;
			});
		}

		// Exclude low liquidity filter
		if (filters.excludeLowLiquidity) {
			filtered = filtered.filter((token) => {
				if ("lowLiquidity" in token) {
					return !token.lowLiquidity;
				}
				return true;
			});
		}

		// Chain filters
		if (filters.chains?.length || filters.chainIds?.length) {
			const allowedChains = [
				...(filters.chains || []),
				...(filters.chainIds || []),
			];
			filtered = filtered.filter((token) =>
				allowedChains.includes(token.chainId),
			);
		}

		// Category filters
		if (filters.categories?.length) {
			filtered = filtered.filter((token) => {
				if (!token.tags) return false;
				return filters.categories!.some((category) =>
					token.tags!.includes(category.toLowerCase()),
				);
			});
		}

		return filtered;
	}

	/**
	 * Generate search suggestions
	 */
	static generateSuggestions(query: string): SearchSuggestion[] {
		if (!query.trim()) return [];

		const suggestions: SearchSuggestion[] = [];
		const queryLower = query.toLowerCase();

		// Common token suggestions
		const commonTokens = ["eth", "btc", "usdc", "usdt", "uni", "link", "dai"];
		for (const token of commonTokens) {
			if (token.includes(queryLower)) {
				suggestions.push({
					text: token.toUpperCase(),
					category: "token",
					score: 0.9,
				});
			}
		}

		// Category suggestions
		const categories = Object.values(TokenCategory);
		for (const category of categories) {
			if (category.includes(queryLower)) {
				suggestions.push({
					text: category,
					category: "category",
					score: 0.7,
				});
			}
		}

		return suggestions.slice(0, 5);
	}

	/**
	 * Search history management
	 */
	static getSearchHistory(): SearchHistoryItem[] {
		try {
			const stored = localStorage.getItem(
				EnhancedSearchEngine.SEARCH_HISTORY_KEY,
			);
			return stored ? JSON.parse(stored) : [];
		} catch {
			return [];
		}
	}

	static addToSearchHistory(query: string): void {
		try {
			const history = EnhancedSearchEngine.getSearchHistory();
			const existing = history.find((item) => item.query === query);

			if (existing) {
				existing.count++;
				existing.timestamp = Date.now();
			} else {
				history.unshift({
					query,
					timestamp: Date.now(),
					count: 1,
				});
			}

			// Keep only recent items
			const trimmed = history
				.sort((a, b) => b.timestamp - a.timestamp)
				.slice(0, EnhancedSearchEngine.MAX_HISTORY_ITEMS);

			localStorage.setItem(
				EnhancedSearchEngine.SEARCH_HISTORY_KEY,
				JSON.stringify(trimmed),
			);
		} catch {
			// Ignore localStorage errors
		}
	}

	static clearSearchHistory(): void {
		try {
			localStorage.removeItem(EnhancedSearchEngine.SEARCH_HISTORY_KEY);
		} catch {
			// Ignore localStorage errors
		}
	}

	/**
	 * Recently selected tokens management
	 */
	static getRecentlySelected(): (Token | TokenWithBalance)[] {
		try {
			const stored = localStorage.getItem(
				EnhancedSearchEngine.RECENTLY_SELECTED_KEY,
			);
			return stored ? JSON.parse(stored) : [];
		} catch {
			return [];
		}
	}

	static addToRecentlySelected(token: Token | TokenWithBalance): void {
		try {
			const recent = EnhancedSearchEngine.getRecentlySelected();
			const tokenId = `${token.chainId}-${token.address}`;

			// Remove if already exists
			const filtered = recent.filter(
				(t) => `${t.chainId}-${t.address}` !== tokenId,
			);

			// Add to front
			filtered.unshift(token);

			// Keep only recent items
			const trimmed = filtered.slice(
				0,
				EnhancedSearchEngine.MAX_RECENTLY_SELECTED,
			);

			localStorage.setItem(
				EnhancedSearchEngine.RECENTLY_SELECTED_KEY,
				JSON.stringify(trimmed),
			);
		} catch {
			// Ignore localStorage errors
		}
	}

	/**
	 * Calculate field matching score
	 */
	private calculateFieldScore(
		field: string,
		query: string,
		enableFuzzy: boolean,
	): number {
		const fieldLower = field.toLowerCase();

		// Exact match
		if (fieldLower === query) return 1.0;

		// Starts with
		if (fieldLower.startsWith(query)) return 0.9;

		// Contains
		if (fieldLower.includes(query)) return 0.7;

		// Fuzzy matching
		if (enableFuzzy) {
			const fuzzyScore = this.calculateFuzzyScore(fieldLower, query);
			if (fuzzyScore > 0.6) return fuzzyScore * 0.5;
		}

		return 0;
	}

	/**
	 * Calculate fuzzy matching score
	 */
	private calculateFuzzyScore(text: string, query: string): number {
		if (query.length === 0) return 1;
		if (text.length === 0) return 0;

		const textChars = text.split("");
		const queryChars = query.split("");
		let matches = 0;
		let queryIndex = 0;

		for (const char of textChars) {
			if (queryIndex < queryChars.length && char === queryChars[queryIndex]) {
				matches++;
				queryIndex++;
			}
		}

		return matches / query.length;
	}
}
