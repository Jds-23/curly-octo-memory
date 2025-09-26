import { z } from "zod";
import { publicProcedure, router } from "../lib/trpc";
import { createPublicClient, createWalletClient, http } from "viem";
import { mainnet, unichain } from "viem/chains";

// Minimal type definitions to replace SDK imports
interface Token {
	chainId: number;
	address: string;
	decimals: number;
	symbol: string;
	name: string;
}

// ChainId constants
const ChainId = {
	MAINNET: 1,
	UNICHAIN: 130,
} as const;

// Helper function to calculate nearest usable tick
function nearestUsableTick(tick: number, tickSpacing: number): number {
	return Math.round(tick / tickSpacing) * tickSpacing;
}

const UNISWAP_INTERFACE_API_URL = "https://interface.gateway.uniswap.org/v2/pools.v1.PoolsService/ListPositions";

// Types and interfaces based on Uniswap Interface API
interface ApiToken {
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

interface Position {
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
	STATE_VIEW_ADDRESS: "0x86e8631a016f9068c3f085faf484ee3f5fdee8f2", // StateView contract
	POSITION_MANAGER: "0x4529a01c7a0410167c5740c487a8de60232617bf", // Position Manager (Unichain)
	PERMIT2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
};

// Chain configurations
const CHAIN_CONFIGS: { [key: number]: { chain: any; rpcUrl: string } } = {
	[ChainId.MAINNET]: {
		chain: mainnet,
		rpcUrl: "https://eth-mainnet.g.alchemy.com/v2/demo", // Use your actual RPC URL
	},
	130: { // Unichain
		chain: unichain,
		rpcUrl: "https://unichain-sepolia.g.alchemy.com/v2/demo", // Use your actual RPC URL
	},
};

// Helper function to call Uniswap Interface API
async function fetchPositionsFromUniswap(address: string): Promise<ListPositionsResponse> {
	const response = await fetch(UNISWAP_INTERFACE_API_URL, {
		method: "POST",
		headers: {
			"accept": "*/*",
			"accept-language": "en-US,en;q=0.9",
			"connect-protocol-version": "1",
			"content-type": "application/json",
			"origin": "https://app.uniswap.org",
			"referer": "https://app.uniswap.org/",
			"user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
		},
		body: JSON.stringify({
			address: address,
			chainIds: [1, 130, 8453, 42161, 137, 10, 56, 43114, 480, 324, 1868, 7777777, 42220, 81457], // All supported chains
			protocolVersions: ["PROTOCOL_VERSION_V4", "PROTOCOL_VERSION_V3", "PROTOCOL_VERSION_V2"],
			positionStatuses: ["POSITION_STATUS_IN_RANGE", "POSITION_STATUS_OUT_OF_RANGE"],
			pageSize: 100, // Fetch more positions
			pageToken: "",
			includeHidden: true,
		}),
	});

	if (!response.ok) {
		throw new Error(`Uniswap API error: ${response.status} ${response.statusText}`);
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
					} as {
						success: boolean;
						positions: any[];
						message: string;
					};
				}

				// Transform positions to a consistent format
				const transformedPositions = response.positions.map((position) => {
					// Get pool position data based on protocol version
					let poolPosition: PoolPosition | undefined;
					let hooks: string[] = [];

					if (position.v4Position) {
						poolPosition = position.v4Position.poolPosition;
						hooks = position.v4Position.hooks.map(h => h.address);
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
				}).filter(Boolean); // Remove null values

				return {
					success: true,
					positions: transformedPositions,
					message: `Found ${transformedPositions.length} positions`,
				} as {
					success: boolean;
					positions: any[];
					message: string;
				};
			} catch (error) {
				console.error("Error fetching positions:", error);
				return {
					success: false,
					positions: [],
					message: `Error fetching positions: ${error instanceof Error ? error.message : "Unknown error"}`,
				} as {
					success: boolean;
					positions: any[];
					message: string;
				};
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
					} as {
						success: boolean;
						position: any;
						message: string;
					};
				}

				// Transform the position data
				let poolPosition: PoolPosition | undefined;
				let hooks: string[] = [];

				if (position.v4Position) {
					poolPosition = position.v4Position.poolPosition;
					hooks = position.v4Position.hooks.map(h => h.address);
				} else if (position.v3Position) {
					poolPosition = position.v3Position;
				}

				if (!poolPosition) {
					return {
						success: false,
						position: null,
						message: "Unsupported position type",
					} as {
						success: boolean;
						position: any;
						message: string;
					};
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
				} as {
					success: boolean;
					position: any;
				};
			} catch (error) {
				console.error("Error fetching position details:", error);
				return {
					success: false,
					position: null,
					message: `Error fetching position details: ${error instanceof Error ? error.message : "Unknown error"}`,
				} as {
					success: boolean;
					position: any;
					message: string;
				};
			}
		}),

	mintPosition: publicProcedure
		.input(
			z.object({
				tokenA: z.object({
					address: z.string(),
					symbol: z.string(),
					name: z.string(),
					decimals: z.number(),
					chainId: z.number(),
				}),
				tokenB: z.object({
					address: z.string(),
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
				recipient: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
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
					slippageTolerance,
					recipient,
				} = input;

				// Validate chain support
				const chainConfig = CHAIN_CONFIGS[tokenA.chainId];
				if (!chainConfig) {
					return {
						success: false,
						message: `Unsupported chain ID: ${tokenA.chainId}`,
						tokenId: null,
					} as {
						success: boolean;
						message: string;
						tokenId: string | null;
					};
				}

				// Create token definitions
				const token0: Token = {
					chainId: tokenA.chainId,
					address: tokenA.address === "0x0000000000000000000000000000000000000000"
						? "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" // WETH for ETH
						: tokenA.address,
					decimals: tokenA.decimals,
					symbol: tokenA.symbol,
					name: tokenA.name,
				};

				const token1: Token = {
					chainId: tokenB.chainId,
					address: tokenB.address === "0x0000000000000000000000000000000000000000"
						? "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" // WETH for ETH
						: tokenB.address,
					decimals: tokenB.decimals,
					symbol: tokenB.symbol,
					name: tokenB.name,
				};

				// Ensure token ordering (token0 < token1)
				const [sortedToken0, sortedToken1] = token0.address.toLowerCase() < token1.address.toLowerCase()
					? [token0, token1]
					: [token1, token0];

				const token0IsA = sortedToken0.address === token0.address;

				// Calculate tick spacing based on fee tier
				const getTickSpacing = (feeTier: number): number => {
					switch (feeTier) {
						case 100: return 1;   // 0.01%
						case 500: return 10;  // 0.05%
						case 3000: return 60; // 0.3%
						case 10000: return 200; // 1%
						default: return 60; // Default to 0.3% fee tier
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
				const amountADesired = BigInt(Math.floor(amountA * 10 ** tokenA.decimals));
				const amountBDesired = BigInt(Math.floor(amountB * 10 ** tokenB.decimals));

				const amount0Desired = token0IsA ? amountADesired.toString() : amountBDesired.toString();
				const amount1Desired = token0IsA ? amountBDesired.toString() : amountADesired.toString();

				// Calculate slippage tolerance in basis points
				const slippageToleranceBps = Math.floor(slippageTolerance * 100);
				const deadline = Math.floor(Date.now() / 1000) + 20 * 60; // 20 minutes

				// Mock transaction data - in production, you'd use the actual SDK or contract calls
				const mockCalldata = "0x"; // This would be the actual encoded function call
				const mockValue = "0"; // ETH value to send

				// For now, return the transaction data instead of executing it
				// In a production app, you would execute this transaction or return it for the frontend to execute
				return {
					success: true,
					message: "Position mint transaction prepared successfully (mock implementation)",
					tokenId: "pending", // This would be returned after transaction execution
					transactionData: {
						to: CONTRACTS.POSITION_MANAGER,
						data: mockCalldata,
						value: mockValue,
						gasLimit: "500000", // Estimate gas limit
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
				} as {
					success: boolean;
					message: string;
					tokenId: string | null;
					transactionData?: any;
					position?: any;
				};
			} catch (error) {
				console.error("Error preparing mint position:", error);
				return {
					success: false,
					message: `Error preparing position mint: ${error instanceof Error ? error.message : "Unknown error"}`,
					tokenId: null,
				} as {
					success: boolean;
					message: string;
					tokenId: string | null;
				};
			}
		}),
});
