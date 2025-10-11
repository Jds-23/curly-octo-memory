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
import { useAccount, useChainId } from "wagmi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TokenSelectorV2 } from "@/components/token-selector-v2";
import { useMintPosition } from "@/hooks/use-mint-position";
import { useTokenManagement } from "@/hooks/use-token-management";
import { toUniswapToken, isSupportedChain, getChainInfo } from "@/lib/tokens/multichain-tokens";
import type { Token } from "@/types/token";
import {
	calculateDependentAmount,
	getCurrentPriceRatio,
} from "@/utils/amount-calculator";

interface MintPositionFormProps {
	onSuccess?: () => void;
}

export function MintPositionForm({ onSuccess }: MintPositionFormProps) {
	const { address } = useAccount();
	const wagmiChainId = useChainId();
	const chainId = isSupportedChain(wagmiChainId) ? wagmiChainId : null;

	// Token management
	const {
		tokens,
		loading: tokensLoading,
		error: tokensError,
		currentChainId,
		supportedChains,
		refreshTokens
	} = useTokenManagement();

	// Form state
	const [tokenA, setTokenA] = useState<Token | null>(null);
	const [tokenB, setTokenB] = useState<Token | null>(null);
	const [showTokenASelector, setShowTokenASelector] = useState(false);
	const [showTokenBSelector, setShowTokenBSelector] = useState(false);
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

	// Mint position hook
	const {
		execute: executeMint,
		status: mintStatus,
		error: mintError,
		balanceError,
		isReady,
		isExecuting,
		reset: resetMint,
	} = useMintPosition({
		tokenA,
		tokenB,
		amountA,
		amountB,
		feeTier,
		fullRange,
		tickRange: Number.parseInt(tickRange) || 500,
		slippageTolerance: Number.parseFloat(slippageTolerance) || 0.5,
		owner: address,
		chainId: tokenA ? Number.parseInt(tokenA.chainId) : 1,
	});

	// Convert our Token interface to Uniswap Token
	const convertToUniswapToken = useCallback((token: Token) => {
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

	// Handle mint success and errors
	useEffect(() => {
		if (mintStatus === "success") {
			toast.success("Position minted successfully!");
			// Reset form
			setTokenA(null);
			setTokenB(null);
			setAmountA("");
			setAmountB("");
			resetMint();
			onSuccess?.();
		} else if (mintStatus === "error") {
			// Show specific error message if available
			const errorMessage = mintError || "Transaction failed. Please try again.";
			toast.error(errorMessage);
			// Reset status to idle after showing error so user can retry
			setTimeout(() => resetMint(), 3000);
		}
	}, [mintStatus, mintError, resetMint, onSuccess]);

	// Token selection handlers
	const handleTokenASelect = useCallback((token: Token) => {
		if (tokenB && token.address === tokenB.address && token.chainId === tokenB.chainId) {
			toast.error("Cannot select the same token for both positions");
			return;
		}
		setTokenA(token);
		setShowTokenASelector(false);
		// Trigger recalculation if we have an amount for the other token
		if (amountB && lastInputField === "B") {
			setTimeout(() => calculateOtherAmount(amountB, false), 100);
		}
	}, [tokenB, amountB, lastInputField, calculateOtherAmount]);

	const handleTokenBSelect = useCallback((token: Token) => {
		if (tokenA && token.address === tokenA.address && token.chainId === tokenA.chainId) {
			toast.error("Cannot select the same token for both positions");
			return;
		}
		setTokenB(token);
		setShowTokenBSelector(false);
		// Trigger recalculation if we have an amount for the other token
		if (amountA && lastInputField === "A") {
			setTimeout(() => calculateOtherAmount(amountA, true), 100);
		}
	}, [tokenA, amountA, lastInputField, calculateOtherAmount]);

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

		// Execute mint transaction via hook
		await executeMint();
	};

	// Get button text based on status
	const getButtonText = () => {
		if (balanceError) return balanceError;

		switch (mintStatus) {
			case "checking-balance":
				return "Checking balances...";
			case "preparing":
				return "Preparing transaction...";
			case "checking-allowance":
				return "Checking allowances...";
			case "executing":
				return "Executing transaction...";
			case "confirming":
				return "Confirming...";
			default:
				return "Mint Position";
		}
	};

	// Get current chain info for display
	const currentChainInfo = currentChainId ? getChainInfo(currentChainId) : null;

	return (
		<div className="space-y-6">
			{/* Chain Info */}
			{currentChainInfo && (
				<Card>
					<CardContent className="pt-6">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-2">
								<span className="text-lg">{currentChainInfo.icon}</span>
								<span className="font-medium">{currentChainInfo.displayName}</span>
								<Badge variant="secondary">Connected</Badge>
							</div>
							{tokensLoading && (
								<Badge variant="outline">Loading tokens...</Badge>
							)}
						</div>
						{tokensError && (
							<div className="mt-2 text-red-600 text-sm">
								Failed to load tokens: {tokensError}
							</div>
						)}
					</CardContent>
				</Card>
			)}

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
						<Button
							variant="outline"
							onClick={() => setShowTokenASelector(true)}
							className="w-full h-auto flex items-center justify-between p-4"
						>
							<div className="flex items-center gap-3">
								{tokenA ? (
									<>
										{tokenA.icon && (
											<img
												src={tokenA.icon}
												alt={tokenA.symbol}
												className="h-6 w-6 rounded-full"
											/>
										)}
										<div className="text-left">
											<div className="font-medium">{tokenA.symbol}</div>
											<div className="text-muted-foreground text-sm">
												{tokenA.name}
											</div>
										</div>
									</>
								) : (
									<span className="text-muted-foreground">Select Token A</span>
								)}
							</div>
							<ChevronDown className="h-4 w-4" />
						</Button>
					</div>

					{/* Token B */}
					<div className="space-y-2">
						<Label>Token B</Label>
						<Button
							variant="outline"
							onClick={() => setShowTokenBSelector(true)}
							className="w-full h-auto flex items-center justify-between p-4"
						>
							<div className="flex items-center gap-3">
								{tokenB ? (
									<>
										{tokenB.icon && (
											<img
												src={tokenB.icon}
												alt={tokenB.symbol}
												className="h-6 w-6 rounded-full"
											/>
										)}
										<div className="text-left">
											<div className="font-medium">{tokenB.symbol}</div>
											<div className="text-muted-foreground text-sm">
												{tokenB.name}
											</div>
										</div>
									</>
								) : (
									<span className="text-muted-foreground">Select Token B</span>
								)}
							</div>
							<ChevronDown className="h-4 w-4" />
						</Button>
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
									{currentChainInfo?.displayName || `Chain ${chainId}`}
								</span>
							</div>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Error Display */}
			{mintError && mintStatus === "error" && (
				<Card className="border-red-500 bg-red-50 dark:bg-red-900/20">
					<CardContent className="pt-6">
						<div className="flex items-start gap-2">
							<AlertCircle className="mt-0.5 h-5 w-5 text-red-600 dark:text-red-500" />
							<div className="flex-1">
								<p className="font-medium text-red-800 dark:text-red-200">
									Transaction Failed
								</p>
								<p className="text-red-700 text-sm dark:text-red-300">
									{mintError}
								</p>
							</div>
						</div>
					</CardContent>
				</Card>
			)}

			{/* Mint Button */}
			<Button
				onClick={handleMintPosition}
				disabled={!isReady || isExecuting}
				variant={balanceError ? "destructive" : "default"}
				className="w-full"
				size="lg"
			>
				{getButtonText()}
			</Button>

			{/* Token Selectors */}
			<TokenSelectorV2
				isOpen={showTokenASelector}
				onClose={() => setShowTokenASelector(false)}
				onTokenSelect={handleTokenASelect}
				selectedToken={tokenA || undefined}
				tokens={tokens}
				loading={tokensLoading}
				error={tokensError ? new Error(tokensError) : undefined}
				title="Select Token A"
				subtitle="Choose the first token for your liquidity position"
				supportedChains={supportedChains}
				currentChainId={currentChainId?.toString()}
				onRefresh={() => currentChainId && refreshTokens(currentChainId)}
				showBalances={false}
				enableFilters={true}
				enableHistory={true}
			/>

			<TokenSelectorV2
				isOpen={showTokenBSelector}
				onClose={() => setShowTokenBSelector(false)}
				onTokenSelect={handleTokenBSelect}
				selectedToken={tokenB || undefined}
				tokens={tokens}
				loading={tokensLoading}
				error={tokensError ? new Error(tokensError) : undefined}
				title="Select Token B"
				subtitle="Choose the second token for your liquidity position"
				supportedChains={supportedChains}
				currentChainId={currentChainId?.toString()}
				onRefresh={() => currentChainId && refreshTokens(currentChainId)}
				showBalances={false}
				enableFilters={true}
				enableHistory={true}
			/>
		</div>
	);
}