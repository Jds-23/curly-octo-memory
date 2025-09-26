import { createPublicClient, http, type Address, zeroAddress } from "viem";
import { unichain } from "viem/chains";
import request from "graphql-request";
import { z } from "zod";
import { publicProcedure, router } from "../lib/trpc";

const POSITION_MANAGER_ADDRESS = "0x4529a01c7a0410167c5740c487a8de60232617bf"; // unichain
const UNICHAIN_SUBGRAPH_URL = "https://gateway.thegraph.com/api/subgraphs/id/EoCvJ5tyMLMJcTnLQwWpjAtPdn74PcrZgzfcT5bYxNBH";

// Create public client for blockchain interactions
const publicClient = createPublicClient({
	chain: unichain,
	transport: http(),
});

// Types and interfaces
interface SubgraphPosition {
	id: string;
	tokenId: string;
	owner: string;
}

interface PackedPositionInfo {
	getTickUpper(): number;
	getTickLower(): number;
	hasSubscriber(): boolean;
}

interface PositionDetails {
	tokenId: bigint;
	tickLower: number;
	tickUpper: number;
	liquidity: bigint;
	poolKey: {
		currency0: Address;
		currency1: Address;
		fee: number;
		tickSpacing: number;
		hooks: Address;
	};
}

// GraphQL query for fetching positions
const GET_POSITIONS_QUERY = `
	query GetPositions($owner: String!) {
		positions(where: { owner: $owner }) {
			tokenId
			owner
			id
		}
	}
`;

// Contract ABI for Position Manager
const POSITION_MANAGER_ABI = [
	{
		name: "getPoolAndPositionInfo",
		type: "function",
		inputs: [{ name: "tokenId", type: "uint256" }],
		outputs: [
			{
				name: "poolKey",
				type: "tuple",
				components: [
					{ name: "currency0", type: "address" },
					{ name: "currency1", type: "address" },
					{ name: "fee", type: "uint24" },
					{ name: "tickSpacing", type: "int24" },
					{ name: "hooks", type: "address" },
				],
			},
			{ name: "info", type: "uint256" },
		],
	},
	{
		name: "getPositionLiquidity",
		type: "function",
		inputs: [{ name: "tokenId", type: "uint256" }],
		outputs: [{ name: "liquidity", type: "uint128" }],
	},
] as const;

// Helper functions
function decodePositionInfo(value: bigint): PackedPositionInfo {
	return {
		getTickUpper: () => {
			const raw = Number((value >> 32n) & 0xffffffn);
			return raw >= 0x800000 ? raw - 0x1000000 : raw;
		},
		getTickLower: () => {
			const raw = Number((value >> 8n) & 0xffffffn);
			return raw >= 0x800000 ? raw - 0x1000000 : raw;
		},
		hasSubscriber: () => (value & 0xffn) !== 0n,
	};
}

async function getPositionIds(owner: Address, graphApiKey?: string): Promise<bigint[]> {
	const headers = graphApiKey ? { Authorization: `Bearer ${graphApiKey}` } : undefined;

	const response = await request<{ positions: SubgraphPosition[] }>(
		UNICHAIN_SUBGRAPH_URL,
		GET_POSITIONS_QUERY,
		{ owner: owner.toLowerCase() },
		headers
	);

	return response.positions.map((p) => BigInt(p.tokenId));
}

async function getPositionDetails(tokenId: bigint): Promise<PositionDetails> {
	// Get pool key and packed position info
	const [poolKey, infoValue] = (await publicClient.readContract({
		address: POSITION_MANAGER_ADDRESS,
		abi: POSITION_MANAGER_ABI,
		functionName: "getPoolAndPositionInfo",
		args: [tokenId],
	})) as readonly [
		{
			currency0: Address;
			currency1: Address;
			fee: number;
			tickSpacing: number;
			hooks: Address;
		},
		bigint
	];

	// Get current liquidity
	const liquidity = (await publicClient.readContract({
		address: POSITION_MANAGER_ADDRESS,
		abi: POSITION_MANAGER_ABI,
		functionName: "getPositionLiquidity",
		args: [tokenId],
	})) as bigint;

	// Decode packed position info
	const positionInfo = decodePositionInfo(infoValue);

	return {
		tokenId,
		tickLower: positionInfo.getTickLower(),
		tickUpper: positionInfo.getTickUpper(),
		liquidity,
		poolKey,
	};
}

// tRPC router
export const uniswapRouter = router({
	getPositions: publicProcedure
		.input(
			z.object({
				owner: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address"),
				graphApiKey: z.string().optional(),
			})
		)
		.query(async ({ input }) => {
			try {
				const { owner, graphApiKey } = input;

				// Get position IDs from subgraph
				const tokenIds = await getPositionIds(owner as Address, graphApiKey);

				if (tokenIds.length === 0) {
					return {
						success: true,
						positions: [],
						message: "No positions found for this address",
					};
				}

				// Fetch details for each position
				const positions = await Promise.all(
					tokenIds.map(async (tokenId) => {
						try {
							const details = await getPositionDetails(tokenId);
							return {
								tokenId: details.tokenId.toString(),
								tickLower: details.tickLower,
								tickUpper: details.tickUpper,
								liquidity: details.liquidity.toString(),
								poolKey: {
									currency0: details.poolKey.currency0,
									currency1: details.poolKey.currency1,
									fee: details.poolKey.fee,
									tickSpacing: details.poolKey.tickSpacing,
									hooks: details.poolKey.hooks,
								},
							};
						} catch (error) {
							console.error(`Error fetching details for position ${tokenId}:`, error);
							return null;
						}
					})
				);

				// Filter out failed positions
				const validPositions = positions.filter((p) => p !== null);

				return {
					success: true,
					positions: validPositions,
					message: `Found ${validPositions.length} positions`,
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
				tokenId: z.string().regex(/^\d+$/, "Token ID must be a numeric string"),
			})
		)
		.query(async ({ input }) => {
			try {
				const tokenId = BigInt(input.tokenId);
				const details = await getPositionDetails(tokenId);

				return {
					success: true,
					position: {
						tokenId: details.tokenId.toString(),
						tickLower: details.tickLower,
						tickUpper: details.tickUpper,
						liquidity: details.liquidity.toString(),
						poolKey: {
							currency0: details.poolKey.currency0,
							currency1: details.poolKey.currency1,
							fee: details.poolKey.fee,
							tickSpacing: details.poolKey.tickSpacing,
							hooks: details.poolKey.hooks,
						},
					},
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