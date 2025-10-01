import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { type Address, type Hex, encodeFunctionData, erc20Abi, zeroAddress } from "viem";
import { usePublicClient } from "wagmi";

interface TokenAmount {
	address: Address;
	amount: bigint;
}

interface UseAllowanceParams {
	tokens: TokenAmount[];
	spender: Address;
	owner: Address;
	chainId: number;
	enabled?: boolean;
}

interface ApprovalStep {
	token: Address;
	data: {
		to: Address;
		data: Hex;
		value: bigint;
	};
}

/**
 * Hook to check ERC20 token allowances and return approval transactions for insufficient allowances.
 * Automatically skips native tokens (0x0000000000000000000000000000000000000000).
 *
 * @param tokens - Array of token addresses and required amounts
 * @param spender - Address that needs approval (e.g., router, contract)
 * @param owner - Token owner address (usually user's wallet)
 * @param chainId - Chain ID for the blockchain network
 * @param enabled - Whether the query should run (default: true)
 * @returns Object containing steps (approval transactions), loading state, and refetch function
 */
export function useAllowance({
	tokens,
	spender,
	owner,
	chainId,
	enabled = true,
}: UseAllowanceParams) {
	const publicClient = usePublicClient({ chainId });

	// Create a serializable query key (convert bigints to strings)
	const queryKey = useMemo(() => {
		const serializedTokens = tokens.map((t) => ({
			address: t.address,
			amount: t.amount.toString(),
		}));
		return ["allowance", serializedTokens, spender, owner, chainId];
	}, [tokens, spender, owner, chainId]);

	const {
		data: steps = [],
		isLoading,
		refetch,
		error,
	} = useQuery({
		queryKey,
		queryFn: async (): Promise<ApprovalStep[]> => {
			if (!publicClient) {
				throw new Error("Public client not available");
			}
			// Filter out native tokens
			const erc20Tokens = tokens.filter(
				(token) => token.address.toLowerCase() !== zeroAddress.toLowerCase(),
			);

			if (erc20Tokens.length === 0) {
				return [];
			}

			// Check current allowances for all ERC20 tokens
			const allowanceChecks = await Promise.all(
				erc20Tokens.map(async (token) => {
					try {
						const requiredAmount =
							token.amount;

						const currentAllowance = await publicClient.readContract({
							address: token.address,
							abi: erc20Abi,
							functionName: "allowance",
							args: [owner, spender],
						});

						return {
							token: token.address,
							requiredAmount,
							currentAllowance,
							needsApproval: currentAllowance < requiredAmount,
						};
					} catch (error) {
						console.error(
							`Error checking allowance for token ${token.address}:`,
							error,
						);
						// Assume approval is needed if check fails
						return {
							token: token.address,
							requiredAmount:
									token.amount,
							currentAllowance: 0n,
							needsApproval: true,
						};
					}
				}),
			);

			// Generate approval transactions for tokens with insufficient allowance
			const approvalSteps: ApprovalStep[] = allowanceChecks
				.filter((check) => check.needsApproval)
				.map((check) => ({
					token: check.token,
					data: {
						to: check.token,
						data: encodeFunctionData({
							abi: erc20Abi,
							functionName: "approve",
							args: [spender, check.requiredAmount],
						}),
						value: 0n,
					},
				}));

			return approvalSteps;
		},
		enabled: enabled && !!publicClient && !!owner && tokens.length > 0,
		staleTime: 10_000, // 10 seconds
		refetchOnWindowFocus: false,
	});

	return {
		steps,
		isLoading,
		refetch,
		error,
	};
}