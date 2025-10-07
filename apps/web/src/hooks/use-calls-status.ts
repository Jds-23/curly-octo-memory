import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import type { TransactionReceipt } from "viem";
import { useConfig } from "wagmi";
import { useCallsStatus as useWagmiCallsStatus } from "wagmi/experimental";

interface UseCallsStatusParams {
	id: string | undefined;
	mode?: "batch" | "sequential"; // Transaction execution mode
	transactionHashes?: string[]; // For sequential mode
	query?: {
		enabled?: boolean;
		refetchInterval?: number | ((query: any) => number | false);
	};
}

interface CallsStatusResult {
	status: "pending" | "success" | "failure";
	receipts?: TransactionReceipt[];
	transactionHash?: string; // First transaction hash
}

interface UseCallsStatusReturn {
	data: CallsStatusResult | undefined;
	isLoading: boolean;
	isSuccess: boolean;
	isError: boolean;
	refetch: () => void;
}

/**
 * Wrapper hook for useCallsStatus that provides unified status monitoring
 * for both batch (EIP-5792) and sequential transaction modes.
 *
 * @param params - Configuration including ID, mode, and query options
 * @returns Status data and loading states
 */
export function useCallsStatus({
	id,
	mode,
	transactionHashes,
	query = {},
}: UseCallsStatusParams): UseCallsStatusReturn {
	const config = useConfig();
	const { enabled = true, refetchInterval } = query;

	// Detect mode if not provided
	const detectedMode = useMemo(() => {
		if (mode) return mode;
		if (!id) return undefined;

		// Transaction hashes are 0x-prefixed 66 char strings
		if (id.startsWith("0x") && id.length === 66) {
			return "sequential";
		}

		// Otherwise assume batch
		return "batch";
	}, [id, mode]);

	// Batch mode status using wagmi
	const wagmiStatus = useWagmiCallsStatus({
		id: id ?? "",
		query: {
			enabled: enabled && !!id && detectedMode === "batch",
			refetchInterval:
				typeof refetchInterval === "function"
					? (query) => {
							const status = query.state.data?.status;
							if (status === "success" || status === "failure") {
								return false;
							}
							return refetchInterval(query);
						}
					: refetchInterval,
		},
	});

	// Sequential mode status using useQueries
	const sequentialReceipts = useQueries({
		queries:
			detectedMode === "sequential" && transactionHashes
				? transactionHashes.map((hash) => ({
						queryKey: ["transactionReceipt", hash],
						queryFn: async () => {
							const { getTransactionReceipt } = await import("viem/actions");
							const { getPublicClient } = await import("wagmi/actions");

							const client = getPublicClient(config);

							if (!client) {
								throw new Error("Public client not available");
							}

							return getTransactionReceipt(client, { hash: hash as `0x${string}` });
						},
						enabled: enabled && !!hash,
						refetchInterval: (query: any) => {
							// Stop polling if confirmed or reverted
							if (query.state.data?.status === "success" || query.state.data?.status === "reverted") {
								return false;
							}
							return typeof refetchInterval === "number" ? refetchInterval : 1000;
						},
					}))
				: [],
	});

	// Return batch mode status
	if (detectedMode === "batch" && wagmiStatus.data) {
		return {
			data: {
				status: wagmiStatus.data.status === "success" ? "success" : wagmiStatus.data.status === "failure" ? "failure" : "pending",
				receipts: wagmiStatus.data.receipts as TransactionReceipt[] | undefined,
				transactionHash: wagmiStatus.data.receipts?.[0]?.transactionHash,
			},
			isLoading: wagmiStatus.isLoading,
			isSuccess: wagmiStatus.data?.status === "success",
			isError: wagmiStatus.data?.status === "failure",
			refetch: wagmiStatus.refetch,
		};
	}

	// Return sequential mode status
	if (detectedMode === "sequential" && transactionHashes) {
		const allConfirmed = sequentialReceipts.every((r) => r.data?.status === "success");
		const anyFailed = sequentialReceipts.some((r) => r.data?.status === "reverted");
		const anyPending = sequentialReceipts.some((r) => r.isLoading || !r.data);

		return {
			data: {
				status: anyFailed ? "failure" : allConfirmed ? "success" : "pending",
				receipts: sequentialReceipts.map((r) => r.data).filter(Boolean) as TransactionReceipt[],
				transactionHash: transactionHashes[0],
			},
			isLoading: anyPending,
			isSuccess: allConfirmed && !anyFailed,
			isError: anyFailed,
			refetch: () => {
				sequentialReceipts.forEach((r) => r.refetch());
			},
		};
	}

	// Return empty state if no mode detected or no data yet
	return {
		data: undefined,
		isLoading: false,
		isSuccess: false,
		isError: false,
		refetch: () => {},
	};
}
