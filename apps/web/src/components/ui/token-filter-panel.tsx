/**
 * Token Filter Panel Component - TokenSelectorV2 UI
 *
 * Advanced filtering controls for token selection
 */

import { DollarSign, Filter, Shield, TrendingUp, X, Zap } from "lucide-react";
import type React from "react";
import { useCallback, useState } from "react";
import type { AdvancedFilters } from "@/lib/search/enhanced-search";
import { TokenCategory } from "@/lib/search/enhanced-search";
import { cn } from "@/lib/utils";
import { Badge } from "./badge";
import { Button } from "./button";
import { Card } from "./card";
import { Checkbox } from "./checkbox";
import { Input } from "./input";
import { Label } from "./label";

export interface TokenFilterPanelProps {
	filters: AdvancedFilters;
	onFiltersChange: (filters: AdvancedFilters) => void;
	className?: string;
	isOpen?: boolean;
	onToggle?: () => void;
	availableChains?: Array<{ id: string; name: string; icon?: string }>;
	availableCategories?: TokenCategory[];
}

const CATEGORY_ICONS: Record<TokenCategory, React.ReactNode> = {
	[TokenCategory.STABLECOIN]: <DollarSign className="h-3 w-3" />,
	[TokenCategory.DEFI]: <Zap className="h-3 w-3" />,
	[TokenCategory.GOVERNANCE]: <Shield className="h-3 w-3" />,
	[TokenCategory.YIELD]: <TrendingUp className="h-3 w-3" />,
	[TokenCategory.DEX]: <Zap className="h-3 w-3" />,
	[TokenCategory.LENDING]: <DollarSign className="h-3 w-3" />,
	[TokenCategory.BRIDGE]: <Zap className="h-3 w-3" />,
	[TokenCategory.GAMING]: <Zap className="h-3 w-3" />,
	[TokenCategory.NFT]: <Zap className="h-3 w-3" />,
	[TokenCategory.SOCIAL]: <Zap className="h-3 w-3" />,
	[TokenCategory.INFRASTRUCTURE]: <Zap className="h-3 w-3" />,
	[TokenCategory.OTHER]: <Zap className="h-3 w-3" />,
};

export function TokenFilterPanel({
	filters,
	onFiltersChange,
	className,
	isOpen = false,
	onToggle,
	availableChains = [],
	availableCategories = [],
}: TokenFilterPanelProps) {
	const [localFilters, setLocalFilters] = useState<AdvancedFilters>(filters);

	// Update filters handler
	const updateFilters = useCallback(
		(updates: Partial<AdvancedFilters>) => {
			const newFilters = { ...localFilters, ...updates };
			setLocalFilters(newFilters);
			onFiltersChange(newFilters);
		},
		[localFilters, onFiltersChange],
	);

	// Handle price range changes
	const handleMinPriceChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const value = e.target.value;
			updateFilters({
				priceRange: {
					...localFilters.priceRange,
					min: value ? Number.parseFloat(value) : undefined,
				},
			});
		},
		[localFilters.priceRange, updateFilters],
	);

	const handleMaxPriceChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const value = e.target.value;
			updateFilters({
				priceRange: {
					...localFilters.priceRange,
					max: value ? Number.parseFloat(value) : undefined,
				},
			});
		},
		[localFilters.priceRange, updateFilters],
	);

	// Handle balance range changes
	const handleMinBalanceChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const value = e.target.value;
			updateFilters({
				balanceRange: {
					...localFilters.balanceRange,
					min: value ? Number.parseFloat(value) : undefined,
				},
			});
		},
		[localFilters.balanceRange, updateFilters],
	);

	const handleMaxBalanceChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const value = e.target.value;
			updateFilters({
				balanceRange: {
					...localFilters.balanceRange,
					max: value ? Number.parseFloat(value) : undefined,
				},
			});
		},
		[localFilters.balanceRange, updateFilters],
	);

	// Handle chain selection
	const handleChainToggle = useCallback(
		(chainId: string) => {
			const currentChains = localFilters.chains || [];
			const newChains = currentChains.includes(chainId)
				? currentChains.filter((id) => id !== chainId)
				: [...currentChains, chainId];
			updateFilters({ chains: newChains });
		},
		[localFilters.chains, updateFilters],
	);

	// Handle category selection
	const handleCategoryToggle = useCallback(
		(category: TokenCategory) => {
			const currentCategories = localFilters.categories || [];
			const newCategories = currentCategories.includes(category)
				? currentCategories.filter((cat) => cat !== category)
				: [...currentCategories, category];
			updateFilters({ categories: newCategories });
		},
		[localFilters.categories, updateFilters],
	);

	// Clear all filters
	const handleClearFilters = useCallback(() => {
		const clearedFilters: AdvancedFilters = {};
		setLocalFilters(clearedFilters);
		onFiltersChange(clearedFilters);
	}, [onFiltersChange]);

	// Count active filters
	const activeFilterCount = [
		localFilters.priceRange?.min !== undefined ||
			localFilters.priceRange?.max !== undefined,
		localFilters.balanceRange?.min !== undefined ||
			localFilters.balanceRange?.max !== undefined,
		localFilters.verifiedOnly,
		localFilters.hasBalance,
		localFilters.nativeOnly,
		localFilters.excludeLowLiquidity,
		(localFilters.chains?.length || 0) > 0,
		(localFilters.categories?.length || 0) > 0,
	].filter(Boolean).length;

	if (!isOpen) {
		return (
			<Button
				variant="outline"
				size="sm"
				onClick={onToggle}
				className={cn("flex items-center gap-2", className)}
			>
				<Filter className="h-4 w-4" />
				Filters
				{activeFilterCount > 0 && (
					<Badge variant="secondary" className="h-4 px-1 text-xs">
						{activeFilterCount}
					</Badge>
				)}
			</Button>
		);
	}

	return (
		<Card className={cn("space-y-4 p-4", className)}>
			{/* Header */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<Filter className="h-4 w-4" />
					<span className="font-medium">Filters</span>
					{activeFilterCount > 0 && (
						<Badge variant="secondary" className="h-4 px-1 text-xs">
							{activeFilterCount}
						</Badge>
					)}
				</div>
				<div className="flex items-center gap-2">
					{activeFilterCount > 0 && (
						<Button
							variant="ghost"
							size="sm"
							onClick={handleClearFilters}
							className="h-auto p-0 text-muted-foreground text-xs hover:text-foreground"
						>
							Clear all
						</Button>
					)}
					<Button
						variant="ghost"
						size="sm"
						onClick={onToggle}
						className="h-6 w-6 p-0"
					>
						<X className="h-4 w-4" />
					</Button>
				</div>
			</div>

			{/* Price Range */}
			<div className="space-y-2">
				<Label className="font-medium text-sm">Price Range (USD)</Label>
				<div className="flex gap-2">
					<Input
						type="number"
						placeholder="Min"
						value={localFilters.priceRange?.min || ""}
						onChange={handleMinPriceChange}
						className="text-xs"
					/>
					<Input
						type="number"
						placeholder="Max"
						value={localFilters.priceRange?.max || ""}
						onChange={handleMaxPriceChange}
						className="text-xs"
					/>
				</div>
			</div>

			{/* Balance Range */}
			<div className="space-y-2">
				<Label className="font-medium text-sm">Balance Range (USD)</Label>
				<div className="flex gap-2">
					<Input
						type="number"
						placeholder="Min"
						value={localFilters.balanceRange?.min || ""}
						onChange={handleMinBalanceChange}
						className="text-xs"
					/>
					<Input
						type="number"
						placeholder="Max"
						value={localFilters.balanceRange?.max || ""}
						onChange={handleMaxBalanceChange}
						className="text-xs"
					/>
				</div>
			</div>

			{/* Boolean Filters */}
			<div className="space-y-3">
				<Label className="font-medium text-sm">Options</Label>

				<div className="flex items-center space-x-2">
					<Checkbox
						id="verified-only"
						checked={localFilters.verifiedOnly || false}
						onCheckedChange={(checked) =>
							updateFilters({ verifiedOnly: checked as boolean })
						}
					/>
					<Label htmlFor="verified-only" className="text-sm">
						Verified tokens only
					</Label>
				</div>

				<div className="flex items-center space-x-2">
					<Checkbox
						id="has-balance"
						checked={localFilters.hasBalance || false}
						onCheckedChange={(checked) =>
							updateFilters({ hasBalance: checked as boolean })
						}
					/>
					<Label htmlFor="has-balance" className="text-sm">
						Tokens with balance
					</Label>
				</div>

				<div className="flex items-center space-x-2">
					<Checkbox
						id="native-only"
						checked={localFilters.nativeOnly || false}
						onCheckedChange={(checked) =>
							updateFilters({ nativeOnly: checked as boolean })
						}
					/>
					<Label htmlFor="native-only" className="text-sm">
						Native tokens only
					</Label>
				</div>

				<div className="flex items-center space-x-2">
					<Checkbox
						id="exclude-low-liquidity"
						checked={localFilters.excludeLowLiquidity || false}
						onCheckedChange={(checked) =>
							updateFilters({ excludeLowLiquidity: checked as boolean })
						}
					/>
					<Label htmlFor="exclude-low-liquidity" className="text-sm">
						Exclude low liquidity
					</Label>
				</div>
			</div>

			{/* Chain Selection */}
			{availableChains.length > 0 && (
				<div className="space-y-2">
					<Label className="font-medium text-sm">Chains</Label>
					<div className="flex flex-wrap gap-2">
						{availableChains.map((chain) => (
							<Button
								key={chain.id}
								variant={
									localFilters.chains?.includes(chain.id)
										? "default"
										: "outline"
								}
								size="sm"
								onClick={() => handleChainToggle(chain.id)}
								className="h-7 text-xs"
							>
								{chain.icon && (
									<img src={chain.icon} alt="" className="mr-1 h-3 w-3" />
								)}
								{chain.name}
							</Button>
						))}
					</div>
				</div>
			)}

			{/* Category Selection */}
			{availableCategories.length > 0 && (
				<div className="space-y-2">
					<Label className="font-medium text-sm">Categories</Label>
					<div className="flex flex-wrap gap-2">
						{availableCategories.map((category) => (
							<Button
								key={category}
								variant={
									localFilters.categories?.includes(category)
										? "default"
										: "outline"
								}
								size="sm"
								onClick={() => handleCategoryToggle(category)}
								className="h-7 text-xs"
							>
								{CATEGORY_ICONS[category]}
								<span className="ml-1">
									{category.toLowerCase().replace("_", " ")}
								</span>
							</Button>
						))}
					</div>
				</div>
			)}
		</Card>
	);
}
