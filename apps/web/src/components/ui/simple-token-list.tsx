/**
 * Simple Token List Component - TokenSelectorV2 UI
 *
 * Non-virtualized token list for displaying tokens without complex dependencies
 */

import { AlertTriangle, ChevronRight, Star } from "lucide-react";
import type React from "react";
import { useCallback } from "react";
import { cn } from "@/lib/utils";
import type { Token, TokenWithBalance } from "@/types/token";
import { TokenUtils } from "@/types/token";
import { Badge } from "./badge";
import { Button } from "./button";
import { Skeleton } from "./skeleton";

export interface TokenListItem {
	token: Token | TokenWithBalance;
	isBalanceToken: boolean;
	score?: number;
	highlighted?: boolean;
}

export interface SimpleTokenListProps {
	items: TokenListItem[];
	onTokenSelect: (token: Token | TokenWithBalance) => void;
	selectedToken?: Token | TokenWithBalance;
	loading?: boolean;
	maxHeight?: number;
	className?: string;
	showBalances?: boolean;
	showFavorites?: boolean;
	emptyMessage?: string;
	favoriteTokens?: Set<string>;
	onToggleFavorite?: (token: Token | TokenWithBalance) => void;
}

export function SimpleTokenList({
	items,
	onTokenSelect,
	selectedToken,
	loading = false,
	maxHeight = 400,
	className,
	showBalances = false,
	showFavorites = false,
	emptyMessage = "No tokens found",
	favoriteTokens = new Set(),
	onToggleFavorite,
}: SimpleTokenListProps) {
	const formatBalance = useCallback((amount: string, decimals: number) => {
		const value = Number.parseFloat(amount) / 10 ** decimals;
		if (value === 0) return "0";
		if (value < 0.001) return "< 0.001";
		if (value < 1) return value.toFixed(6);
		if (value < 1000) return value.toFixed(3);
		if (value < 1000000) return `${(value / 1000).toFixed(1)}K`;
		return `${(value / 1000000).toFixed(1)}M`;
	}, []);

	const formatUsdValue = useCallback((valueUsd: number | null) => {
		if (!valueUsd || valueUsd === 0) return null;
		if (valueUsd < 0.01) return "< $0.01";
		if (valueUsd < 1000) return `$${valueUsd.toFixed(2)}`;
		if (valueUsd < 1000000) return `$${(valueUsd / 1000).toFixed(1)}K`;
		return `$${(valueUsd / 1000000).toFixed(1)}M`;
	}, []);

	// Loading skeleton
	if (loading) {
		return (
			<div className={cn("space-y-2 p-2", className)} style={{ maxHeight }}>
				{Array.from({ length: 6 }).map((_, i) => (
					<div key={i} className="flex items-center gap-3 p-3">
						<Skeleton className="h-8 w-8 rounded-full" />
						<div className="flex-1 space-y-1">
							<Skeleton className="h-4 w-16" />
							<Skeleton className="h-3 w-24" />
						</div>
						{showBalances && (
							<div className="space-y-1 text-right">
								<Skeleton className="h-4 w-12" />
								<Skeleton className="h-3 w-8" />
							</div>
						)}
					</div>
				))}
			</div>
		);
	}

	// Empty state
	if (items.length === 0) {
		return (
			<div
				className={cn(
					"flex flex-col items-center justify-center p-8",
					className,
				)}
			>
				<div className="text-center">
					<div className="mb-2 text-2xl">🔍</div>
					<p className="text-muted-foreground text-sm">{emptyMessage}</p>
				</div>
			</div>
		);
	}

	return (
		<div
			className={cn("overflow-y-auto border-t", className)}
			style={{ maxHeight }}
		>
			{items.map((item, index) => {
				const { token, isBalanceToken, highlighted } = item;
				const isSelected =
					selectedToken && TokenUtils.areEqual(token, selectedToken);
				const isFavorite = favoriteTokens.has(TokenUtils.getUniqueId(token));
				const balanceToken = isBalanceToken
					? (token as TokenWithBalance)
					: null;
				const hasBalance =
					balanceToken && Number.parseFloat(balanceToken.amount) > 0;

				const handleSelect = () => onTokenSelect(token);
				const handleToggleFavorite = (e: React.MouseEvent) => {
					e.stopPropagation();
					onToggleFavorite?.(token);
				};

				return (
					<Button
						key={TokenUtils.getUniqueId(token)}
						variant="ghost"
						onClick={handleSelect}
						className={cn(
							"flex h-16 w-full items-center gap-3 p-3 text-left",
							"border-0 bg-transparent hover:bg-muted/50",
							isSelected && "bg-muted",
							highlighted && "ring-1 ring-primary/50",
							"transition-colors duration-200",
						)}
					>
						{/* Token Icon */}
						<div className="relative h-8 w-8 flex-shrink-0">
							{token.icon ? (
								<img
									src={token.icon}
									alt={token.symbol}
									className="h-8 w-8 rounded-full"
									onError={(e) => {
										(e.target as HTMLImageElement).style.display = "none";
									}}
								/>
							) : (
								<div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted font-medium text-xs">
									{token.symbol.slice(0, 2).toUpperCase()}
								</div>
							)}

							{/* Native token indicator */}
							{TokenUtils.isNativeToken(token) && (
								<div className="-bottom-1 -right-1 absolute h-3 w-3 rounded-full bg-primary" />
							)}
						</div>

						{/* Token Info */}
						<div className="flex min-w-0 flex-1 flex-col">
							<div className="flex items-center gap-2">
								<span className="font-medium text-sm">{token.symbol}</span>

								{/* Verification badge */}
								{token.tags?.includes("verified") && (
									<Badge variant="secondary" className="h-4 px-1 text-xs">
										✓
									</Badge>
								)}

								{/* Low liquidity warning */}
								{balanceToken?.lowLiquidity && (
									<AlertTriangle className="h-3 w-3 text-yellow-500" />
								)}
							</div>
							<span className="truncate text-muted-foreground text-xs">
								{TokenUtils.getDisplayName(token)}
							</span>
							{token.chainName && (
								<span className="text-muted-foreground text-xs">
									{token.chainName}
								</span>
							)}
						</div>

						{/* Balance Info */}
						{showBalances && balanceToken && (
							<div className="flex flex-col items-end text-right">
								{hasBalance ? (
									<>
										<span className="font-medium text-sm">
											{formatBalance(
												balanceToken.amount,
												balanceToken.decimals,
											)}
										</span>
										{balanceToken.valueUsd && (
											<span className="text-muted-foreground text-xs">
												{formatUsdValue(balanceToken.valueUsd)}
											</span>
										)}
									</>
								) : (
									<span className="text-muted-foreground text-xs">0</span>
								)}
							</div>
						)}

						{/* Favorite Button */}
						{showFavorites && onToggleFavorite && (
							<Button
								variant="ghost"
								size="sm"
								onClick={handleToggleFavorite}
								className="h-6 w-6 p-0 hover:bg-muted"
							>
								<Star
									className={cn(
										"h-3 w-3",
										isFavorite
											? "fill-yellow-400 text-yellow-400"
											: "text-muted-foreground",
									)}
								/>
							</Button>
						)}

						{/* Selection Indicator */}
						<ChevronRight className="h-4 w-4 text-muted-foreground" />
					</Button>
				);
			})}
		</div>
	);
}
