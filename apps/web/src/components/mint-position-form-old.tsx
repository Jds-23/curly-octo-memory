import { useMutation } from "@tanstack/react-query";
import { Token as UniswapToken } from "@uniswap/sdk-core";
import {
	AlertCircle,
	ArrowRight,
	Calculator,
	ChevronDown,
	Plus,
	Settings,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { type Address, type TransactionRequest } from "viem";
import { useAccount, useChainId } from "wagmi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TokenSelectorV2 } from "@/components/token-selector-v2";
import { useTokenManagement } from "@/hooks/use-token-management";
import { toUniswapToken, isSupportedChain, type SupportedChainId } from "@/lib/tokens/multichain-tokens";
import type { Token } from "@/types/token";
import {
	calculateDependentAmount,
	getCurrentPriceRatio,
} from "@/utils/amount-calculator";
import { trpcClient } from "@/utils/trpc";

// Token interface is now imported from @/types/token

// Response types matching the server API (kept for future reference but currently unused since tRPC infers types)
// interface MintPositionSuccessResponse {
// 	success: true;
// 	message: string;
// 	transactionData: TransactionRequest;
// 	position: {
// 		tokenA: Token;
// 		tokenB: Token;
// 		amountA: number;
// 		amountB: number;
// 		feeTier: number;
// 		tickLower: number;
// 		tickUpper: number;
// 		liquidity: string;
// 	};
// }

// interface MintPositionErrorResponse {
// 	success: false;
// 	message: string;
// }

// type MintPositionResponse = MintPositionSuccessResponse | MintPositionErrorResponse;

interface MintPositionFormProps {
	onSuccess?: (transactionData: TransactionRequest) => void;
}

// Token data is now managed by useTokenManagement hook

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

	// Auto-calculation state
	const [isCalculating, setIsCalculating] = useState(false);
	const [autoCalculateEnabled, setAutoCalculateEnabled] = useState(true);
	const [currentPrice, setCurrentPrice] = useState<number | null>(null);
	const [lastInputField, setLastInputField] = useState<"A" | "B" | null>(null);

	// Available tokens (managed by hook)
	const availableTokens = tokens;

	// Convert our Token interface to Uniswap Token
	const convertToUniswapToken = useCallback((token: Token): UniswapToken => {
		return toUniswapToken(token);
	}, []);

	// Auto-calculate dependent amount
	const calculateOtherAmount = useCallback(
		async (inputAmount: string, isTokenAInput: boolean) => {
			console.log("calculateOtherAmount called:", {
				inputAmount,
				isTokenAInput,
				autoCalculateEnabled,
				tokenA: tokenA?.symbol,
				tokenB: tokenB?.symbol,
			});
			if (
				!autoCalculateEnabled ||
				!tokenA ||
				!tokenB ||
				!inputAmount ||
				Number.parseFloat(inputAmount) <= 0
			) {
				console.log("Early return from calculateOtherAmount:", {
					autoCalculateEnabled,
					hasTokenA: !!tokenA,
					hasTokenB: !!tokenB,
					inputAmount,
				});
				return;
			}

			setIsCalculating(true);
			try {
				const uniswapTokenA = convertToUniswapToken(tokenA);
				const uniswapTokenB = convertToUniswapToken(tokenB);

				const result = await calculateDependentAmount({
					tokenA: uniswapTokenA,
					tokenB: uniswapTokenB,
					feeTier,
					inputAmount: Number.parseFloat(inputAmount),
					isTokenAInput,
					fullRange,
					tickRange: Number.parseInt(tickRange) || 500,
				});

				if (result.isValid) {
					if (isTokenAInput) {
						setAmountB(result.amountB.toString());
					} else {
						setAmountA(result.amountA.toString());
					}
				} else if (result.error) {
					console.warn("Amount calculation:", result.error);
				}
			} catch (error) {
				console.error("Error in auto-calculation:", error);
			} finally {
				setIsCalculating(false);
			}
		},
		[
			autoCalculateEnabled,
			tokenA,
			tokenB,
			feeTier,
			fullRange,
			tickRange,
			convertToUniswapToken,
		],
	);

	// Fetch current price when tokens or fee tier change
	useEffect(() => {
		const fetchPrice = async () => {
			if (!tokenA || !tokenB) {
				setCurrentPrice(null);
				return;
			}

			try {
				const uniswapTokenA = convertToUniswapToken(tokenA);
				const uniswapTokenB = convertToUniswapToken(tokenB);
				const price = await getCurrentPriceRatio(
					uniswapTokenA,
					uniswapTokenB,
					feeTier,
				);
				setCurrentPrice(price);
			} catch (error) {
				console.error("Error fetching current price:", error);
				setCurrentPrice(null);
			}
		};

		fetchPrice();
	}, [tokenA, tokenB, feeTier, convertToUniswapToken]);

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
		onSuccess: (data: any) => {
			if (data.success && data.transactionData) {
				toast.success(
					`Transaction prepared successfully! Ready to execute on-chain.`,
				);
				console.log("Transaction prepared successfully! Ready to execute on-chain.", data.transactionData);
				// onSuccess?.(data.transactionData);
				// Reset form
				setTokenA(null);
				setTokenB(null);
				setAmountA("");
				setAmountB("");
			} else {
				toast.error(data.message || "Failed to prepare position mint");
			}
		},
		onError: (error: Error) => {
			toast.error(`Error preparing position mint: ${error.message}`);
		},
	});

	const handleTokenSelect = (token: Token, isTokenA: boolean) => {
		if (isTokenA) {
			if (tokenB && token.address === tokenB.address) {
				toast.error("Cannot select the same token for both positions");
				return;
			}
			setTokenA(token);
			// Trigger recalculation if we have an amount for the other token
			if (amountB && lastInputField === "B") {
				setTimeout(() => calculateOtherAmount(amountB, false), 100);
			}
		} else {
			if (tokenA && token.address === tokenA.address) {
				toast.error("Cannot select the same token for both positions");
				return;
			}
			setTokenB(token);
			// Trigger recalculation if we have an amount for the other token
			if (amountA && lastInputField === "A") {
				setTimeout(() => calculateOtherAmount(amountA, true), 100);
			}
		}
	};

	const handleAmountAChange = useCallback(
		(value: string) => {
			console.log("handleAmountAChange called with:", value);
			setAmountA(value);
			setLastInputField("A");
			if (value && Number.parseFloat(value) > 0) {
				console.log("Triggering auto-calculation for tokenA input");
				calculateOtherAmount(value, true);
			} else {
				setAmountB("");
			}
		},
		[calculateOtherAmount],
	);

	const handleAmountBChange = useCallback(
		(value: string) => {
			setAmountB(value);
			setLastInputField("B");
			if (value && Number.parseFloat(value) > 0) {
				calculateOtherAmount(value, false);
			} else {
				setAmountA("");
			}
		},
		[calculateOtherAmount],
	);

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

	const isFormValid =
		tokenA &&
		tokenB &&
		amountA &&
		amountB &&
		Number.parseFloat(amountA) > 0 &&
		Number.parseFloat(amountB) > 0;

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
									variant={
										tokenA?.address === token.address ? "default" : "outline"
									}
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
									variant={
										tokenB?.address === token.address ? "default" : "outline"
									}
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
					<CardTitle className="flex items-center justify-between">
						<span>Liquidity Amounts</span>
						<div className="flex items-center gap-2">
							<Checkbox
								id="autoCalculate"
								checked={autoCalculateEnabled}
								onCheckedChange={(checked) =>
									setAutoCalculateEnabled(checked === true)
								}
							/>
							<Label
								htmlFor="autoCalculate"
								className="flex items-center gap-1 font-normal text-sm"
							>
								<Calculator className="h-3 w-3" />
								Auto-calculate
							</Label>
						</div>
					</CardTitle>
					{currentPrice && tokenA && tokenB && (
						<div className="text-muted-foreground text-sm">
							Current price: 1 {tokenA.symbol} = {currentPrice.toFixed(6)}{" "}
							{tokenB.symbol}
						</div>
					)}
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="amountA">
								{tokenA ? `${tokenA.symbol} Amount` : "Token A Amount"}
							</Label>
							<div className="relative">
								<Input
									id="amountA"
									type="number"
									step="any"
									placeholder="0.0"
									value={amountA}
									onChange={(e) => handleAmountAChange(e.target.value)}
									disabled={
										!tokenA || (isCalculating && lastInputField === "B")
									}
								/>
								{isCalculating && lastInputField === "B" && (
									<div className="-translate-y-1/2 absolute top-1/2 right-2">
										<div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
									</div>
								)}
							</div>
						</div>
						<div className="space-y-2">
							<Label htmlFor="amountB">
								{tokenB ? `${tokenB.symbol} Amount` : "Token B Amount"}
							</Label>
							<div className="relative">
								<Input
									id="amountB"
									type="number"
									step="any"
									placeholder="0.0"
									value={amountB}
									onChange={(e) => handleAmountBChange(e.target.value)}
									disabled={
										!tokenB || (isCalculating && lastInputField === "A")
									}
								/>
								{isCalculating && lastInputField === "A" && (
									<div className="-translate-y-1/2 absolute top-1/2 right-2">
										<div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
									</div>
								)}
							</div>
						</div>
					</div>
					{autoCalculateEnabled && !tokenA && !tokenB && (
						<div className="rounded-md bg-blue-50 p-3 dark:bg-blue-900/20">
							<p className="text-blue-800 text-sm dark:text-blue-200">
								💡 Select both tokens to enable automatic amount calculation
								based on current pool prices
							</p>
						</div>
					)}
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
									onClick={() => {
										setFeeTier(tier.value);
										// Trigger recalculation when fee tier changes
										if (lastInputField === "A" && amountA) {
											setTimeout(
												() => calculateOtherAmount(amountA, true),
												100,
											);
										} else if (lastInputField === "B" && amountB) {
											setTimeout(
												() => calculateOtherAmount(amountB, false),
												100,
											);
										}
									}}
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
								onCheckedChange={(checked) => {
									setFullRange(checked === true);
									// Trigger recalculation when range changes
									if (lastInputField === "A" && amountA) {
										setTimeout(() => calculateOtherAmount(amountA, true), 100);
									} else if (lastInputField === "B" && amountB) {
										setTimeout(() => calculateOtherAmount(amountB, false), 100);
									}
								}}
							/>
							<Label htmlFor="fullRange">Full Range Position</Label>
						</div>

						{!fullRange && (
							<div className="space-y-2">
								<Label htmlFor="tickRange">
									Tick Range Around Current Price
								</Label>
								<Input
									id="tickRange"
									type="number"
									placeholder="500"
									value={tickRange}
									onChange={(e) => {
										setTickRange(e.target.value);
										// Trigger recalculation when tick range changes
										if (lastInputField === "A" && amountA) {
											setTimeout(
												() => calculateOtherAmount(amountA, true),
												100,
											);
										} else if (lastInputField === "B" && amountB) {
											setTimeout(
												() => calculateOtherAmount(amountB, false),
												100,
											);
										}
									}}
								/>
								<p className="text-muted-foreground text-sm">
									Position will be active within ±{tickRange} ticks from current
									price
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
										Your liquidity will be active across the entire price range.
										This provides maximum liquidity but may result in
										impermanent loss.
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
								<Badge variant="secondary">
									{(feeTier / 10000).toFixed(2)}%
								</Badge>
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
				{mintPositionMutation.isPending
					? "Minting Position..."
					: "Mint Position"}
			</Button>
		</div>
	);
}
