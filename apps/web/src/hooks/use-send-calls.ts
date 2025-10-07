import { useCallback, useMemo, useState } from "react";
import type { Address, Hex } from "viem";
import { useAccount, useConfig, useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import { useSendCalls as useWagmiSendCalls } from "wagmi/experimental";

interface Call {
	to: Address;
	data: Hex;
	value: bigint;
}

interface SendCallsParams {
	calls: Call[];
	capabilities?: Record<string, any>;
}

interface SendCallsResult {
	id: string; // Unique ID for tracking (batch ID or first tx hash)
	mode: "batch" | "sequential"; // Which mode was used
	transactionHashes?: string[]; // Array of tx hashes (only for sequential mode)
}

interface UseSendCallsParams {
	enable5792?: boolean; // Enable EIP-5792 batch transactions (default: true)
}

interface UseSendCallsReturn {
	sendCalls: (params: SendCallsParams) => Promise<SendCallsResult>;
	data: SendCallsResult | undefined;
	isPending: boolean;
	isSuccess: boolean;
	isError: boolean;
	error: Error | null;
	reset: () => void;
}

/**
 * Wrapper hook for useSendCalls that provides fallback to sequential execution
 * when EIP-5792 is not supported or disabled.
 *
 * @param enable5792 - Whether to use EIP-5792 batch transactions (default: true)
 * @returns Hook with sendCalls function and status
 */
export function useSendCalls({ enable5792 = true }: UseSendCallsParams = {}): UseSendCallsReturn {
	const config = useConfig();
	const { address } = useAccount();

	// Wagmi's batch send calls (EIP-5792)
	const wagmiSendCalls = useWagmiSendCalls();

	// Sequential transaction sending
	const { sendTransactionAsync } = useSendTransaction();

	// State management
	const [result, setResult] = useState<SendCallsResult | undefined>();
	const [isPending, setIsPending] = useState(false);
	const [isSuccess, setIsSuccess] = useState(false);
	const [isError, setIsError] = useState(false);
	const [error, setError] = useState<Error | null>(null);

	// Check if we should use batch mode
	const useBatchMode = useMemo(() => {
		return enable5792;
	}, [enable5792]);

	// Execute batch mode using wagmi's useSendCalls
	const executeBatchMode = useCallback(
		async (params: SendCallsParams): Promise<SendCallsResult> => {
			try {
				console.log("Executing in batch mode (EIP-5792)");

				wagmiSendCalls.sendCalls({
					calls: params.calls,
					capabilities: params.capabilities,
				});

				// Wait for the data to be available
				await new Promise((resolve) => setTimeout(resolve, 100));

				if (!wagmiSendCalls.data) {
					throw new Error("No batch ID returned");
				}

				return {
					id: wagmiSendCalls.data.id,
					mode: "batch",
				};
			} catch (err) {
				console.error("Batch mode execution failed:", err);
				throw err;
			}
		},
		[wagmiSendCalls],
	);

	// Execute sequential mode (one transaction at a time)
	const executeSequentialMode = useCallback(
		async (params: SendCallsParams): Promise<SendCallsResult> => {
			try {
				console.log("Executing in sequential mode (fallback)");

				const transactionHashes: string[] = [];

				for (let i = 0; i < params.calls.length; i++) {
					const call = params.calls[i];

					console.log(`Executing transaction ${i + 1}/${params.calls.length}`);

					// Send transaction
					const hash = await sendTransactionAsync({
						to: call.to,
						data: call.data,
						value: call.value,
					});

					transactionHashes.push(hash);
					console.log(`Transaction ${i + 1} sent:`, hash);

					// Wait for this transaction to be confirmed before proceeding to next
					// Use wagmi's waitForTransactionReceipt which handles polling automatically
					try {
						const { waitForTransactionReceipt } = await import("wagmi/actions");

						const receipt = await waitForTransactionReceipt(config, {
							hash: hash as `0x${string}`,
							confirmations: 1,
						});

						if (receipt.status === "reverted") {
							throw new Error(`Transaction ${i + 1} reverted`);
						}

						console.log(`Transaction ${i + 1} confirmed:`, receipt);
					} catch (err) {
						console.error(`Transaction ${i + 1} failed:`, err);
						throw err;
					}
				}

				return {
					id: transactionHashes[0], // Use first tx hash as ID
					mode: "sequential",
					transactionHashes,
				};
			} catch (err) {
				console.error("Sequential mode execution failed:", err);
				throw err;
			}
		},
		[sendTransactionAsync, config],
	);

	// Main sendCalls function
	const sendCalls = useCallback(
		async (params: SendCallsParams): Promise<SendCallsResult> => {
			if (!address) {
				throw new Error("Wallet not connected");
			}

			if (!params.calls || params.calls.length === 0) {
				throw new Error("No calls provided");
			}

			setIsPending(true);
			setIsError(false);
			setIsSuccess(false);
			setError(null);

			try {
				const result = useBatchMode
					? await executeBatchMode(params)
					: await executeSequentialMode(params);

				setResult(result);
				setIsSuccess(true);
				return result;
			} catch (err) {
				const error = err instanceof Error ? err : new Error("Transaction failed");
				setIsError(true);
				setError(error);
				throw error;
			} finally {
				setIsPending(false);
			}
		},
		[address, useBatchMode, executeBatchMode, executeSequentialMode],
	);

	// Reset function
	const reset = useCallback(() => {
		setResult(undefined);
		setIsPending(false);
		setIsSuccess(false);
		setIsError(false);
		setError(null);
	}, []);

	return {
		sendCalls,
		data: result,
		isPending,
		isSuccess,
		isError,
		error,
		reset,
	};
}
