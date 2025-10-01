import { useCallback, useEffect, useMemo, useState } from "react";
import { type Address, type Hex, type TransactionRequest, formatUnits, parseUnits, zeroAddress } from "viem";
import { useSendCalls, useCallsStatus } from "wagmi/experimental";
import { useBalanceChecks } from "./use-balance-checks";
import type { Token } from "@/types/token";
import { trpcClient } from "@/utils/trpc";

type Status =
	| "idle"
	| "checking-balance"
	| "preparing"
	| "checking-allowance"
	| "executing"
	| "confirming"
	| "success"
	| "error";

interface UseMintPositionParams {
	tokenA: Token | null;
	tokenB: Token | null;
	amountA: string;
	amountB: string;
	feeTier: number;
	fullRange: boolean;
	tickRange: number;
	slippageTolerance: number;
	owner: Address | undefined;
	chainId: number;
}

interface BalanceInfo {
	address: Address;
	chainId: number;
	decimals: number;
	balance: bigint;
	requiredAmount: bigint;
	hasSufficientBalance: boolean;
}

interface UseMintPositionReturn {
	execute: () => Promise<void>;
	status: Status;
	balances: BalanceInfo[];
	balancesLoading: boolean;
	error: string | null;
	balanceError: string | null;
	transactionHash: string | null;
	callsId: string | undefined;
	isReady: boolean;
	isExecuting: boolean;
	reset: () => void;
}

/**
 * Hook to handle the complete mint position transaction flow
 * Includes balance checks, allowance verification, and batched transaction execution
 */
export function useMintPosition({
	tokenA,
	tokenB,
	amountA,
	amountB,
	feeTier,
	fullRange,
	tickRange,
	slippageTolerance,
	owner,
	chainId,
}: UseMintPositionParams): UseMintPositionReturn {
	// Internal state
	const [status, setStatus] = useState<Status>("idle");
	const [error, setError] = useState<string | null>(null);

	// Parse amounts to bigint for balance checks
	const tokensForBalanceCheck = useMemo(() => {
		if (!tokenA || !tokenB || !amountA || !amountB) return [];

		try {
			return [
				{
					address: tokenA.address as Address,
					chainId: Number.parseInt(tokenA.chainId),
					decimals: tokenA.decimals,
					requiredAmount: parseUnits(amountA, tokenA.decimals),
				},
				{
					address: tokenB.address as Address,
					chainId: Number.parseInt(tokenB.chainId),
					decimals: tokenB.decimals,
					requiredAmount: parseUnits(amountB, tokenB.decimals),
				},
			];
		} catch {
			return [];
		}
	}, [tokenA, tokenB, amountA, amountB]);

	// Balance checks
	const {
		balances,
		isLoading: balancesLoading,
		error: balancesError,
	} = useBalanceChecks({
		tokens: tokensForBalanceCheck,
		owner: owner!,
		enabled: !!owner && tokensForBalanceCheck.length > 0,
	});

	// Allowance checks will be done manually after we have the router address

	// Batch transaction execution
	const { data: callsId, sendCalls } = useSendCalls();

	// Status monitoring - only call when we have a callsId
	const { data: callsStatus } = useCallsStatus({
		id: callsId?.id ?? "",
		query: {
			enabled: !!callsId?.id,
			refetchInterval: (query) => {
				const status = query.state.data?.status;
				// Stop polling if transaction is confirmed or failed
				if (status === "success" || status === "failure") {
					return false;
				}
				return 1000; // Poll every second
			},
		},
	});

	// Helper function to get token symbol from address
	const getTokenSymbol = useCallback(
		(address: Address): string => {
			if (address.toLowerCase() === zeroAddress.toLowerCase()) {
				return "ETH"; // or based on chain
			}
			if (tokenA?.address.toLowerCase() === address.toLowerCase()) {
				return tokenA.symbol;
			}
			if (tokenB?.address.toLowerCase() === address.toLowerCase()) {
				return tokenB.symbol;
			}
			return "Token";
		},
		[tokenA, tokenB],
	);

	// Generate balance error message
	const balanceError = useMemo(() => {
		if (balancesLoading || !tokenA || !tokenB || balances.length === 0) return null;

		const insufficient = balances.filter((b) => !b.hasSufficientBalance);

		if (insufficient.length === 0) return null;

		if (insufficient.length === 1) {
			const token = insufficient[0];
			const shortage = token.requiredAmount - token.balance;
			const formattedShortage = formatUnits(shortage, token.decimals);
			return `Need ${formattedShortage} more ${getTokenSymbol(token.address)}`;
		}

		const symbols = insufficient.map((b) => getTokenSymbol(b.address)).join(" and ");
		return `Insufficient ${symbols} balance`;
	}, [balances, balancesLoading, tokenA, tokenB, getTokenSymbol]);

	// Check if ready to execute
	const isReady = useMemo(() => {
		return (
			!!tokenA &&
			!!tokenB &&
			!!amountA &&
			!!amountB &&
			!!owner &&
			!balanceError &&
			!balancesLoading &&
			status === "idle"
		);
	}, [tokenA, tokenB, amountA, amountB, owner, balanceError, balancesLoading, status]);

	// Check if currently executing
	const isExecuting = useMemo(() => {
		return ["checking-balance", "preparing", "checking-allowance", "executing", "confirming"].includes(status);
	}, [status]);

	// Execute transaction flow
	const execute = useCallback(async () => {
		if (!tokenA || !tokenB || !owner) {
			setError("Missing required parameters");
			setStatus("error");
			return;
		}

		try {
			// 1. Check balances
			setStatus("checking-balance");
			setError(null);

			if (balances.some((b) => !b.hasSufficientBalance)) {
				// Balance error is already computed and shown in button
				setStatus("idle");
				return;
			}

			// 2. Prepare transaction via tRPC
			setStatus("preparing");

			const result = await trpcClient.uniswap.mintPosition.mutate({
				tokenA: {
					address: tokenA.address,
					symbol: tokenA.symbol,
					name: tokenA.name,
					decimals: tokenA.decimals,
					chainId: Number.parseInt(tokenA.chainId),
				},
				tokenB: {
					address: tokenB.address,
					symbol: tokenB.symbol,
					name: tokenB.name,
					decimals: tokenB.decimals,
					chainId: Number.parseInt(tokenB.chainId),
				},
				amountA: Number.parseFloat(amountA),
				amountB: Number.parseFloat(amountB),
				feeTier,
				fullRange,
				tickRange: fullRange ? 0 : tickRange,
				slippageTolerance,
				recipient: owner,
			});

			if (!result.success || !result.transactionData) {
				setError(result.message || "Failed to prepare transaction");
				setStatus("error");
				return;
			}

			// 3. Extract transaction data and router address
			const txData = result.transactionData as unknown as TransactionRequest;
			const routerAddr = txData.to as Address;

			// 4. Check allowances manually now that we have the router address
			setStatus("checking-allowance");

			// We'll use viem directly to check allowances
			const { createPublicClient, http, erc20Abi, encodeFunctionData, zeroAddress: zero } =
				await import("viem");

			const client = createPublicClient({
				chain:
					chainId === 1
						? (await import("viem/chains")).mainnet
						: chainId === 137
							? (await import("viem/chains")).polygon
							: chainId === 10
								? (await import("viem/chains")).optimism
								: chainId === 8453
									? (await import("viem/chains")).base
									: (await import("viem/chains")).arbitrum,
				transport: http(),
			});

			// Parse token amounts
			const tokensToCheck = [
				{
					address: tokenA.address as Address,
					amount: parseUnits(amountA, tokenA.decimals),
				},
				{
					address: tokenB.address as Address,
					amount: parseUnits(amountB, tokenB.decimals),
				},
			];

			// Filter out native tokens and check allowances
			const erc20Tokens = tokensToCheck.filter(
				(token) => token.address.toLowerCase() !== zero.toLowerCase(),
			);

			const approvalStepsTemp: Array<{
				token: Address;
				data: { to: Address; data: Hex; value: bigint };
			}> = [];

			for (const token of erc20Tokens) {
				try {
					const currentAllowance = await client.readContract({
						address: token.address,
						abi: erc20Abi,
						functionName: "allowance",
						args: [owner, routerAddr],
					});

					if (currentAllowance < token.amount) {
						// Need approval
						approvalStepsTemp.push({
							token: token.address,
							data: {
								to: token.address,
								data: encodeFunctionData({
									abi: erc20Abi,
									functionName: "approve",
									args: [routerAddr, token.amount],
								}),
								value: 0n,
							},
						});
					}
				} catch (error) {
					console.error(`Error checking allowance for token ${token.address}:`, error);
					// Assume approval is needed if check fails
					approvalStepsTemp.push({
						token: token.address,
						data: {
							to: token.address,
							data: encodeFunctionData({
								abi: erc20Abi,
								functionName: "approve",
								args: [routerAddr, token.amount],
							}),
							value: 0n,
						},
					});
				}
			}


			// 5. Build batch calls (approvals + mint)
			const calls: Array<{ to: Address; data: Hex; value: bigint }> = [];

			debugger
			// Add approval transactions if needed
			for (const step of approvalStepsTemp) {
				calls.push({
					to: step.data.to,
					data: step.data.data,
					value: step.data.value,
				});
			}

			// Add mint transaction
			calls.push({
				to: txData.to as Address,
				data: txData.data as Hex,
				value: (txData.value as bigint) || 0n,
			});

			// 6. Execute batch transaction
			setStatus("executing");
			await sendCalls({
				calls,
			});

			setStatus("confirming");
		} catch (err) {
			console.error("Mint position error:", err);
			setError(err instanceof Error ? err.message : "Transaction failed");
			setStatus("error");
		}
	}, [tokenA, tokenB, owner, balances, amountA, amountB, feeTier, fullRange, tickRange, slippageTolerance, chainId, sendCalls]);

	// Reset function
	const reset = useCallback(() => {
		setStatus("idle");
		setError(null);
	}, []);

	// Monitor transaction status
	useEffect(() => {
		if (!callsStatus) return;

		const txStatus = callsStatus.status;

		if (txStatus === "success") {
			setStatus("success");
		} else if (txStatus === "failure") {
			setError("Transaction failed");
			setStatus("error");
		}
	}, [callsStatus]);

	// Extract transaction hash from receipts if available
	const transactionHash = callsStatus?.receipts?.[0]?.transactionHash || null;

	return {
		execute,
		status,
		balances,
		balancesLoading,
		error: error || (balancesError as Error)?.message || null,
		balanceError,
		transactionHash,
		callsId: callsId?.id,
		isReady,
		isExecuting,
		reset,
	};
}