import { z } from "zod";
import { publicProcedure, router } from "../lib/trpc";

const UNISWAP_INTERFACE_API_URL = "https://interface.gateway.uniswap.org/v2/pools.v1.PoolsService/ListPositions";

// Types and interfaces based on Uniswap Interface API
interface Token {
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
	token0: Token;
	token1: Token;
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
				};
			} catch (error) {
				console.error("Error fetching positions:", error);
				return {
					success: false,
					positions: [],
					message: `Error fetching positions: ${error instanceof Error ? error.message : "Unknown error"}`,
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
				};
			} catch (error) {
				console.error("Error fetching position details:", error);
				return {
					success: false,
					position: null,
					message: `Error fetching position details: ${error instanceof Error ? error.message : "Unknown error"}`,
				};
			}
		}),
});
