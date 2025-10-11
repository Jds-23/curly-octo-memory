import {
	type Address,
	createPublicClient,
	encodeAbiParameters,
	http,
	keccak256,
	parseAbiParameters,
} from "viem";
import { arbitrum, base, mainnet, optimism, polygon } from "viem/chains";
import { z } from "zod";
import { publicProcedure, router } from "../lib/trpc";

// Type definitions
export interface TokenInfo {
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
	poolState: {
		sqrtPriceX96: string;
		currentTick: number;
		currentLiquidity: string;
		poolId: string;
	};
	poolKey: {
		token0: TokenInfo;
		token1: TokenInfo;
		fee: number;
		tickSpacing: number;
		hookAddress: string;
	};
	positionParams: {
		tickLower: number;
		tickUpper: number;
		amount0: string;
		amount1: string;
	};
	contractAddresses: {
		positionManager: Address;
		stateView: Address;
		permit2: Address;
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

// StateView ABI for fetching pool state
const STATE_VIEW_ABI = [
	{
		inputs: [{ name: "poolId", type: "bytes32" }],
		name: "getSlot0",
		outputs: [
			{ name: "sqrtPriceX96", type: "uint160" },
			{ name: "tick", type: "int24" },
			{ name: "protocolFee", type: "uint24" },
			{ name: "lpFee", type: "uint24" },
		],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [{ name: "poolId", type: "bytes32" }],
		name: "getLiquidity",
		outputs: [{ name: "liquidity", type: "uint128" }],
		stateMutability: "view",
		type: "function",
	},
] as const;

// Permit2 ABI
const PERMIT2_ABI = [
	{
		inputs: [
			{ name: "owner", type: "address" },
			{ name: "token", type: "address" },
			{ name: "spender", type: "address" },
		],
		name: "allowance",
		outputs: [
			{ name: "amount", type: "uint160" },
			{ name: "expiration", type: "uint48" },
			{ name: "nonce", type: "uint48" },
		],
		stateMutability: "view",
		type: "function",
	},
] as const;

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

interface ApiV4Position {
	poolPosition: PoolPosition;
	hooks: Array<{
		address: string;
	}>;
}

export interface Position {
	chainId: number;
	protocolVersion: string;
	v4Position?: ApiV4Position;
	v3Position?: PoolPosition;
	v2Position?: any; // V2 positions have different structure
	status: string;
	timestamp: number;
}

interface ListPositionsResponse {
	positions: Position[];
}

// Uniswap V4 contract addresses by chain
const CONTRACTS: Record<
	number,
	{
		POOL_MANAGER: Address;
		POSITION_MANAGER: Address;
		STATE_VIEW: Address;
		PERMIT2: Address;
	}
> = {
	// Ethereum Mainnet
	1: {
		POOL_MANAGER: "0x000000000004444c5dc75cB358380D2e3dE08A90",
		POSITION_MANAGER: "0xbd216513d74c8cf14cf4747e6aaa6420ff64ee9e",
		STATE_VIEW: "0x7ffe42c4a5deea5b0fec41c94c136cf115597227",
		PERMIT2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
	},
	// Polygon
	137: {
		POOL_MANAGER: "0x67366782805870060151383f4bbff9dab53e5cd6",
		POSITION_MANAGER: "0x1ec2ebf4f37e7363fdfe3551602425af0b3ceef9",
		STATE_VIEW: "0x5ea1bd7974c8a611cbab0bdcafcb1d9cc9b3ba5a",
		PERMIT2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
	},
	// Optimism
	10: {
		POOL_MANAGER: "0x9a13f98cb987694c9f086b1f5eb990eea8264ec3",
		POSITION_MANAGER: "0x3c3ea4b57a46241e54610e5f022e5c45859a1017",
		STATE_VIEW: "0xc18a3169788f4f75a170290584eca6395c75ecdb",
		PERMIT2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
	},
	// Base
	8453: {
		POOL_MANAGER: "0x498581ff718922c3f8e6a244956af099b2652b2b",
		POSITION_MANAGER: "0x7c5f5a4bbd8fd63184577525326123b519429bdc",
		STATE_VIEW: "0xa3c0c9b65bad0b08107aa264b0f3db444b867a71",
		PERMIT2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
	},
	// Arbitrum
	42161: {
		POOL_MANAGER: "0x4444444443c93dd47726ac8a34ae1f8baf6b1b82",
		POSITION_MANAGER: "0x5e1a6231bd58b9e5b5e4a0eb5bc1f4b4f3c0d98d",
		STATE_VIEW: "0x89b94a2de0f3d97eabf8dd33c4b2e5d0e1b5e3df",
		PERMIT2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
	},
} as const;

// WETH addresses by chain
const WETH_ADDRESSES: Record<number, Address> = {
	1: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // Ethereum Mainnet
	137: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", // Polygon
	10: "0x4200000000000000000000000000000000000006", // Optimism
	8453: "0x4200000000000000000000000000000000000006", // Base
	42161: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", // Arbitrum
} as const;

// Helper function to get tick spacing based on fee tier
function getTickSpacing(feeTier: number): number {
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
}

// Helper function to calculate nearest usable tick
function nearestUsableTick(tick: number, tickSpacing: number): number {
	return Math.round(tick / tickSpacing) * tickSpacing;
}

// Helper to calculate pool ID (keccak256 hash of pool key)
function calculatePoolId(
	token0: Address,
	token1: Address,
	fee: number,
	tickSpacing: number,
	hookAddress: Address,
): `0x${string}` {
	// Encode the pool key according to Uniswap V4 PoolKey struct
	const encodedPoolKey = encodeAbiParameters(
		parseAbiParameters("address, address, uint24, int24, address"),
		[token0, token1, fee, tickSpacing, hookAddress],
	);

	// Return keccak256 hash as bytes32
	return keccak256(encodedPoolKey);
}

// Chain configurations for all supported mainnet chains
const CHAIN_CONFIGS: { [key: number]: { chain: any; rpcUrl: string } } = {
	1: {
		// Ethereum Mainnet
		chain: mainnet,
		rpcUrl: "https://ethereum-rpc.publicnode.com",
	},
	137: {
		// Polygon
		chain: polygon,
		rpcUrl: "https://polygon-rpc.com",
	},
	10: {
		// Optimism
		chain: optimism,
		rpcUrl: "https://mainnet.optimism.io",
	},
	8453: {
		// Base
		chain: base,
		rpcUrl: "https://mainnet.base.org",
	},
	42161: {
		// Arbitrum
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
				hookAddress: z
					.string()
					.regex(/^0x[a-fA-F0-9]{40}$/, "Invalid hook address")
					.optional()
					.default("0x0000000000000000000000000000000000000000"),
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
					hookAddress,
				} = input;

				// Validate chain support
				const chainConfig = CHAIN_CONFIGS[tokenA.chainId];
				if (!chainConfig) {
					return {
						success: false,
						message: `Unsupported chain ID: ${tokenA.chainId}`,
					} satisfies MintPositionResponse;
				}

				// Get chain-specific contracts
				const chainContracts = CONTRACTS[tokenA.chainId];
				if (!chainContracts) {
					return {
						success: false,
						message: `Uniswap V4 contracts not deployed on chain ID: ${tokenA.chainId}`,
					} satisfies MintPositionResponse;
				}

				// Determine WETH address for this chain
				const wethAddress = WETH_ADDRESSES[tokenA.chainId];

				// Normalize token addresses (convert native to WETH)
				const token0Address =
					tokenA.address === "0x0000000000000000000000000000000000000000"
						? wethAddress
						: (tokenA.address as Address);

				const token1Address =
					tokenB.address === "0x0000000000000000000000000000000000000000"
						? wethAddress
						: (tokenB.address as Address);

				// Ensure token ordering (token0 < token1)
				const needsSort =
					token0Address.toLowerCase() > token1Address.toLowerCase();

				const sortedToken0: TokenInfo = needsSort
					? {
							address: token1Address,
							chainId: tokenB.chainId,
							decimals: tokenB.decimals,
							symbol: tokenB.symbol,
							name: tokenB.name,
						}
					: {
							address: token0Address,
							chainId: tokenA.chainId,
							decimals: tokenA.decimals,
							symbol: tokenA.symbol,
							name: tokenA.name,
						};

				const sortedToken1: TokenInfo = needsSort
					? {
							address: token0Address,
							chainId: tokenA.chainId,
							decimals: tokenA.decimals,
							symbol: tokenA.symbol,
							name: tokenA.name,
						}
					: {
							address: token1Address,
							chainId: tokenB.chainId,
							decimals: tokenB.decimals,
							symbol: tokenB.symbol,
							name: tokenB.name,
						};

				const token0IsA = !needsSort;

				// Calculate tick spacing based on fee tier
				const tickSpacing = getTickSpacing(feeTier);

				// Create viem client for fetching pool state
				const publicClient = createPublicClient({
					chain: chainConfig.chain,
					transport: http(chainConfig.rpcUrl),
				});

				// Calculate pool ID
				const poolId = calculatePoolId(
					sortedToken0.address,
					sortedToken1.address,
					feeTier,
					tickSpacing,
					hookAddress as Address,
				);

				// Fetch current pool state from the blockchain
				const [slot0, liquidity] = await Promise.all([
					publicClient.readContract({
						address: chainContracts.STATE_VIEW,
						abi: STATE_VIEW_ABI,
						functionName: "getSlot0",
						args: [poolId as `0x${string}`],
					}),
					publicClient.readContract({
						address: chainContracts.STATE_VIEW,
						abi: STATE_VIEW_ABI,
						functionName: "getLiquidity",
						args: [poolId as `0x${string}`],
					}),
				]);

				// Extract pool state data
				const sqrtPriceX96Current = slot0[0] as bigint;
				const currentTick = slot0[1] as number;
				const currentLiquidity = liquidity as bigint;

				// Calculate tick boundaries
				let tickLower: number;
				let tickUpper: number;

				if (fullRange) {
					const MIN_TICK = -887272;
					const MAX_TICK = 887272;
					tickLower = nearestUsableTick(MIN_TICK, tickSpacing);
					tickUpper = nearestUsableTick(MAX_TICK, tickSpacing);
				} else {
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

				const amount0Desired = token0IsA ? amountADesired : amountBDesired;
				const amount1Desired = token0IsA ? amountBDesired : amountADesired;

				// Return pool state and position parameters for frontend SDK usage
				return {
					success: true,
					message:
						"Pool state fetched successfully. Use @uniswap/v4-sdk on frontend to build transaction.",
					poolState: {
						sqrtPriceX96: sqrtPriceX96Current.toString(),
						currentTick,
						currentLiquidity: currentLiquidity.toString(),
						poolId,
					},
					poolKey: {
						token0: sortedToken0,
						token1: sortedToken1,
						fee: feeTier,
						tickSpacing,
						hookAddress: hookAddress ?? "0x0000000000000000000000000000000000000000",
					},
					positionParams: {
						tickLower,
						tickUpper,
						amount0: amount0Desired.toString(),
						amount1: amount1Desired.toString(),
					},
					contractAddresses: {
						positionManager: chainContracts.POSITION_MANAGER,
						stateView: chainContracts.STATE_VIEW,
						permit2: chainContracts.PERMIT2,
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
