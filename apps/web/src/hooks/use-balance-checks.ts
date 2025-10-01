import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { type Address, erc20Abi, zeroAddress } from "viem";
import { usePublicClient } from "wagmi";

interface TokenBalance {
	address: Address;
	chainId: number;
	decimals: number;
	requiredAmount: bigint;
}

interface BalanceInfo {
	address: Address;
	chainId: number;
	decimals: number;
	balance: bigint;
	requiredAmount: bigint;
	hasSufficientBalance: boolean;
}

interface UseBalanceChecksParams {
	tokens: TokenBalance[];
	owner: Address;
	enabled?: boolean;
}

/**
 * Hook to check ERC20 and native token balances for a user.
 * Returns balance information with flags indicating if the user has sufficient balance.
 *
 * @param tokens - Array of tokens with chain info, decimals, and required amounts
 * @param owner - Token owner address (usually user's wallet)
 * @param enabled - Whether the query should run (default: true)
 * @returns Object containing balances array, loading state, refetch function, and error
 */
export function useBalanceChecks({
	tokens,
	owner,
	enabled = true,
}: UseBalanceChecksParams) {
	// Group tokens by chainId to get the appropriate public client
	const chainIds = [...new Set(tokens.map((t) => t.chainId))];

	// We'll fetch from the first chainId's client for multi-chain scenarios
	// In production, you might want to create multiple clients or handle this differently
	const publicClient = usePublicClient({ chainId: chainIds[0] });

	// Create a serializable query key (convert bigints to strings)
	const queryKey = useMemo(() => {
		const serializedTokens = tokens.map((t) => ({
			address: t.address,
			chainId: t.chainId,
			decimals: t.decimals,
			requiredAmount: t.requiredAmount.toString(),
		}));
		return ["balance-checks", serializedTokens, owner];
	}, [tokens, owner]);

	const {
		data: balances = [],
		isLoading,
		refetch,
		error,
	} = useQuery({
		queryKey,
		queryFn: async (): Promise<BalanceInfo[]> => {
			if (!publicClient) {
				throw new Error("Public client not available");
			}

			// Separate native and ERC20 tokens
			const nativeTokens = tokens.filter(
				(token) => token.address.toLowerCase() === zeroAddress.toLowerCase(),
			);
			const erc20Tokens = tokens.filter(
				(token) => token.address.toLowerCase() !== zeroAddress.toLowerCase(),
			);

			// Fetch native token balances
			const nativeBalancePromises = nativeTokens.map(async (token) => {
				try {
					const balance = await publicClient.getBalance({
						address: owner,
					});

					return {
						address: token.address,
						chainId: token.chainId,
						decimals: token.decimals,
						balance,
						requiredAmount: token.requiredAmount,
						hasSufficientBalance: balance >= token.requiredAmount,
					};
				} catch (error) {
					console.error(
						`Error fetching native balance for chain ${token.chainId}:`,
						error,
					);
					return {
						address: token.address,
						chainId: token.chainId,
						decimals: token.decimals,
						balance: 0n,
						requiredAmount: token.requiredAmount,
						hasSufficientBalance: false,
					};
				}
			});

			// Fetch ERC20 token balances
			const erc20BalancePromises = erc20Tokens.map(async (token) => {
				try {
					const balance = await publicClient.readContract({
						address: token.address,
						abi: erc20Abi,
						functionName: "balanceOf",
						args: [owner],
					});

					return {
						address: token.address,
						chainId: token.chainId,
						decimals: token.decimals,
						balance,
						requiredAmount: token.requiredAmount,
						hasSufficientBalance: balance >= token.requiredAmount,
					};
				} catch (error) {
					console.error(
						`Error fetching balance for token ${token.address}:`,
						error,
					);
					return {
						address: token.address,
						chainId: token.chainId,
						decimals: token.decimals,
						balance: 0n,
						requiredAmount: token.requiredAmount,
						hasSufficientBalance: false,
					};
				}
			});

			// Combine all balance checks
			const allBalances = await Promise.all([
				...nativeBalancePromises,
				...erc20BalancePromises,
			]);

			return allBalances;
		},
		enabled: enabled && !!publicClient && !!owner && tokens.length > 0,
		staleTime: 10_000, // 10 seconds
		refetchOnWindowFocus: false,
	});

	return {
		balances,
		isLoading,
		refetch,
		error,
	};
}