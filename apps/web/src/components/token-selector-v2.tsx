/**
 * TokenSelectorV2 - Enhanced Token Selection Component for Better-T-Stack Web App
 *
 * Modern, performant token selector with advanced search, filtering, and error handling
 */

import { AlertCircle, Loader2, Wifi, WifiOff, X } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
	ErrorUtils,
	TokenSelectorErrorFactory,
	useTokenSelectorErrors,
} from "@/lib/errors/token-selector-errors";
import {
	type AdvancedFilters,
	EnhancedSearchEngine,
	TokenCategory,
} from "@/lib/search/enhanced-search";
import { cn } from "@/lib/utils";
import type { Token, TokenWithBalance } from "@/types/token";
import { TokenUtils } from "@/types/token";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { EnhancedSearchInput } from "./ui/enhanced-search-input";
import { SimpleTokenList, type TokenListItem } from "./ui/simple-token-list";
import { TokenFilterPanel } from "./ui/token-filter-panel";

export interface TokenSelectorV2Props {
	// Core Props
	isOpen: boolean;
	onClose: () => void;
	onTokenSelect: (token: Token | TokenWithBalance) => void;
	selectedToken?: Token | TokenWithBalance;

	// Data Props
	tokens?: Token[];
	balances?: TokenWithBalance[];
	loading?: boolean;
	error?: Error;

	// Configuration
	title?: string;
	subtitle?: string;
	className?: string;
	showBalances?: boolean;
	showFavorites?: boolean;
	enableFilters?: boolean;
	enableHistory?: boolean;
	maxHeight?: number;

	// Chain Configuration
	supportedChains?: Array<{ id: string; name: string; icon?: string }>;
	currentChainId?: string;

	// Event Handlers
	onSearchChange?: (query: string) => void;
	onFiltersChange?: (filters: AdvancedFilters) => void;
	onRefresh?: () => void;
	onToggleFavorite?: (token: Token | TokenWithBalance) => void;

	// Feature Flags
	enableVirtualization?: boolean;
	enableOfflineMode?: boolean;
}

export function TokenSelectorV2({
	isOpen,
	onClose,
	onTokenSelect,
	selectedToken,
	tokens = [],
	balances = [],
	loading = false,
	error,
	title = "Select Token",
	subtitle,
	className,
	showBalances = true,
	showFavorites = true,
	enableFilters = true,
	enableHistory = true,
	maxHeight = 600,
	supportedChains = [],
	currentChainId,
	onSearchChange,
	onFiltersChange,
	onRefresh,
	onToggleFavorite,
	enableVirtualization = true,
	enableOfflineMode = false,
}: TokenSelectorV2Props) {
	// State Management
	const [searchQuery, setSearchQuery] = useState("");
	const [filters, setFilters] = useState<AdvancedFilters>({});
	const [showFiltersPanel, setShowFiltersPanel] = useState(false);
	const [favoriteTokens, setFavoriteTokens] = useState<Set<string>>(new Set());
	const [isOffline, setIsOffline] = useState(false);

	// Error Management
	const {
		addError,
		removeError,
		clearErrors,
		getErrorState,
		getErrorsForDisplay,
	} = useTokenSelectorErrors();

	// Enhanced Search Engine
	const searchEngine = useMemo(() => new EnhancedSearchEngine(), []);

	// Load favorites from localStorage
	useEffect(() => {
		try {
			const stored = localStorage.getItem("tokenSelector_favorites");
			if (stored) {
				setFavoriteTokens(new Set(JSON.parse(stored)));
			}
		} catch (err) {
			console.warn("Failed to load favorite tokens:", err);
		}
	}, []);

	// Save favorites to localStorage
	const saveFavorites = useCallback((favorites: Set<string>) => {
		try {
			localStorage.setItem(
				"tokenSelector_favorites",
				JSON.stringify([...favorites]),
			);
		} catch (err) {
			console.warn("Failed to save favorite tokens:", err);
		}
	}, []);

	// Monitor online/offline status
	useEffect(() => {
		if (!enableOfflineMode) return;

		const handleOnline = () => setIsOffline(false);
		const handleOffline = () => setIsOffline(true);

		window.addEventListener("online", handleOnline);
		window.addEventListener("offline", handleOffline);

		setIsOffline(!navigator.onLine);

		return () => {
			window.removeEventListener("online", handleOnline);
			window.removeEventListener("offline", handleOffline);
		};
	}, [enableOfflineMode]);

	// Handle errors
	useEffect(() => {
		if (error) {
			const tokenError = TokenSelectorErrorFactory.createNetworkError(error);
			addError(tokenError);
		}
	}, [error, addError]);

	// Combine and process tokens
	const allTokens = useMemo(() => {
		try {
			// Combine regular tokens and balance tokens
			const tokenMap = new Map<string, TokenListItem>();

			// Add balance tokens first (higher priority)
			balances.forEach((token) => {
				const id = TokenUtils.getUniqueId(token);
				tokenMap.set(id, {
					token,
					isBalanceToken: true,
				});
			});

			// Add regular tokens (if not already present)
			tokens.forEach((token) => {
				const id = TokenUtils.getUniqueId(token);
				if (!tokenMap.has(id)) {
					tokenMap.set(id, {
						token,
						isBalanceToken: false,
					});
				}
			});

			return Array.from(tokenMap.values());
		} catch (err) {
			const error = TokenSelectorErrorFactory.createValidationError(
				"tokens",
				{ tokens, balances },
				"valid token arrays",
			);
			addError(error);
			return [];
		}
	}, [tokens, balances, addError]);

	// Apply search and filters
	const filteredTokens = useMemo(() => {
		try {
			let filtered = allTokens;

			// Apply search if query exists
			if (searchQuery.trim()) {
				const searchResults = searchEngine.searchTokens(
					filtered.map((item) => item.token),
					searchQuery,
					{ enableFuzzy: true, enableSmartRanking: true },
				);

				// Map back to TokenListItem with scores
				filtered = searchResults.map((result) => {
					const originalItem = filtered.find((item) =>
						TokenUtils.areEqual(item.token, result.token),
					);
					return {
						...originalItem!,
						score: result.score,
						highlighted: result.score > 0.8,
					};
				});
			}

			// Apply advanced filters
			if (Object.keys(filters).length > 0) {
				filtered = searchEngine
					.applyAdvancedFilters(
						filtered.map((item) => item.token),
						filters,
					)
					.map((token) => {
						const originalItem = filtered.find((item) =>
							TokenUtils.areEqual(item.token, token),
						);
						return originalItem!;
					});
			}

			// Filter by current chain if specified
			if (currentChainId) {
				filtered = filtered.filter(
					(item) => item.token.chainId === currentChainId,
				);
			}

			return filtered;
		} catch (err) {
			const error = TokenSelectorErrorFactory.createSearchError(
				searchQuery,
				err as Error,
			);
			addError(error);
			return allTokens;
		}
	}, [allTokens, searchQuery, filters, currentChainId, searchEngine, addError]);

	// Handle search change
	const handleSearchChange = useCallback(
		(value: string) => {
			setSearchQuery(value);
			onSearchChange?.(value);
		},
		[onSearchChange],
	);

	// Handle filters change
	const handleFiltersChange = useCallback(
		(newFilters: AdvancedFilters) => {
			setFilters(newFilters);
			onFiltersChange?.(newFilters);
		},
		[onFiltersChange],
	);

	// Handle token selection
	const handleTokenSelect = useCallback(
		(token: Token | TokenWithBalance) => {
			try {
				// Add to recently selected
				EnhancedSearchEngine.addToRecentlySelected(token);

				// Close modal and notify parent
				onTokenSelect(token);
				onClose();
			} catch (err) {
				const error = TokenSelectorErrorFactory.createValidationError(
					"selectedToken",
					token,
					"valid token object",
				);
				addError(error);
			}
		},
		[onTokenSelect, onClose, addError],
	);

	// Handle favorite toggle
	const handleToggleFavorite = useCallback(
		(token: Token | TokenWithBalance) => {
			const tokenId = TokenUtils.getUniqueId(token);
			const newFavorites = new Set(favoriteTokens);

			if (newFavorites.has(tokenId)) {
				newFavorites.delete(tokenId);
			} else {
				newFavorites.add(tokenId);
			}

			setFavoriteTokens(newFavorites);
			saveFavorites(newFavorites);
			onToggleFavorite?.(token);
		},
		[favoriteTokens, saveFavorites, onToggleFavorite],
	);

	// Get available categories for filtering
	const availableCategories = useMemo(() => {
		return Object.values(TokenCategory);
	}, []);

	// Error state
	const errorState = getErrorState();
	const displayErrors = getErrorsForDisplay();

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
			<Card
				className={cn(
					"relative w-full max-w-md bg-background shadow-lg",
					"max-h-[90vh] overflow-hidden",
					className,
				)}
			>
				{/* Header */}
				<div className="flex items-center justify-between border-b p-4">
					<div>
						<h2 className="font-semibold text-lg">{title}</h2>
						{subtitle && (
							<p className="text-muted-foreground text-sm">{subtitle}</p>
						)}
					</div>
					<div className="flex items-center gap-2">
						{/* Offline Indicator */}
						{enableOfflineMode && (
							<div className="flex items-center gap-1">
								{isOffline ? (
									<WifiOff className="h-4 w-4 text-red-500" />
								) : (
									<Wifi className="h-4 w-4 text-green-500" />
								)}
							</div>
						)}

						{/* Refresh Button */}
						{onRefresh && (
							<Button
								variant="ghost"
								size="sm"
								onClick={onRefresh}
								disabled={loading}
								className="h-6 w-6 p-0"
							>
								<Loader2 className={cn("h-3 w-3", loading && "animate-spin")} />
							</Button>
						)}

						{/* Close Button */}
						<Button
							variant="ghost"
							size="sm"
							onClick={onClose}
							className="h-6 w-6 p-0"
						>
							<X className="h-4 w-4" />
						</Button>
					</div>
				</div>

				{/* Error Display */}
				{errorState.hasErrors && (
					<div className="border-b bg-destructive/10 p-3">
						{displayErrors.map((error, index) => (
							<div key={index} className="flex items-center gap-2 text-sm">
								<AlertCircle className="h-4 w-4 text-destructive" />
								<span className="text-destructive">
									{ErrorUtils.getUserMessage(error)}
								</span>
								{ErrorUtils.isRetryable(error) && (
									<Button
										variant="ghost"
										size="sm"
										onClick={() => error.retryAction?.()}
										className="h-auto p-0 text-destructive text-xs hover:text-destructive/80"
									>
										Retry
									</Button>
								)}
							</div>
						))}
					</div>
				)}

				{/* Search and Filters */}
				<div className="space-y-3 border-b p-4">
					<EnhancedSearchInput
						value={searchQuery}
						onChange={handleSearchChange}
						showFilters={enableFilters}
						showHistory={enableHistory}
						disabled={loading}
						autoFocus
					/>

					{/* Filter Controls */}
					{enableFilters && (
						<div className="flex items-center justify-between">
							<TokenFilterPanel
								filters={filters}
								onFiltersChange={handleFiltersChange}
								isOpen={showFiltersPanel}
								onToggle={() => setShowFiltersPanel(!showFiltersPanel)}
								availableChains={supportedChains}
								availableCategories={availableCategories}
							/>

							{/* Results Count */}
							<div className="text-muted-foreground text-sm">
								{filteredTokens.length} token
								{filteredTokens.length !== 1 ? "s" : ""}
								{searchQuery && <span> for "{searchQuery}"</span>}
							</div>
						</div>
					)}
				</div>

				{/* Token List */}
				<div className="flex-1 overflow-hidden">
					<SimpleTokenList
						items={filteredTokens}
						onTokenSelect={handleTokenSelect}
						selectedToken={selectedToken}
						loading={loading}
						maxHeight={maxHeight - 200} // Account for header and search
						showBalances={showBalances}
						showFavorites={showFavorites}
						favoriteTokens={favoriteTokens}
						onToggleFavorite={handleToggleFavorite}
						emptyMessage={
							searchQuery
								? `No tokens found for "${searchQuery}"`
								: "No tokens available"
						}
					/>
				</div>

				{/* Footer */}
				{(showFavorites || enableOfflineMode) && (
					<div className="border-t p-3">
						<div className="flex items-center justify-between text-muted-foreground text-xs">
							{showFavorites && <span>{favoriteTokens.size} favorites</span>}
							{enableOfflineMode && isOffline && (
								<Badge variant="outline" className="text-xs">
									Offline Mode
								</Badge>
							)}
						</div>
					</div>
				)}
			</Card>
		</div>
	);
}
