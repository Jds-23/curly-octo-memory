/**
 * TokenSelectorV2 Demo Page - Better-T-Stack Web App
 *
 * Demonstration page showcasing the enhanced TokenSelectorV2 component
 */

import { createFileRoute } from "@tanstack/react-router";
import { Code, Loader2, Play, Settings, Sparkles, Wallet } from "lucide-react";
import { useState } from "react";
import { TokenSelectorV2 } from "@/components/token-selector-v2";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTokensAndBalances } from "@/hooks/use-balances";
import type { Token, TokenWithBalance } from "@/types/token";

// Chain configuration
const supportedChains = [
	{
		id: "1",
		name: "Ethereum",
		icon: "https://cryptologos.cc/logos/ethereum-eth-logo.png",
	},
	{
		id: "137",
		name: "Polygon",
		icon: "https://cryptologos.cc/logos/polygon-matic-logo.png",
	},
	{
		id: "56",
		name: "BSC",
		icon: "https://cryptologos.cc/logos/bnb-bnb-logo.png",
	},
];

function TokenSelectorDemo() {
	const [isOpen, setIsOpen] = useState(false);
	const [selectedToken, setSelectedToken] = useState<
		Token | TokenWithBalance | undefined
	>();
	const [showBalances, setShowBalances] = useState(true);
	const [enableFilters, setEnableFilters] = useState(true);
	const [enableVirtualization, setEnableVirtualization] = useState(true);
	const [userAddress, setUserAddress] = useState<string>("");
	const [chainIds, setChainIds] = useState("1"); // Ethereum mainnet

	// Fetch real token data
	const { balances, popularTokens, allTokens, userBalances, isLoading, error } =
		useTokensAndBalances(userAddress || null, {
			chain_ids: chainIds,
			enableFiltering: true,
			filterOptions: {
				minLiquidity: 1000,
				requireCompleteName: true,
				minPriceUsd: 0.000001,
				allowLowLiquidity: false,
			},
		});

	const handleTokenSelect = (token: Token | TokenWithBalance) => {
		setSelectedToken(token);
		console.log("Selected token:", token);
	};

	const handleRefresh = () => {
		balances.refetch();
		popularTokens.refetch();
	};

	return (
		<div className="container mx-auto max-w-4xl px-4 py-8">
			{/* Header */}
			<div className="mb-8 text-center">
				<div className="mb-4 flex items-center justify-center gap-2">
					<Sparkles className="h-8 w-8 text-primary" />
					<h1 className="font-bold text-3xl">TokenSelectorV2</h1>
				</div>
				<p className="text-lg text-muted-foreground">
					Enhanced token selection with advanced search, filtering, and error
					handling
				</p>
			</div>

			{/* Features Overview */}
			<div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
				<Card className="p-4">
					<div className="mb-2 flex items-center gap-2">
						<Code className="h-4 w-4 text-primary" />
						<span className="font-medium">Type Safe</span>
					</div>
					<p className="text-muted-foreground text-sm">
						Full TypeScript support with unified token types
					</p>
				</Card>

				<Card className="p-4">
					<div className="mb-2 flex items-center gap-2">
						<Sparkles className="h-4 w-4 text-primary" />
						<span className="font-medium">Advanced Search</span>
					</div>
					<p className="text-muted-foreground text-sm">
						Fuzzy matching, suggestions, and search history
					</p>
				</Card>

				<Card className="p-4">
					<div className="mb-2 flex items-center gap-2">
						<Settings className="h-4 w-4 text-primary" />
						<span className="font-medium">Rich Filters</span>
					</div>
					<p className="text-muted-foreground text-sm">
						Price range, balance, chain, and category filters
					</p>
				</Card>

				<Card className="p-4">
					<div className="mb-2 flex items-center gap-2">
						<Play className="h-4 w-4 text-primary" />
						<span className="font-medium">Performant</span>
					</div>
					<p className="text-muted-foreground text-sm">
						Virtual scrolling for thousands of tokens
					</p>
				</Card>
			</div>

			{/* Controls */}
			<Card className="mb-8 p-6">
				<h2 className="mb-4 font-semibold text-xl">Demo Controls</h2>

				<div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
					{/* Wallet Configuration */}
					<div>
						<h3 className="mb-3 flex items-center gap-2 font-medium">
							<Wallet className="h-4 w-4" />
							Wallet Settings
						</h3>
						<div className="space-y-3">
							<div>
								<Label htmlFor="address" className="text-sm">
									Wallet Address (EVM)
								</Label>
								<Input
									id="address"
									type="text"
									placeholder="0x..."
									value={userAddress}
									onChange={(e) => setUserAddress(e.target.value)}
									className="text-sm"
								/>
								<p className="mt-1 text-muted-foreground text-xs">
									Enter an EVM address to load real balances
								</p>
							</div>
							<div>
								<Label htmlFor="chainIds" className="text-sm">
									Chain IDs
								</Label>
								<Input
									id="chainIds"
									type="text"
									placeholder="1,137,56"
									value={chainIds}
									onChange={(e) => setChainIds(e.target.value)}
									className="text-sm"
								/>
								<p className="mt-1 text-muted-foreground text-xs">
									Comma-separated chain IDs
								</p>
							</div>
						</div>
					</div>

					{/* Selected Token Display */}
					<div>
						<h3 className="mb-3 font-medium">Selected Token</h3>
						{selectedToken ? (
							<Card className="p-4">
								<div className="flex items-center gap-3">
									{selectedToken.icon && (
										<img
											src={selectedToken.icon}
											alt={selectedToken.symbol}
											className="h-8 w-8 rounded-full"
										/>
									)}
									<div>
										<div className="flex items-center gap-2">
											<span className="font-medium">
												{selectedToken.symbol}
											</span>
											{selectedToken.tags?.includes("verified") && (
												<Badge variant="secondary" className="h-4 px-1 text-xs">
													✓
												</Badge>
											)}
										</div>
										<p className="text-muted-foreground text-sm">
											{selectedToken.name}
										</p>
										{"amount" in selectedToken && (
											<p className="text-muted-foreground text-sm">
												Balance:{" "}
												{Number.parseFloat(selectedToken.amount) /
													10 ** selectedToken.decimals}{" "}
												{selectedToken.symbol}
											</p>
										)}
									</div>
								</div>
							</Card>
						) : (
							<Card className="border-dashed p-4">
								<p className="text-center text-muted-foreground">
									No token selected
								</p>
							</Card>
						)}
					</div>

					{/* Settings */}
					<div>
						<h3 className="mb-3 font-medium">Settings</h3>
						<div className="space-y-3">
							<label className="flex items-center gap-2">
								<input
									type="checkbox"
									checked={showBalances}
									onChange={(e) => setShowBalances(e.target.checked)}
									className="rounded"
								/>
								<span className="text-sm">Show Balances</span>
							</label>
							<label className="flex items-center gap-2">
								<input
									type="checkbox"
									checked={enableFilters}
									onChange={(e) => setEnableFilters(e.target.checked)}
									className="rounded"
								/>
								<span className="text-sm">Enable Filters</span>
							</label>
							<label className="flex items-center gap-2">
								<input
									type="checkbox"
									checked={enableVirtualization}
									onChange={(e) => setEnableVirtualization(e.target.checked)}
									className="rounded"
								/>
								<span className="text-sm">Virtual Scrolling</span>
							</label>
						</div>
					</div>
				</div>

				{/* Data Status */}
				<div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
					<Card className="p-3">
						<div className="flex items-center justify-between">
							<span className="font-medium text-sm">Popular Tokens</span>
							{popularTokens.isLoading ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<Badge
									variant={popularTokens.error ? "destructive" : "secondary"}
								>
									{popularTokens.data?.tokens.length || 0}
								</Badge>
							)}
						</div>
						{popularTokens.error && (
							<p className="mt-1 text-destructive text-xs">
								{popularTokens.error.message}
							</p>
						)}
					</Card>

					<Card className="p-3">
						<div className="flex items-center justify-between">
							<span className="font-medium text-sm">User Balances</span>
							{balances.isLoading ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<Badge variant={balances.error ? "destructive" : "secondary"}>
									{userBalances.length}
								</Badge>
							)}
						</div>
						{balances.error && (
							<p className="mt-1 text-destructive text-xs">
								{balances.error.message}
							</p>
						)}
					</Card>

					<Card className="p-3">
						<div className="flex items-center justify-between">
							<span className="font-medium text-sm">Status</span>
							<Badge
								variant={
									error ? "destructive" : isLoading ? "secondary" : "default"
								}
							>
								{error ? "Error" : isLoading ? "Loading" : "Ready"}
							</Badge>
						</div>
					</Card>
				</div>

				{/* Action Buttons */}
				<div className="mt-6 flex flex-wrap gap-3">
					<Button onClick={() => setIsOpen(true)} disabled={isLoading}>
						{isLoading ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Loading...
							</>
						) : (
							"Open Token Selector"
						)}
					</Button>
					<Button
						variant="outline"
						onClick={handleRefresh}
						disabled={isLoading}
					>
						{isLoading ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							"Refresh Data"
						)}
					</Button>
					<Button variant="outline" onClick={() => setSelectedToken(undefined)}>
						Clear Selection
					</Button>
				</div>
			</Card>

			{/* Implementation Details */}
			<Card className="p-6">
				<h2 className="mb-4 font-semibold text-xl">
					Implementation Highlights
				</h2>

				<div className="space-y-4">
					<div>
						<h3 className="mb-2 font-medium">🏗️ Architecture</h3>
						<ul className="ml-4 space-y-1 text-muted-foreground text-sm">
							<li>• Unified type system with TokenFormatAdapter</li>
							<li>• Enhanced error handling with recovery mechanisms</li>
							<li>• Advanced search engine with fuzzy matching</li>
							<li>• Virtual scrolling for performance</li>
						</ul>
					</div>

					<div>
						<h3 className="mb-2 font-medium">✨ Features</h3>
						<ul className="ml-4 space-y-1 text-muted-foreground text-sm">
							<li>• Search by name, symbol, or address</li>
							<li>• Filter by price, balance, chain, category</li>
							<li>• Favorite tokens with localStorage persistence</li>
							<li>• Search history and suggestions</li>
							<li>• Responsive design for mobile and desktop</li>
							<li>• Offline mode support</li>
						</ul>
					</div>

					<div>
						<h3 className="mb-2 font-medium">🔧 Technical Stack</h3>
						<ul className="ml-4 space-y-1 text-muted-foreground text-sm">
							<li>• React 19 with TypeScript</li>
							<li>• TailwindCSS + shadcn/ui components</li>
							<li>• react-window for virtualization</li>
							<li>• localStorage for persistence</li>
							<li>• Better-T-Stack integration</li>
						</ul>
					</div>
				</div>
			</Card>

			{/* TokenSelectorV2 Component */}
			<TokenSelectorV2
				isOpen={isOpen}
				onClose={() => setIsOpen(false)}
				onTokenSelect={handleTokenSelect}
				selectedToken={selectedToken}
				tokens={allTokens}
				balances={showBalances ? userBalances : []}
				loading={isLoading}
				error={error || undefined}
				title="Select Token"
				subtitle={`${allTokens.length} tokens available${userAddress ? ` • ${userBalances.length} with balance` : ""}`}
				showBalances={showBalances && Boolean(userAddress)}
				showFavorites={true}
				enableFilters={enableFilters}
				enableHistory={true}
				enableVirtualization={enableVirtualization}
				enableOfflineMode={true}
				supportedChains={supportedChains}
				currentChainId={chainIds.split(",")[0] || "1"}
				onRefresh={handleRefresh}
			/>
		</div>
	);
}

export const Route = createFileRoute("/token-selector-demo")({
	component: TokenSelectorDemo,
});
