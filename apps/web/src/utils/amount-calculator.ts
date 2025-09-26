import { CurrencyAmount, type Token } from "@uniswap/sdk-core";
import { nearestUsableTick, Position } from "@uniswap/v3-sdk";
import { fetchPoolData, fromReadableAmount, type PoolData } from "./pool";

export interface CalculateAmountParams {
	tokenA: Token;
	tokenB: Token;
	feeTier: number;
	inputAmount: number;
	isTokenAInput: boolean; // true if tokenA amount is provided, false if tokenB
	fullRange: boolean;
	tickRange?: number;
}

export interface CalculatedAmounts {
	amountA: number;
	amountB: number;
	isValid: boolean;
	error?: string;
}

/**
 * Calculate the corresponding amount for the other token when one amount is provided
 */
export async function calculateDependentAmount(
	params: CalculateAmountParams,
): Promise<CalculatedAmounts> {
	try {
		const {
			tokenA,
			tokenB,
			feeTier,
			inputAmount,
			isTokenAInput,
			fullRange,
			tickRange = 500,
		} = params;

		if (inputAmount <= 0) {
			return {
				amountA: 0,
				amountB: 0,
				isValid: false,
				error: "Input amount must be greater than 0",
			};
		}

		// Fetch pool data
		console.log(`Fetching pool data for ${tokenA.symbol}/${tokenB.symbol} with fee tier ${feeTier}`);
		const poolData = await fetchPoolData(tokenA, tokenB, feeTier);
		if (!poolData) {
			console.warn(`No pool found for ${tokenA.symbol}/${tokenB.symbol} with fee tier ${feeTier}`);
			return {
				amountA: isTokenAInput ? inputAmount : 0,
				amountB: isTokenAInput ? 0 : inputAmount,
				isValid: false,
				error: "Pool not found for this token pair and fee tier",
			};
		}
		console.log(`Pool data fetched successfully:`, poolData);

		const { pool } = poolData;

		// Calculate tick boundaries
		const { tickLower, tickUpper } = calculateTickBoundaries(
			pool,
			fullRange,
			tickRange,
		);

		// Determine which token is token0 and token1 in the pool
		const token0IsA =
			pool.token0.address.toLowerCase() === tokenA.address.toLowerCase();

		let calculatedAmountA: number;
		let calculatedAmountB: number;

		if (isTokenAInput) {
			// TokenA amount is provided, calculate TokenB amount
			const inputAmountRaw = fromReadableAmount(inputAmount, tokenA.decimals);

			let position: Position;
			if (token0IsA) {
				// TokenA is token0, use fromAmount0
				position = Position.fromAmount0({
					pool,
					tickLower,
					tickUpper,
					amount0: inputAmountRaw.toString(),
					useFullPrecision: true,
				});
				calculatedAmountB = Number(position.amount1.toSignificant(6));
			} else {
				// TokenA is token1, use fromAmount1
				position = Position.fromAmount1({
					pool,
					tickLower,
					tickUpper,
					amount1: inputAmountRaw.toString(),
				});
				calculatedAmountB = Number(position.amount0.toSignificant(6));
			}
			calculatedAmountA = inputAmount;
		} else {
			// TokenB amount is provided, calculate TokenA amount
			const inputAmountRaw = fromReadableAmount(inputAmount, tokenB.decimals);

			let position: Position;
			if (token0IsA) {
				// TokenB is token1, use fromAmount1
				position = Position.fromAmount1({
					pool,
					tickLower,
					tickUpper,
					amount1: inputAmountRaw.toString(),
				});
				calculatedAmountA = Number(position.amount0.toSignificant(6));
			} else {
				// TokenB is token0, use fromAmount0
				position = Position.fromAmount0({
					pool,
					tickLower,
					tickUpper,
					amount0: inputAmountRaw.toString(),
					useFullPrecision: true,
				});
				calculatedAmountA = Number(position.amount1.toSignificant(6));
			}
			calculatedAmountB = inputAmount;
		}

		return {
			amountA: calculatedAmountA,
			amountB: calculatedAmountB,
			isValid: true,
		};
	} catch (error) {
		console.error("Error calculating dependent amount:", error);
		return {
			amountA: params.isTokenAInput ? params.inputAmount : 0,
			amountB: params.isTokenAInput ? 0 : params.inputAmount,
			isValid: false,
			error: `Calculation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
		};
	}
}

/**
 * Calculate tick boundaries based on range settings
 */
function calculateTickBoundaries(
	pool: any,
	fullRange: boolean,
	tickRange: number,
): { tickLower: number; tickUpper: number } {
	if (fullRange) {
		const MIN_TICK = -887272;
		const MAX_TICK = 887272;
		return {
			tickLower: nearestUsableTick(MIN_TICK, pool.tickSpacing),
			tickUpper: nearestUsableTick(MAX_TICK, pool.tickSpacing),
		};
	}

	const currentTick = pool.tickCurrent;
	return {
		tickLower: nearestUsableTick(currentTick - tickRange, pool.tickSpacing),
		tickUpper: nearestUsableTick(currentTick + tickRange, pool.tickSpacing),
	};
}

/**
 * Get the current price ratio between two tokens
 */
export async function getCurrentPriceRatio(
	tokenA: Token,
	tokenB: Token,
	feeTier: number,
): Promise<number | null> {
	try {
		const poolData = await fetchPoolData(tokenA, tokenB, feeTier);
		if (!poolData) return null;

		const { pool } = poolData;
		const token0IsA =
			pool.token0.address.toLowerCase() === tokenA.address.toLowerCase();

		if (token0IsA) {
			// Price of tokenA (token0) in terms of tokenB (token1)
			return Number(pool.token0Price.toSignificant(6));
		}
		// Price of tokenA (token1) in terms of tokenB (token0)
		return Number(pool.token1Price.toSignificant(6));
	} catch (error) {
		console.error("Error getting current price ratio:", error);
		return null;
	}
}
