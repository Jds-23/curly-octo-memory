import { useState } from "react";
import { useAccount, useChainId } from "wagmi";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, Plus, Settings, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { trpcClient } from "@/utils/trpc";

interface Token {
	address: string;
	symbol: string;
	name: string;
	decimals: number;
	chainId: number;
}

interface MintPositionFormProps {
	onSuccess?: (tokenId: string) => void;
}

// Common tokens for different chains
const COMMON_TOKENS: { [chainId: number]: Token[] } = {
	1: [ // Mainnet
		{
			address: "0x0000000000000000000000000000000000000000",
			symbol: "ETH",
			name: "Ether",
			decimals: 18,
			chainId: 1,
		},
		{
			address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
			symbol: "USDC",
			name: "USD Coin",
			decimals: 6,
			chainId: 1,
		},
		{
			address: "0xdac17f958d2ee523a2206206994597c13d831ec7",
			symbol: "USDT",
			name: "Tether USD",
			decimals: 6,
			chainId: 1,
		},
	],
	130: [ // Unichain
		{
			address: "0x0000000000000000000000000000000000000000",
			symbol: "ETH",
			name: "Ether",
			decimals: 18,
			chainId: 130,
		},
		{
			address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913",
			symbol: "USDC",
			name: "USD Coin",
			decimals: 6,
			chainId: 130,
		},
	],
};

export function MintPositionForm({ onSuccess }: MintPositionFormProps) {
	const { address } = useAccount();
	const chainId = useChainId();

	// Form state
	const [tokenA, setTokenA] = useState<Token | null>(null);
	const [tokenB, setTokenB] = useState<Token | null>(null);
	const [amountA, setAmountA] = useState("");
	const [amountB, setAmountB] = useState("");
	const [feeTier, setFeeTier] = useState<number>(500); // 0.05%
	const [fullRange, setFullRange] = useState(false);
	const [tickRange, setTickRange] = useState("500"); // Default range
	const [slippageTolerance, setSlippageTolerance] = useState("0.5");

	// Available tokens for current chain
	const availableTokens = COMMON_TOKENS[chainId] || [];

	// tRPC mutation for minting position
	const mintPositionMutation = useMutation({
		mutationFn: async (params: {
			tokenA: Token;
			tokenB: Token;
			amountA: number;
			amountB: number;
			feeTier: number;
			fullRange: boolean;
			tickRange: number;
			slippageTolerance: number;
			recipient: string;
		}) => {
			return trpcClient.uniswap.mintPosition.mutate(params);
		},
		onSuccess: (data: { success: boolean; tokenId: string | null; message: string }) => {
			if (data.success && data.tokenId) {
				toast.success(`Position minted successfully! Token ID: ${data.tokenId}`);
				onSuccess?.(data.tokenId);
				// Reset form
				setTokenA(null);
				setTokenB(null);
				setAmountA("");
				setAmountB("");
			} else {
				toast.error(data.message || "Failed to mint position");
			}
		},
		onError: (error: Error) => {
			toast.error(`Error minting position: ${error.message}`);
		},
	});

	const handleTokenSelect = (token: Token, isTokenA: boolean) => {
		if (isTokenA) {
			if (tokenB && token.address === tokenB.address) {
				toast.error("Cannot select the same token for both positions");
				return;
			}
			setTokenA(token);
		} else {
			if (tokenA && token.address === tokenA.address) {
				toast.error("Cannot select the same token for both positions");
				return;
			}
			setTokenB(token);
		}
	};

	const handleSwapTokens = () => {
		if (tokenA && tokenB) {
			setTokenA(tokenB);
			setTokenB(tokenA);
			setAmountA(amountB);
			setAmountB(amountA);
		}
	};

	const handleMintPosition = async () => {
		if (!address) {
			toast.error("Please connect your wallet");
			return;
		}

		if (!tokenA || !tokenB) {
			toast.error("Please select both tokens");
			return;
		}

		if (!amountA || !amountB) {
			toast.error("Please enter amounts for both tokens");
			return;
		}

		const amountANum = Number.parseFloat(amountA);
		const amountBNum = Number.parseFloat(amountB);

		if (amountANum <= 0 || amountBNum <= 0) {
			toast.error("Amounts must be greater than zero");
			return;
		}

		try {
			await mintPositionMutation.mutateAsync({
				tokenA,
				tokenB,
				amountA: amountANum,
				amountB: amountBNum,
				feeTier,
				fullRange,
				tickRange: fullRange ? 0 : Number.parseInt(tickRange),
				slippageTolerance: Number.parseFloat(slippageTolerance),
				recipient: address,
			});
		} catch (error) {
			// Error handling is done in the mutation's onError callback
			console.error("Mint position error:", error);
		}
	};

	const isFormValid = tokenA && tokenB && amountA && amountB && Number.parseFloat(amountA) > 0 && Number.parseFloat(amountB) > 0;

	return (
		<div className="space-y-6">
			{/* Token Selection */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Plus className="h-5 w-5" />
						Select Token Pair
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					{/* Token A */}
					<div className="space-y-2">
						<Label>Token A</Label>
						<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
							{availableTokens.map((token) => (
								<Button
									key={token.address}
									variant={tokenA?.address === token.address ? "default" : "outline"}
									size="sm"
									onClick={() => handleTokenSelect(token, true)}
								>
									{token.symbol}
								</Button>
							))}
						</div>
						{tokenA && (
							<p className="text-muted-foreground text-sm">
								Selected: {tokenA.name} ({tokenA.symbol})
							</p>
						)}
					</div>

					{/* Token B */}
					<div className="space-y-2">
						<Label>Token B</Label>
						<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
							{availableTokens.map((token) => (
								<Button
									key={token.address}
									variant={tokenB?.address === token.address ? "default" : "outline"}
									size="sm"
									onClick={() => handleTokenSelect(token, false)}
									disabled={tokenA?.address === token.address}
								>
									{token.symbol}
								</Button>
							))}
						</div>
						{tokenB && (
							<p className="text-muted-foreground text-sm">
								Selected: {tokenB.name} ({tokenB.symbol})
							</p>
						)}
					</div>

					{/* Swap Button */}
					{tokenA && tokenB && (
						<div className="flex justify-center">
							<Button
								variant="ghost"
								size="sm"
								onClick={handleSwapTokens}
								className="gap-2"
							>
								<ArrowRight className="h-4 w-4" />
								Swap Tokens
							</Button>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Amount Input */}
			<Card>
				<CardHeader>
					<CardTitle>Liquidity Amounts</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="amountA">
								{tokenA ? `${tokenA.symbol} Amount` : "Token A Amount"}
							</Label>
							<Input
								id="amountA"
								type="number"
								step="any"
								placeholder="0.0"
								value={amountA}
								onChange={(e) => setAmountA(e.target.value)}
								disabled={!tokenA}
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="amountB">
								{tokenB ? `${tokenB.symbol} Amount` : "Token B Amount"}
							</Label>
							<Input
								id="amountB"
								type="number"
								step="any"
								placeholder="0.0"
								value={amountB}
								onChange={(e) => setAmountB(e.target.value)}
								disabled={!tokenB}
							/>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Position Settings */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Settings className="h-5 w-5" />
						Position Settings
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-6">
					{/* Fee Tier */}
					<div className="space-y-3">
						<Label>Fee Tier</Label>
						<div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
							{[
								{ value: 100, label: "0.01%" },
								{ value: 500, label: "0.05%" },
								{ value: 3000, label: "0.30%" },
								{ value: 10000, label: "1.00%" },
							].map((tier) => (
								<Button
									key={tier.value}
									variant={feeTier === tier.value ? "default" : "outline"}
									size="sm"
									onClick={() => setFeeTier(tier.value)}
								>
									{tier.label}
								</Button>
							))}
						</div>
					</div>

					{/* Price Range */}
					<div className="space-y-3">
						<div className="flex items-center gap-2">
							<Checkbox
								id="fullRange"
								checked={fullRange}
								onCheckedChange={(checked) => setFullRange(checked === true)}
							/>
							<Label htmlFor="fullRange">Full Range Position</Label>
						</div>

						{!fullRange && (
							<div className="space-y-2">
								<Label htmlFor="tickRange">Tick Range Around Current Price</Label>
								<Input
									id="tickRange"
									type="number"
									placeholder="500"
									value={tickRange}
									onChange={(e) => setTickRange(e.target.value)}
								/>
								<p className="text-muted-foreground text-sm">
									Position will be active within ±{tickRange} ticks from current price
								</p>
							</div>
						)}

						{fullRange && (
							<div className="flex items-start gap-2 rounded-md bg-yellow-50 p-3 dark:bg-yellow-900/20">
								<AlertCircle className="mt-0.5 h-4 w-4 text-yellow-600 dark:text-yellow-500" />
								<div className="text-sm">
									<p className="font-medium text-yellow-800 dark:text-yellow-200">
										Full Range Position
									</p>
									<p className="text-yellow-700 dark:text-yellow-300">
										Your liquidity will be active across the entire price range. This provides maximum liquidity but may result in impermanent loss.
									</p>
								</div>
							</div>
						)}
					</div>

					{/* Slippage Tolerance */}
					<div className="space-y-2">
						<Label htmlFor="slippage">Slippage Tolerance (%)</Label>
						<Input
							id="slippage"
							type="number"
							step="0.1"
							min="0.1"
							max="50"
							placeholder="0.5"
							value={slippageTolerance}
							onChange={(e) => setSlippageTolerance(e.target.value)}
						/>
					</div>
				</CardContent>
			</Card>

			{/* Summary */}
			{tokenA && tokenB && (
				<Card>
					<CardHeader>
						<CardTitle>Position Summary</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-2 text-sm">
							<div className="flex justify-between">
								<span className="text-muted-foreground">Pair:</span>
								<span>
									{tokenA.symbol} / {tokenB.symbol}
								</span>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">Fee Tier:</span>
								<Badge variant="secondary">{(feeTier / 10000).toFixed(2)}%</Badge>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">Range:</span>
								<span>{fullRange ? "Full Range" : `±${tickRange} ticks`}</span>
							</div>
							<div className="flex justify-between">
								<span className="text-muted-foreground">Chain:</span>
								<span>
									{chainId === 1
										? "Ethereum"
										: chainId === 130
											? "Unichain"
											: `Chain ${chainId}`}
								</span>
							</div>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Mint Button */}
			<Button
				onClick={handleMintPosition}
				disabled={!isFormValid || mintPositionMutation.isPending}
				className="w-full"
				size="lg"
			>
				{mintPositionMutation.isPending ? (
					"Minting Position..."
				) : (
					"Mint Position"
				)}
			</Button>
		</div>
	);
}