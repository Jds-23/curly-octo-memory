/**
 * Test script to verify Uniswap deployment addresses are correctly configured
 */

import {
	getFactoryAddress,
	getPositionManagerAddress,
	getSwapRouterAddress,
	getQuoterAddress,
	getWrappedNativeTokenAddress,
	isUniswapV3Deployed,
	getSupportedChainIds,
	UNISWAP_V3_DEPLOYMENTS,
} from "@/lib/contracts/uniswap-deployments";

/**
 * Test all deployment addresses
 */
export function testDeploymentAddresses() {
	console.log("🔍 Testing Uniswap V3 Deployment Addresses");
	console.log("==========================================");

	const supportedChains = getSupportedChainIds();
	console.log(`📊 Supported chains: ${supportedChains.join(", ")}`);
	console.log("");

	for (const chainId of supportedChains) {
		const deployment = UNISWAP_V3_DEPLOYMENTS[chainId];
		console.log(`🔗 Chain ${chainId} (${deployment.chainName}):`);
		console.log(`  ✅ Deployed: ${isUniswapV3Deployed(chainId)}`);
		console.log(`  🏭 Factory: ${getFactoryAddress(chainId)}`);
		console.log(`  📍 Position Manager: ${getPositionManagerAddress(chainId)}`);
		console.log(`  🔄 Swap Router: ${getSwapRouterAddress(chainId)}`);
		console.log(`  💱 Quoter: ${getQuoterAddress(chainId)}`);
		console.log(`  🎁 Wrapped Native: ${getWrappedNativeTokenAddress(chainId)}`);
		console.log("");
	}

	// Test invalid chain
	console.log("❌ Testing invalid chain (999999):");
	console.log(`  Deployed: ${isUniswapV3Deployed(999999)}`);
	console.log(`  Factory: ${getFactoryAddress(999999)}`);
	console.log("");

	console.log("✅ Deployment address tests completed!");
}

// Export for manual testing
if (typeof window !== "undefined") {
	(window as any).testDeployments = testDeploymentAddresses;
}