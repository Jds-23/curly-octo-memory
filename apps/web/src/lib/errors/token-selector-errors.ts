/**
 * Enhanced Error Handling System for TokenSelector - Better-T-Stack Web App
 *
 * Provides comprehensive error types, handling, and recovery mechanisms
 * for the TokenSelector component ecosystem.
 */

import { useCallback, useState } from "react";

/**
 * Error types that can occur in the TokenSelector
 */
export enum TokenSelectorErrorType {
	// Network-related errors
	NETWORK_ERROR = "network_error",
	API_ERROR = "api_error",
	TIMEOUT_ERROR = "timeout_error",

	// Data validation errors
	VALIDATION_ERROR = "validation_error",
	PARSE_ERROR = "parse_error",
	TYPE_ERROR = "type_error",

	// Chain/Token specific errors
	CHAIN_NOT_SUPPORTED = "chain_not_supported",
	TOKEN_NOT_FOUND = "token_not_found",
	INVALID_ADDRESS = "invalid_address",

	// Balance/Wallet errors
	BALANCE_FETCH_ERROR = "balance_fetch_error",
	WALLET_NOT_CONNECTED = "wallet_not_connected",

	// Search errors
	SEARCH_ERROR = "search_error",
	SEARCH_TIMEOUT = "search_timeout",

	// Generic errors
	UNKNOWN_ERROR = "unknown_error",
}

/**
 * Severity levels for errors
 */
export enum ErrorSeverity {
	LOW = "low", // Minor issues, component still functional
	MEDIUM = "medium", // Some functionality affected
	HIGH = "high", // Major functionality affected
	CRITICAL = "critical", // Component unusable
}

/**
 * Enhanced error interface
 */
export interface TokenSelectorError {
	type: TokenSelectorErrorType;
	severity: ErrorSeverity;
	message: string;
	userMessage: string; // User-friendly message
	recoverable: boolean; // Whether the error can be recovered from
	retryAction?: () => void | Promise<void>;
	context?: Record<string, unknown>;
	originalError?: Error;
	timestamp: Date;
	componentContext?: string; // Which component/hook encountered the error
}

/**
 * Loading states for different operations
 */
export interface LoadingState {
	tokens: boolean;
	balances: boolean;
	search: boolean;
	chains: boolean;
	userTokens: boolean;
}

/**
 * Error state management interface
 */
export interface ErrorState {
	errors: TokenSelectorError[];
	hasErrors: boolean;
	hasCriticalErrors: boolean;
	isRecovering: boolean;
}

/**
 * Error factory for creating standardized errors
 */
export class TokenSelectorErrorFactory {
	static createNetworkError(
		originalError: Error,
		context?: Record<string, unknown>,
	): TokenSelectorError {
		return {
			type: TokenSelectorErrorType.NETWORK_ERROR,
			severity: ErrorSeverity.MEDIUM,
			message: `Network request failed: ${originalError.message}`,
			userMessage:
				"Network connection issue. Please check your connection and try again.",
			recoverable: true,
			context,
			originalError,
			timestamp: new Date(),
		};
	}

	static createAPIError(
		endpoint: string,
		status: number,
		message: string,
		retryAction?: () => void | Promise<void>,
	): TokenSelectorError {
		const severity = status >= 500 ? ErrorSeverity.HIGH : ErrorSeverity.MEDIUM;

		return {
			type: TokenSelectorErrorType.API_ERROR,
			severity,
			message: `API error (${status}): ${message}`,
			userMessage:
				status >= 500
					? "Server error. Please try again later."
					: "Unable to fetch token data. Please try again.",
			recoverable: true,
			retryAction,
			context: { endpoint, status },
			timestamp: new Date(),
		};
	}

	static createValidationError(
		field: string,
		value: unknown,
		expected: string,
	): TokenSelectorError {
		return {
			type: TokenSelectorErrorType.VALIDATION_ERROR,
			severity: ErrorSeverity.LOW,
			message: `Validation failed for ${field}: expected ${expected}, got ${typeof value}`,
			userMessage:
				"Invalid data format received. Please refresh and try again.",
			recoverable: true,
			context: { field, value, expected },
			timestamp: new Date(),
		};
	}

	static createChainNotSupportedError(chainId: string): TokenSelectorError {
		return {
			type: TokenSelectorErrorType.CHAIN_NOT_SUPPORTED,
			severity: ErrorSeverity.MEDIUM,
			message: `Chain ${chainId} is not supported`,
			userMessage: "This blockchain network is not currently supported.",
			recoverable: false,
			context: { chainId },
			timestamp: new Date(),
		};
	}

	static createTokenNotFoundError(
		address: string,
		chainId: string,
		searchAction?: () => void | Promise<void>,
	): TokenSelectorError {
		return {
			type: TokenSelectorErrorType.TOKEN_NOT_FOUND,
			severity: ErrorSeverity.LOW,
			message: `Token ${address} not found on chain ${chainId}`,
			userMessage: "Token not found. Please check the address and try again.",
			recoverable: true,
			retryAction: searchAction,
			context: { address, chainId },
			timestamp: new Date(),
		};
	}

	static createSearchError(
		query: string,
		originalError: Error,
		retryAction?: () => void | Promise<void>,
	): TokenSelectorError {
		return {
			type: TokenSelectorErrorType.SEARCH_ERROR,
			severity: ErrorSeverity.MEDIUM,
			message: `Search failed for query "${query}": ${originalError.message}`,
			userMessage: "Search failed. Please try a different search term.",
			recoverable: true,
			retryAction,
			context: { query },
			originalError,
			timestamp: new Date(),
		};
	}

	static createBalanceFetchError(
		address: string,
		chainId: string,
		originalError: Error,
	): TokenSelectorError {
		return {
			type: TokenSelectorErrorType.BALANCE_FETCH_ERROR,
			severity: ErrorSeverity.LOW,
			message: `Failed to fetch balances for ${address} on ${chainId}: ${originalError.message}`,
			userMessage:
				"Unable to load token balances. You can still select tokens manually.",
			recoverable: true,
			context: { address, chainId },
			originalError,
			timestamp: new Date(),
		};
	}

	static createTimeoutError(
		operation: string,
		timeout: number,
		retryAction?: () => void | Promise<void>,
	): TokenSelectorError {
		return {
			type: TokenSelectorErrorType.TIMEOUT_ERROR,
			severity: ErrorSeverity.MEDIUM,
			message: `Operation "${operation}" timed out after ${timeout}ms`,
			userMessage: "Request timed out. Please try again.",
			recoverable: true,
			retryAction,
			context: { operation, timeout },
			timestamp: new Date(),
		};
	}

	static createWalletNotConnectedError(): TokenSelectorError {
		return {
			type: TokenSelectorErrorType.WALLET_NOT_CONNECTED,
			severity: ErrorSeverity.MEDIUM,
			message: "Wallet not connected",
			userMessage: "Please connect your wallet to view token balances.",
			recoverable: true,
			timestamp: new Date(),
		};
	}
}

/**
 * React hook for error management
 */
export function useTokenSelectorErrors() {
	const [errors, setErrors] = useState<Map<string, TokenSelectorError>>(
		new Map(),
	);
	const [retryAttempts, setRetryAttempts] = useState<Map<string, number>>(
		new Map(),
	);

	const addError = useCallback(
		(error: TokenSelectorError, id?: string): string => {
			const errorId =
				id || `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
			setErrors((prev) => new Map(prev).set(errorId, error));
			return errorId;
		},
		[],
	);

	const removeError = useCallback((id: string): boolean => {
		setErrors((prev) => {
			const newErrors = new Map(prev);
			return newErrors.delete(id) ? newErrors : prev;
		});
		setRetryAttempts((prev) => {
			const newAttempts = new Map(prev);
			newAttempts.delete(id);
			return newAttempts;
		});
		return true;
	}, []);

	const clearErrors = useCallback((): void => {
		setErrors(new Map());
		setRetryAttempts(new Map());
	}, []);

	const attemptRecovery = useCallback(
		async (errorId: string, maxRetries = 3): Promise<boolean> => {
			const error = errors.get(errorId);
			if (!error || !error.recoverable) {
				return false;
			}

			const attempts = retryAttempts.get(errorId) || 0;
			if (attempts >= maxRetries) {
				return false;
			}

			setRetryAttempts((prev) => new Map(prev).set(errorId, attempts + 1));

			try {
				if (error.retryAction) {
					await error.retryAction();
				}

				// If we get here, the retry was successful
				removeError(errorId);
				return true;
			} catch (retryError) {
				// Retry failed, keep the original error
				return false;
			}
		},
		[errors, retryAttempts, removeError],
	);

	const getErrorState = useCallback((): ErrorState => {
		const errorList = Array.from(errors.values());
		const hasCriticalErrors = errorList.some(
			(e) => e.severity === ErrorSeverity.CRITICAL,
		);

		return {
			errors: errorList,
			hasErrors: errorList.length > 0,
			hasCriticalErrors,
			isRecovering: false, // This would be managed by component state
		};
	}, [errors]);

	const getErrorsForDisplay = useCallback((): TokenSelectorError[] => {
		return Array.from(errors.values()).filter(
			(error) => error.severity !== ErrorSeverity.LOW,
		);
	}, [errors]);

	return {
		addError,
		removeError,
		clearErrors,
		attemptRecovery,
		getErrorState,
		getErrorsForDisplay,
		errors: Array.from(errors.values()),
	};
}

/**
 * Utility functions for error handling
 */
export const ErrorUtils = {
	/**
	 * Convert a generic Error to TokenSelectorError
	 */
	fromGenericError(
		error: Error,
		type: TokenSelectorErrorType = TokenSelectorErrorType.UNKNOWN_ERROR,
		context?: Record<string, unknown>,
	): TokenSelectorError {
		return {
			type,
			severity: ErrorSeverity.MEDIUM,
			message: error.message,
			userMessage: "An unexpected error occurred. Please try again.",
			recoverable: true,
			context,
			originalError: error,
			timestamp: new Date(),
		};
	},

	/**
	 * Check if an error should be shown to the user
	 */
	shouldDisplayError(error: TokenSelectorError): boolean {
		return error.severity !== ErrorSeverity.LOW;
	},

	/**
	 * Get appropriate user message for error
	 */
	getUserMessage(error: TokenSelectorError): string {
		return error.userMessage || "An error occurred. Please try again.";
	},

	/**
	 * Format error for logging
	 */
	formatForLogging(error: TokenSelectorError): string {
		return JSON.stringify(
			{
				type: error.type,
				severity: error.severity,
				message: error.message,
				context: error.context,
				timestamp: error.timestamp,
				componentContext: error.componentContext,
			},
			null,
			2,
		);
	},

	/**
	 * Check if error is retryable
	 */
	isRetryable(error: TokenSelectorError): boolean {
		return error.recoverable && Boolean(error.retryAction);
	},

	/**
	 * Get error severity color for UI
	 */
	getSeverityColor(severity: ErrorSeverity): string {
		switch (severity) {
			case ErrorSeverity.LOW:
				return "blue";
			case ErrorSeverity.MEDIUM:
				return "yellow";
			case ErrorSeverity.HIGH:
				return "orange";
			case ErrorSeverity.CRITICAL:
				return "red";
			default:
				return "gray";
		}
	},
};
