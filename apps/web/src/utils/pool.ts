import type { Token } from "@uniswap/sdk-core";
import { type FeeAmount, Pool } from "@uniswap/v3-sdk";
import { createPublicClient, http } from "viem";
import { arbitrum, base, mainnet, optimism, polygon } from "viem/chains";
import { getFactoryAddress } from "@/lib/contracts/uniswap-deployments";

// Pool contract ABI for the slot0 function
const POOL_ABI = [
	{
		inputs: [],
		name: "slot0",
		outputs: [
			{ internalType: "uint160", name: "sqrtPriceX96", type: "uint160" },
			{ internalType: "int24", name: "tick", type: "int24" },
			{ internalType: "uint16", name: "observationIndex", type: "uint16" },
			{
				internalType: "uint16",
				name: "observationCardinality",
				type: "uint16",
			},
			{
				internalType: "uint16",
				name: "observationCardinalityNext",
				type: "uint16",
			},
			{ internalType: "uint8", name: "feeProtocol", type: "uint8" },
			{ internalType: "bool", name: "unlocked", type: "bool" },
		],
		stateMutability: "view",
		type: "function",
	},
	{
		inputs: [],
		name: "liquidity",
		outputs: [{ internalType: "uint128", name: "", type: "uint128" }],
		stateMutability: "view",
		type: "function",
	},
] as const;

// Factory addresses are now managed by the deployment configuration
// This legacy object is kept for reference but should use getFactoryAddress() instead

// Factory ABI for getPool function
const FACTORY_ABI = [
	{
		inputs: [
			{ internalType: "address", name: "tokenA", type: "address" },
			{ internalType: "address", name: "tokenB", type: "address" },
			{ internalType: "uint24", name: "fee", type: "uint24" },
		],
		name: "getPool",
		outputs: [{ internalType: "address", name: "pool", type: "address" }],
		stateMutability: "view",
		type: "function",
	},
] as const;

// Chain configurations for supported mainnet chains
const CHAIN_CONFIGS = {
	1: {
		// Ethereum Mainnet
		chain: mainnet,
		rpcUrl: "https://ethereum-rpc.publicnode.com",
	},
	137: {
		// Polygon Mainnet
		chain: polygon,
		rpcUrl: "https://polygon-rpc.com",
	},
	10: {
		// Optimism Mainnet
		chain: optimism,
		rpcUrl: "https://mainnet.optimism.io",
	},
	8453: {
		// Base Mainnet
		chain: base,
		rpcUrl: "https://mainnet.base.org",
	},
	42161: {
		// Arbitrum One
		chain: arbitrum,
		rpcUrl: "https://arb1.arbitrum.io/rpc",
	},
} as const;

export interface PoolData {
	pool: Pool;
	sqrtPriceX96: bigint;
	tick: number;
	liquidity: bigint;
}

/**
 * Fetches pool data for a given token pair
 */
export async function fetchPoolData(
	tokenA: Token,
	tokenB: Token,
	feeTier: number,
): Promise<PoolData | null> {
	try {
		console.log("fetchPoolData called with:", {
			tokenA: tokenA.symbol,
			tokenB: tokenB.symbol,
			feeTier,
			chainId: tokenA.chainId,
		});
		const chainConfig =
			CHAIN_CONFIGS[tokenA.chainId as keyof typeof CHAIN_CONFIGS];
		if (!chainConfig) {
			console.error(`Unsupported chain ID: ${tokenA.chainId}`);
			throw new Error(`Unsupported chain ID: ${tokenA.chainId}`);
		}
		console.log(`Using RPC URL: ${chainConfig.rpcUrl}`);

		const publicClient = createPublicClient({
			chain: chainConfig.chain,
			transport: http(chainConfig.rpcUrl),
		});

		// Ensure token ordering (token0 < token1)
		const [token0, token1] =
			tokenA.address.toLowerCase() < tokenB.address.toLowerCase()
				? [tokenA, tokenB]
				: [tokenB, tokenA];

		// Get factory address for this chain
		const factoryAddress = getFactoryAddress(tokenA.chainId);
		if (!factoryAddress) {
			throw new Error(
				`No Uniswap V3 factory deployed on chain ${tokenA.chainId}`,
			);
		}

		console.log(`Using factory address: ${factoryAddress}`);

		// Get pool address from factory
		const poolAddress = await publicClient.readContract({
			address: factoryAddress,
			abi: FACTORY_ABI,
			functionName: "getPool",
			args: [
				token0.address as `0x${string}`,
				token1.address as `0x${string}`,
				feeTier,
			],
		});

		if (
			!poolAddress ||
			poolAddress === "0x0000000000000000000000000000000000000000"
		) {
			console.warn(
				`No pool found for ${token0.symbol}/${token1.symbol} with fee tier ${feeTier}`,
			);
			return null;
		}

		// Fetch pool data
		const [slot0Data, liquidityData] = await Promise.all([
			publicClient.readContract({
				address: poolAddress,
				abi: POOL_ABI,
				functionName: "slot0",
			}),
			publicClient.readContract({
				address: poolAddress,
				abi: POOL_ABI,
				functionName: "liquidity",
			}),
		]);

		const [sqrtPriceX96, tick] = slot0Data;

		// Create Pool instance
		const pool = new Pool(
			token0,
			token1,
			feeTier,
			sqrtPriceX96.toString(),
			liquidityData.toString(),
			tick,
		);

		return {
			pool,
			sqrtPriceX96,
			tick,
			liquidity: liquidityData,
		};
	} catch (error) {
		console.error("Error fetching pool data:", error);
		return null;
	}
}

/**
 * Convert readable amount to raw amount with decimals
 */
export function fromReadableAmount(amount: number, decimals: number): bigint {
	return BigInt(Math.floor(amount * 10 ** decimals));
}

/**
 * Convert raw amount to readable amount
 */
export function toReadableAmount(rawAmount: bigint, decimals: number): number {
	return Number(rawAmount) / 10 ** decimals;
}
