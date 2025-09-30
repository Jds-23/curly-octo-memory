/**
 * Uniswap V3 Mainnet Deployment Addresses
 *
 * Official deployment addresses for Uniswap V3 contracts across all supported mainnet chains.
 * Updated from official Uniswap documentation.
 *
 * @see https://docs.uniswap.org/contracts/v3/reference/deployments/
 */

import type { Address } from "viem";
import { SUPPORTED_CHAINS } from "@/lib/tokens/multichain-tokens";

export interface UniswapV3Deployment {
	// Core contracts
	factory: Address;
	multicall?: Address;
	proxyAdmin?: Address;

	// Periphery contracts
	tickLens?: Address;
	quoter?: Address;
	quoterV2?: Address;
	swapRouter?: Address;
	swapRouter02?: Address;
	nonfungiblePositionManager?: Address;
	v3Migrator?: Address;

	// Additional contracts
	permit2?: Address;
	universalRouter?: Address;
	v3Staker?: Address;

	// Wrapped native token
	wrappedNativeToken: Address;

	// Chain metadata
	chainId: number;
	chainName: string;
}

/**
 * Uniswap V3 deployment addresses by chain ID
 */
export const UNISWAP_V3_DEPLOYMENTS: Record<number, UniswapV3Deployment> = {
	// Ethereum Mainnet
	[SUPPORTED_CHAINS.ETHEREUM]: {
		chainId: SUPPORTED_CHAINS.ETHEREUM,
		chainName: "Ethereum",
		factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
		quoter: "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6",
		quoterV2: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e",
		swapRouter: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
		swapRouter02: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
		nonfungiblePositionManager: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
		permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
		universalRouter: "0x66a9893cc07d91d95644aedd05d03f95e1dba8af",
		wrappedNativeToken: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
	},

	// Polygon Mainnet
	[SUPPORTED_CHAINS.POLYGON]: {
		chainId: SUPPORTED_CHAINS.POLYGON,
		chainName: "Polygon",
		factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
		quoter: "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6",
		quoterV2: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e",
		swapRouter: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
		swapRouter02: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
		nonfungiblePositionManager: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
		permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
		universalRouter: "0x1095692A6237d83C6a72F3F5eFEdb9A670C49223",
		v3Staker: "0xe34139463bA50bD61336E0c446Bd8C0867c6fE65",
		wrappedNativeToken: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", // WMATIC
	},

	// Optimism Mainnet
	[SUPPORTED_CHAINS.OPTIMISM]: {
		chainId: SUPPORTED_CHAINS.OPTIMISM,
		chainName: "Optimism",
		factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
		multicall: "0x1F98415757620B543A52E61c46B32eB19261F984",
		proxyAdmin: "0xB753548F6E010e7e680BA186F9Ca1BdAB2E90cf2",
		tickLens: "0xbfd8137f7d1516D3ea5cA83523914859ec47F573",
		quoter: "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6",
		quoterV2: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e",
		swapRouter: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
		swapRouter02: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
		nonfungiblePositionManager: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
		permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
		universalRouter: "0x851116d9223fabed8e56c0e6b8ad0c31d98b3507",
		v3Staker: "0xe34139463bA50bD61336E0c446Bd8C0867c6fE65",
		wrappedNativeToken: "0x4200000000000000000000000000000000000006", // WETH
	},

	// Base Mainnet
	[SUPPORTED_CHAINS.BASE]: {
		chainId: SUPPORTED_CHAINS.BASE,
		chainName: "Base",
		factory: "0x33128a8fC17869897dcE68Ed026d694621f6FDfD",
		multicall: "0x091e99cb1C49331a94dD62755D168E941AbD0693",
		nonfungiblePositionManager: "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1",
		quoterV2: "0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a",
		swapRouter02: "0x2626664c2603336E57B271c5C0b26F421741e481",
		permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
		universalRouter: "0x6ff5693b99212da76ad316178a184ab56d299b43",
		wrappedNativeToken: "0x4200000000000000000000000000000000000006", // WETH
	},

	// Arbitrum One
	[SUPPORTED_CHAINS.ARBITRUM]: {
		chainId: SUPPORTED_CHAINS.ARBITRUM,
		chainName: "Arbitrum",
		factory: "0x1F98431c8aD98523631AE4a59f267346ea31F984",
		multicall: "0xadF885960B47eA2CD9B55E6DAc6B42b7Cb2806dB",
		proxyAdmin: "0xB753548F6E010e7e680BA186F9Ca1BdAB2E90cf2",
		tickLens: "0xbfd8137f7d1516D3ea5cA83523914859ec47F573",
		quoter: "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6",
		quoterV2: "0x61fFE014bA17989E743c5F6cB21bF9697530B21e",
		swapRouter: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
		swapRouter02: "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45",
		nonfungiblePositionManager: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
		v3Migrator: "0xA5644E29708357803b5A882D272c41cC0dF92B34",
		permit2: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
		universalRouter: "0xa51afafe0263b40edaef0df8781ea9aa03e381a3",
		v3Staker: "0xe34139463bA50bD61336E0c446Bd8C0867c6fE65",
		wrappedNativeToken: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", // WETH
	},
};

/**
 * Get Uniswap V3 deployment for a specific chain
 */
export function getUniswapV3Deployment(chainId: number): UniswapV3Deployment | undefined {
	return UNISWAP_V3_DEPLOYMENTS[chainId];
}

/**
 * Get factory address for a specific chain
 */
export function getFactoryAddress(chainId: number): Address | undefined {
	return UNISWAP_V3_DEPLOYMENTS[chainId]?.factory;
}

/**
 * Get position manager address for a specific chain
 */
export function getPositionManagerAddress(chainId: number): Address | undefined {
	return UNISWAP_V3_DEPLOYMENTS[chainId]?.nonfungiblePositionManager;
}

/**
 * Get swap router address for a specific chain (prefers V2, falls back to V1)
 */
export function getSwapRouterAddress(chainId: number): Address | undefined {
	const deployment = UNISWAP_V3_DEPLOYMENTS[chainId];
	return deployment?.swapRouter02 || deployment?.swapRouter;
}

/**
 * Get quoter address for a specific chain (prefers V2, falls back to V1)
 */
export function getQuoterAddress(chainId: number): Address | undefined {
	const deployment = UNISWAP_V3_DEPLOYMENTS[chainId];
	return deployment?.quoterV2 || deployment?.quoter;
}

/**
 * Get wrapped native token address for a specific chain
 */
export function getWrappedNativeTokenAddress(chainId: number): Address | undefined {
	return UNISWAP_V3_DEPLOYMENTS[chainId]?.wrappedNativeToken;
}

/**
 * Check if Uniswap V3 is deployed on a specific chain
 */
export function isUniswapV3Deployed(chainId: number): boolean {
	return chainId in UNISWAP_V3_DEPLOYMENTS;
}

/**
 * Get all supported chain IDs with Uniswap V3 deployments
 */
export function getSupportedChainIds(): number[] {
	return Object.keys(UNISWAP_V3_DEPLOYMENTS).map(Number);
}

/**
 * Deployment metadata for validation and debugging
 */
export const DEPLOYMENT_METADATA = {
	lastUpdated: "2025-01-30",
	sources: [
		"https://docs.uniswap.org/contracts/v3/reference/deployments/",
		"https://docs.uniswap.org/contracts/v3/reference/deployments/ethereum-deployments",
		"https://docs.uniswap.org/contracts/v3/reference/deployments/polygon-deployments",
		"https://docs.uniswap.org/contracts/v3/reference/deployments/optimism-deployments",
		"https://docs.uniswap.org/contracts/v3/reference/deployments/base-deployments",
		"https://docs.uniswap.org/contracts/v3/reference/deployments/arbitrum-deployments",
	],
	npmPackageVersions: {
		"@uniswap/v3-core": "1.0.0",
		"@uniswap/v3-periphery": "1.0.0",
		"@uniswap/swap-router-contracts": "1.1.0",
	},
	notes: [
		"Contract addresses may differ between chains",
		"Base uses different factory and position manager addresses",
		"Always verify addresses before using in production",
		"Some contracts may not be available on all chains",
	],
} as const;