import {
	type Address,
	encodeFunctionData,
	type Hex,
	type TransactionRequest,
} from "viem";
import { arbitrum, base, mainnet, optimism, polygon } from "viem/chains";
import { z } from "zod";
import { publicProcedure, router } from "../lib/trpc";

// Type definitions
export interface Token {
	chainId: number;
	address: Address;
	decimals: number;
	symbol: string;
	name: string;
}

// API Response types
interface MintPositionSuccessResponse {
	success: true;
	message: string;
	transactionData: {
		to: Address;
		data: Hex;
		value: string; // Use string instead of BigInt for tRPC serialization
		gas: string; // Use string instead of BigInt for tRPC serialization
	};
	position: {
		tokenA: Token;
		tokenB: Token;
		amountA: number;
		amountB: number;
		feeTier: number;
		tickLower: number;
		tickUpper: number;
		liquidity: string;
	};
}

interface MintPositionErrorResponse {
	success: false;
	message: string;
}

type MintPositionResponse =
	| MintPositionSuccessResponse
	| MintPositionErrorResponse;

interface PositionsSuccessResponse {
	success: true;
	positions: Position[];
	message: string;
}

interface PositionsErrorResponse {
	success: false;
	positions: [];
	message: string;
}

type PositionsResponse = PositionsSuccessResponse | PositionsErrorResponse;

interface PositionDetailsSuccessResponse {
	success: true;
	position: any; // Keep flexible for now due to complex position structure
}

interface PositionDetailsErrorResponse {
	success: false;
	position: null;
	message: string;
}

type PositionDetailsResponse =
	| PositionDetailsSuccessResponse
	| PositionDetailsErrorResponse;

// ChainId constants for supported mainnet chains
const ChainId = {
	MAINNET: 1,
	POLYGON: 137,
	OPTIMISM: 10,
	BASE: 8453,
	ARBITRUM: 42161,
} as const;

// Helper function to calculate nearest usable tick
function nearestUsableTick(tick: number, tickSpacing: number): number {
	return Math.round(tick / tickSpacing) * tickSpacing;
}

const UNISWAP_INTERFACE_API_URL =
	"https://interface.gateway.uniswap.org/v2/pools.v1.PoolsService/ListPositions";

// Types and interfaces based on Uniswap Interface API
export interface ApiToken {
	chainId: number;
	address: string;
	symbol: string;
	decimals: number;
	name: string;
	isNative?: boolean;
}

interface PoolPosition {
	tokenId: string;
	tickLower: string;
	tickUpper: string;
	liquidity: string;
	token0: ApiToken;
	token1: ApiToken;
	feeTier: string;
	currentTick: string;
	currentPrice: string;
	tickSpacing: string;
	token0UncollectedFees: string;
	token1UncollectedFees: string;
	amount0: string;
	amount1: string;
	poolId: string;
	totalLiquidityUsd: string;
	currentLiquidity: string;
	apr: number;
	totalApr: number;
}

interface V4Position {
	poolPosition: PoolPosition;
	hooks: Array<{
		address: string;
	}>;
}

export interface Position {
	chainId: number;
	protocolVersion: string;
	v4Position?: V4Position;
	v3Position?: PoolPosition;
	v2Position?: any; // V2 positions have different structure
	status: string;
	timestamp: number;
}

interface ListPositionsResponse {
	positions: Position[];
}

// Constants for Uniswap v4 contracts
const CONTRACTS = {
	STATE_VIEW_ADDRESS: "0x86e8631a016f9068c3f085faf484ee3f5fdee8f2" as Address, // StateView contract
	POSITION_MANAGER: "0x4529a01c7a0410167c5740c487a8de60232617bf" as Address, // Position Manager (Unichain)
	PERMIT2: "0x000000000022D473030F116dDEE9F6B43aC78BA3" as Address,
} as const;

// Uniswap v4 Position Manager ABI (focused on modifyLiquidities function)
const POSITION_MANAGER_ABI = [
	{
		inputs: [
			{ name: "unlockData", type: "bytes" },
			{ name: "deadline", type: "uint256" },
		],
		name: "modifyLiquidities",
		outputs: [],
		stateMutability: "payable",
		type: "function",
	},
] as const;

// Actions enum for Uniswap v4 Position Manager
const Actions = {
	INCREASE_LIQUIDITY: 0,
	INCREASE_LIQUIDITY_FROM_DELTAS: 1,
	DECREASE_LIQUIDITY: 2,
	MINT_POSITION: 3,
	MINT_POSITION_FROM_DELTAS: 4,
	BURN_POSITION: 5,
	SETTLE_PAIR: 6,
	TAKE_PAIR: 7,
	SETTLE: 8,
	TAKE: 9,
	CLOSE_CURRENCY: 10,
	CLEAR_OR_TAKE: 11,
	SWEEP: 12,
	WRAP: 13,
	UNWRAP: 14,
} as const;

// Chain configurations for all supported mainnet chains
const CHAIN_CONFIGS: { [key: number]: { chain: any; rpcUrl: string } } = {
	[ChainId.MAINNET]: {
		chain: mainnet,
		rpcUrl: "https://ethereum-rpc.publicnode.com",
	},
	[ChainId.POLYGON]: {
		chain: polygon,
		rpcUrl: "https://polygon-rpc.com",
	},
	[ChainId.OPTIMISM]: {
		chain: optimism,
		rpcUrl: "https://mainnet.optimism.io",
	},
	[ChainId.BASE]: {
		chain: base,
		rpcUrl: "https://mainnet.base.org",
	},
	[ChainId.ARBITRUM]: {
		chain: arbitrum,
		rpcUrl: "https://arb1.arbitrum.io/rpc",
	},
};

// Helper function to call Uniswap Interface API
async function fetchPositionsFromUniswap(
	address: string,
): Promise<ListPositionsResponse> {
	const response = await fetch(UNISWAP_INTERFACE_API_URL, {
		method: "POST",
		headers: {
			accept: "*/*",
			"accept-language": "en-US,en;q=0.9",
			"connect-protocol-version": "1",
			"content-type": "application/json",
			origin: "https://app.uniswap.org",
			referer: "https://app.uniswap.org/",
			"user-agent":
				"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
		},
		body: JSON.stringify({
			address: address,
			chainIds: [
				1, 130, 8453, 42161, 137, 10, 56, 43114, 480, 324, 1868, 7777777, 42220,
				81457,
			], // All supported chains
			protocolVersions: [
				"PROTOCOL_VERSION_V4",
				"PROTOCOL_VERSION_V3",
				"PROTOCOL_VERSION_V2",
			],
			positionStatuses: [
				"POSITION_STATUS_IN_RANGE",
				"POSITION_STATUS_OUT_OF_RANGE",
			],
			pageSize: 100, // Fetch more positions
			pageToken: "",
			includeHidden: true,
		}),
	});

	if (!response.ok) {
		throw new Error(
			`Uniswap API error: ${response.status} ${response.statusText}`,
		);
	}

	return response.json() as Promise<ListPositionsResponse>;
}

// tRPC router
export const uniswapRouter = router({
	getPositions: publicProcedure
		.input(
			z.object({
				owner: z
					.string()
					.regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
			}),
		)
		.query(async ({ input }) => {
			try {
				const { owner } = input;

				// Fetch positions from Uniswap Interface API
				const response = await fetchPositionsFromUniswap(owner);

				if (!response.positions || response.positions.length === 0) {
					return {
						success: true,
						positions: [],
						message: "No positions found for this address",
					} satisfies PositionsResponse;
				}

				// Transform positions to a consistent format
				const transformedPositions = response.positions
					.map((position) => {
						// Get pool position data based on protocol version
						let poolPosition: PoolPosition | undefined;
						let hooks: string[] = [];

						if (position.v4Position) {
							poolPosition = position.v4Position.poolPosition;
							hooks = position.v4Position.hooks.map((h) => h.address);
						} else if (position.v3Position) {
							poolPosition = position.v3Position;
						} else if (position.v2Position) {
							// V2 positions have different structure, handle separately if needed
							return null;
						}

						if (!poolPosition) return null;

						return {
							tokenId: poolPosition.tokenId,
							chainId: position.chainId,
							protocolVersion: position.protocolVersion,
							status: position.status,
							timestamp: position.timestamp,
							tickLower: Number.parseInt(poolPosition.tickLower),
							tickUpper: Number.parseInt(poolPosition.tickUpper),
							liquidity: poolPosition.liquidity,
							token0: poolPosition.token0,
							token1: poolPosition.token1,
							feeTier: Number.parseInt(poolPosition.feeTier),
							currentTick: Number.parseInt(poolPosition.currentTick),
							currentPrice: poolPosition.currentPrice,
							tickSpacing: Number.parseInt(poolPosition.tickSpacing),
							token0UncollectedFees: poolPosition.token0UncollectedFees,
							token1UncollectedFees: poolPosition.token1UncollectedFees,
							amount0: poolPosition.amount0,
							amount1: poolPosition.amount1,
							poolId: poolPosition.poolId,
							totalLiquidityUsd: poolPosition.totalLiquidityUsd,
							currentLiquidity: poolPosition.currentLiquidity,
							apr: poolPosition.apr,
							totalApr: poolPosition.totalApr,
							hooks: hooks,
						};
					})
					.filter(Boolean); // Remove null values

				return {
					success: true,
					positions: transformedPositions as Position[],
					message: `Found ${transformedPositions.length} positions`,
				} satisfies PositionsResponse;
			} catch (error) {
				console.error("Error fetching positions:", error);
				return {
					success: false,
					positions: [],
					message: `Error fetching positions: ${error instanceof Error ? error.message : "Unknown error"}`,
				} satisfies PositionsResponse;
			}
		}),

	getPositionDetails: publicProcedure
		.input(
			z.object({
				owner: z
					.string()
					.regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
				tokenId: z.string().regex(/^\d+$/, "Token ID must be a numeric string"),
			}),
		)
		.query(async ({ input }) => {
			try {
				const { owner, tokenId } = input;

				// Fetch all positions and find the specific one
				const response = await fetchPositionsFromUniswap(owner);
				const position = response.positions.find((p) => {
					const poolPos = p.v4Position?.poolPosition || p.v3Position;
					return poolPos?.tokenId === tokenId;
				});

				if (!position) {
					return {
						success: false,
						position: null,
						message: "Position not found",
					} satisfies PositionDetailsResponse;
				}

				// Transform the position data
				let poolPosition: PoolPosition | undefined;
				let hooks: string[] = [];

				if (position.v4Position) {
					poolPosition = position.v4Position.poolPosition;
					hooks = position.v4Position.hooks.map((h) => h.address);
				} else if (position.v3Position) {
					poolPosition = position.v3Position;
				}

				if (!poolPosition) {
					return {
						success: false,
						position: null,
						message: "Unsupported position type",
					} satisfies PositionDetailsResponse;
				}

				const transformedPosition = {
					tokenId: poolPosition.tokenId,
					chainId: position.chainId,
					protocolVersion: position.protocolVersion,
					status: position.status,
					timestamp: position.timestamp,
					tickLower: Number.parseInt(poolPosition.tickLower),
					tickUpper: Number.parseInt(poolPosition.tickUpper),
					liquidity: poolPosition.liquidity,
					token0: poolPosition.token0,
					token1: poolPosition.token1,
					feeTier: Number.parseInt(poolPosition.feeTier),
					currentTick: Number.parseInt(poolPosition.currentTick),
					currentPrice: poolPosition.currentPrice,
					tickSpacing: Number.parseInt(poolPosition.tickSpacing),
					token0UncollectedFees: poolPosition.token0UncollectedFees,
					token1UncollectedFees: poolPosition.token1UncollectedFees,
					amount0: poolPosition.amount0,
					amount1: poolPosition.amount1,
					poolId: poolPosition.poolId,
					totalLiquidityUsd: poolPosition.totalLiquidityUsd,
					currentLiquidity: poolPosition.currentLiquidity,
					apr: poolPosition.apr,
					totalApr: poolPosition.totalApr,
					hooks: hooks,
				};

				return {
					success: true,
					position: transformedPosition,
				} satisfies PositionDetailsResponse;
			} catch (error) {
				console.error("Error fetching position details:", error);
				return {
					success: false,
					position: null,
					message: `Error fetching position details: ${error instanceof Error ? error.message : "Unknown error"}`,
				} satisfies PositionDetailsResponse;
			}
		}),

	mintPosition: publicProcedure
		.input(
			z.object({
				tokenA: z.object({
					address: z
						.string()
						.regex(/^0x[a-fA-F0-9]{40}$/, "Invalid token address"),
					symbol: z.string(),
					name: z.string(),
					decimals: z.number(),
					chainId: z.number(),
				}),
				tokenB: z.object({
					address: z
						.string()
						.regex(/^0x[a-fA-F0-9]{40}$/, "Invalid token address"),
					symbol: z.string(),
					name: z.string(),
					decimals: z.number(),
					chainId: z.number(),
				}),
				amountA: z.number().positive(),
				amountB: z.number().positive(),
				feeTier: z.number(),
				fullRange: z.boolean(),
				tickRange: z.number().optional(),
				slippageTolerance: z.number().min(0.1).max(50),
				recipient: z
					.string()
					.regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
			}),
		)
		.mutation(async ({ input }) => {
			try {
				const {
					tokenA,
					tokenB,
					amountA,
					amountB,
					feeTier,
					fullRange,
					tickRange = 500,
					// slippageTolerance, // Currently unused
					recipient,
				} = input;

				// Validate chain support
				const chainConfig = CHAIN_CONFIGS[tokenA.chainId];
				if (!chainConfig) {
					return {
						success: false,
						message: `Unsupported chain ID: ${tokenA.chainId}`,
					} satisfies MintPositionResponse;
				}

				// Create token definitions
				const token0: Token = {
					chainId: tokenA.chainId,
					address: (tokenA.address ===
					"0x0000000000000000000000000000000000000000"
						? "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" // WETH for ETH
						: tokenA.address) as Address,
					decimals: tokenA.decimals,
					symbol: tokenA.symbol,
					name: tokenA.name,
				};

				const token1: Token = {
					chainId: tokenB.chainId,
					address: (tokenB.address ===
					"0x0000000000000000000000000000000000000000"
						? "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" // WETH for ETH
						: tokenB.address) as Address,
					decimals: tokenB.decimals,
					symbol: tokenB.symbol,
					name: tokenB.name,
				};

				// Ensure token ordering (token0 < token1)
				const [sortedToken0, sortedToken1] =
					token0.address.toLowerCase() < token1.address.toLowerCase()
						? [token0, token1]
						: [token1, token0];

				const token0IsA = sortedToken0.address === token0.address;

				// Calculate tick spacing based on fee tier
				const getTickSpacing = (feeTier: number): number => {
					switch (feeTier) {
						case 100:
							return 1; // 0.01%
						case 500:
							return 10; // 0.05%
						case 3000:
							return 60; // 0.3%
						case 10000:
							return 200; // 1%
						default:
							return 60; // Default to 0.3% fee tier
					}
				};

				const tickSpacing = getTickSpacing(feeTier);

				// Calculate tick boundaries
				let tickLower: number;
				let tickUpper: number;

				if (fullRange) {
					const MIN_TICK = -887272;
					const MAX_TICK = 887272;
					tickLower = nearestUsableTick(MIN_TICK, tickSpacing);
					tickUpper = nearestUsableTick(MAX_TICK, tickSpacing);
				} else {
					// Use a mock current tick for demonstration
					const currentTick = 0; // In production, fetch this from the pool
					tickLower = nearestUsableTick(currentTick - tickRange, tickSpacing);
					tickUpper = nearestUsableTick(currentTick + tickRange, tickSpacing);
				}

				// Convert amounts to token units
				const amountADesired = BigInt(
					Math.floor(amountA * 10 ** tokenA.decimals),
				);
				const amountBDesired = BigInt(
					Math.floor(amountB * 10 ** tokenB.decimals),
				);

				const amount0Desired = token0IsA
					? amountADesired.toString()
					: amountBDesired.toString();
				const amount1Desired = token0IsA
					? amountBDesired.toString()
					: amountADesired.toString();

				// Calculate slippage tolerance in basis points (for future use)
				// const slippageToleranceBps = Math.floor(slippageTolerance * 100);
				const deadline = Math.floor(Date.now() / 1000) + 20 * 60; // 20 minutes

				// Calculate amounts with slippage tolerance (for future use in more complex implementations)
				// const amount0Min = (BigInt(amount0Desired) * BigInt(10000 - slippageToleranceBps)) / BigInt(10000);
				// const amount1Min = (BigInt(amount1Desired) * BigInt(10000 - slippageToleranceBps)) / BigInt(10000);

				// Check if we need to send ETH value (for native currency handling)
				const isToken0Native =
					sortedToken0.address ===
						"0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" &&
					(tokenA.address === "0x0000000000000000000000000000000000000000" ||
						tokenB.address === "0x0000000000000000000000000000000000000000");
				const isToken1Native =
					sortedToken1.address ===
						"0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" &&
					(tokenA.address === "0x0000000000000000000000000000000000000000" ||
						tokenB.address === "0x0000000000000000000000000000000000000000");

				// Calculate ETH value to send
				let ethValue = "0";
				if (isToken0Native) {
					ethValue = amount0Desired.toString();
				} else if (isToken1Native) {
					ethValue = amount1Desired.toString();
				}

				// Encode the mint position parameters (for future use in more complete implementation)
				// For Uniswap v4, we need to encode actions and their parameters
				// const mintParams = {
				//   poolKey: {
				//     currency0: sortedToken0.address,
				//     currency1: sortedToken1.address,
				//     fee: feeTier,
				//     tickSpacing: tickSpacing,
				//     hooks: "0x0000000000000000000000000000000000000000", // No hooks for basic positions
				//   },
				//   tickLower: tickLower,
				//   tickUpper: tickUpper,
				//   liquidity: "0", // Will be calculated by the contract
				//   amount0Max: amount0Desired,
				//   amount1Max: amount1Desired,
				//   owner: recipient,
				//   hookData: "0x",
				// };

				// Create the actions array for v4 position manager
				// Action 1: MINT_POSITION, Action 2: SETTLE_PAIR
				const actions = new Uint8Array([
					Actions.MINT_POSITION,
					Actions.SETTLE_PAIR,
				]);

				// Encode parameters for each action (for future use in more complete implementation)
				// This is a simplified encoding - in production you'd use proper ABI encoding
				// const encodedParams = [
				//   // MINT_POSITION params (simplified)
				//   `0x${actions.reduce((acc, action) => acc + action.toString(16).padStart(2, "0"), "")}`,
				//   // Additional parameter encoding would go here
				// ];

				// Create the unlock data for modifyLiquidities
				const unlockData =
					`0x${actions.reduce((acc, action) => acc + action.toString(16).padStart(2, "0"), "")}` as `0x${string}`;

				// Generate the actual calldata using viem
				const calldata = encodeFunctionData({
					abi: POSITION_MANAGER_ABI,
					functionName: "modifyLiquidities",
					args: [unlockData, BigInt(deadline)],
				});

				// For now, return the transaction data instead of executing it
				// In a production app, you would execute this transaction or return it for the frontend to execute
				return {
					success: true,
					message: "Position mint transaction prepared successfully",
					transactionData: {
						to: CONTRACTS.POSITION_MANAGER,
						data: calldata,
						value: ethValue, // Already converted to string
						gas: "500000", // Convert BigInt to string for tRPC serialization
					},
					position: {
						tokenA: sortedToken0,
						tokenB: sortedToken1,
						amountA: token0IsA ? amountA : amountB,
						amountB: token0IsA ? amountB : amountA,
						feeTier,
						tickLower,
						tickUpper,
						liquidity: "mock_liquidity", // This would be calculated from actual pool data
					},
				} satisfies MintPositionResponse;
			} catch (error) {
				console.error("Error preparing mint position:", error);
				return {
					success: false,
					message: `Error preparing position mint: ${error instanceof Error ? error.message : "Unknown error"}`,
				} satisfies MintPositionResponse;
			}
		}),
});
